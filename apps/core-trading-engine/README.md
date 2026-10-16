# core-trading-engine

The matching engine for the CEX. It is a **single-threaded, in-memory, event-sourced** service: it owns the order book, user balances, perpetual positions, funding, commissions and the insurance fund for every market, consumes requests from a Redis Stream, mutates its in-memory state deterministically, and emits a stream of granular "what changed" updates that other services (database, websocket) fan out from.

There is no database read/write on the hot path. Postgres is only touched once at boot (to bootstrap markets/assets when no snapshot exists) and the engine's own state is periodically archived to R2/S3 as a JSON snapshot for crash recovery.

- Runtime: Bun/Node + TypeScript, run via `tsx`
- Transport: Redis Streams (consumer groups), via `@workspace/redis-streams`
- Shared contracts: `@workspace/shared` (`EVENT_SUBJECT`, payload/response types, reject codes)
- Persistence of *record* (not of *truth*): `@workspace/database` (Prisma/Postgres), written by a separate `database-engine` service
- Cold storage: Cloudflare R2 (S3-compatible) for point-in-time snapshots

```
bun run dev     # nodemon + tsx, restarts on file change
bun run start   # tsx ./src/index.ts
bun run build   # tsc -> dist/
bun run test    # jest
```

Required env vars: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_BUCKET_ENDPOINT`, plus whatever `RedisManager`/`prisma` need (Redis URL, `DATABASE_URL`). Optional: `SNAPSHOT_INTERVAL` (seconds, default `3600`).

## Port & health checks

The engine has no REST API of its own (it's driven entirely by Redis Streams), but it does run
a tiny plain-HTTP server side by side with the consumer loop purely for container health checks.

| | |
|---|---|
| Port | `8081` (env `PORT`) |
| Liveness | `GET /alive` — 200 once the process is up |
| Readiness | `GET /ready` — 200 only once Redis is connected **and** the R2 snapshot bucket has been reached at boot; 503 otherwise |

```bash
curl http://localhost:8081/alive
curl http://localhost:8081/ready
```

---

## Table of contents

1. [System-level data flow](#1-system-level-data-flow)
2. [Engine composition](#2-engine-composition)
3. [Boot sequence & snapshots](#3-boot-sequence--snapshots)
4. [The event loop (`Engine.process`)](#4-the-event-loop-engineprocess)
5. [Order book internals](#5-order-book-internals)
6. [Deep dive: Create Order](#6-deep-dive-create-order)
7. [Deep dive: Balances](#7-deep-dive-balances)
8. [Deep dive: Positions](#8-deep-dive-positions)
9. [Deep dive: Index price update, liquidation & ADL](#9-deep-dive-index-price-update-liquidation--adl)
10. [Deep dive: Funding settlement](#10-deep-dive-funding-settlement)
11. [Deep dive: Commission & Insurance funds](#11-deep-dive-commission--insurance-funds)
12. [Deep dive: The update bundle (depths, tickers, mark price, updates fan-out)](#12-deep-dive-the-update-bundle-depths-tickers-mark-price-updates-fan-out)
13. [Event catalog](#13-event-catalog)
14. [Error handling](#14-error-handling)

---

## 1. System-level data flow

Nothing talks to the engine directly over HTTP. Every mutation and every query is a message on the `engine.request` Redis Stream, and every effect (successful or not) is a message on `engine.response`. The engine is one of several consumer-group members on `engine.request`; `database-engine` and `ws-server` are two independent consumer groups on `engine.response`, so both get every message.

```mermaid
flowchart LR
    subgraph Producers
        BE["core-backend<br/>(HTTP API, EVENT_SOURCE.BACKEND)"]
        POLL["ws-index-poller<br/>(Binance mark-price WS, EVENT_SOURCE.WS)"]
    end

    subgraph Redis["Redis Streams"]
        REQ[["engine.request<br/>group: trade-engine-group"]]
        RES[["engine.response<br/>groups: database-engine-group, ws-server-group"]]
    end

    subgraph Engine["core-trading-engine (this app)"]
        E["Engine.process(event)"]
    end

    subgraph Consumers
        DBE["database-engine<br/>persists orders/trades/balances/positions"]
        WS["ws-server<br/>broadcasts to browser clients"]
    end

    PG[(Postgres)]
    R2[(Cloudflare R2<br/>engine snapshots)]

    BE -- "order create/cancel, on/off-ramp,<br/>market & asset admin, queries" --> REQ
    POLL -- "INDEX_PRICE_UPDATE_EVENT (~1/s)<br/>FUNDING_RATE_UPDATE_EVENT (hourly)" --> REQ
    REQ --> E
    E -- "AnyTradeResult { ...response, updates? }" --> RES
    RES --> DBE --> PG
    RES --> WS
    E -. "hourly snapshot upload /<br/>restore on boot" .-> R2
    E -. "bootstrap markets/assets<br/>if no snapshot found" .-> PG
```

Key asymmetry: **requests are 1:1 with responses, but not every response leaves the engine.** In [`src/index.ts`](src/index.ts), if the triggering event's source is `EVENT_SOURCE.WS` (i.e. an index-price tick or funding tick, not a user action) and processing produced no `updates` bundle, the response is dropped instead of published. Index prices arrive roughly once a second per market; without this filter the response stream would be flooded with no-op messages every tick. A response is only published for a WS-sourced event when it actually changed something (a liquidation or ADL fired).

---

## 2. Engine composition

`Engine` ([`src/engine/core-engine.ts`](src/engine/core-engine.ts)) is a thin dispatcher over a set of single-purpose sub-engines that all share one mutable `EngineState` ([`src/engine/engine-state.ts`](src/engine/engine-state.ts)). Nothing here is persisted per-call — `EngineState` *is* the database, held entirely in `Map`s in process memory.

```mermaid
flowchart TD
    ES["EngineState<br/>assets, markets, balances,<br/>orderbooks, positions, marketRisk,<br/>insuranceFunds, commissionFunds,<br/>fundingPayments"]

    Engine["Engine<br/>(core-engine.ts)<br/>routes EVENT_SUBJECT -> handler"]

    OMS["OMSEngine<br/>stateless validation gate<br/>(rejects bad requests before<br/>anything mutates)"]
    UM["UpdateManagerEngine<br/>per-tick scratch buffer of<br/>everything that changed"]
    FM["FundManagementEngine<br/>commission + insurance funds<br/>per market"]
    BAL["BalanceEngine<br/>lock / release / apply-fill<br/>for every user's asset balances"]
    MATCH["MatchingEngine<br/>owns one OrderbookEngine<br/>per market symbol"]
    POS["PositionMatchingEngine<br/>owns one PositionEngine<br/>per PERP market symbol"]
    MKT["MarketEngine<br/>assets & markets admin,<br/>boots/restores per-market engines"]
    SNAP["SnapshotEngine<br/>serialize EngineState -> R2 JSON<br/>and back"]

    Engine --> OMS
    Engine --> UM
    Engine --> FM
    Engine --> BAL
    Engine --> MATCH
    Engine --> POS
    Engine --> MKT
    Engine --> SNAP

    OMS --> ES
    BAL --> ES
    BAL --> UM
    BAL --> FM
    MATCH --> ES
    MATCH -- "prepareFill (balance check)" --> BAL
    POS --> ES
    POS --> BAL
    POS --> UM
    POS --> FM
    MKT --> MATCH
    MKT --> POS
    MKT --> FM
    SNAP --> ES
```

Ownership is 1:1 per market: `MatchingEngine` holds `state.orderbooks: Map<symbol, OrderbookEngine>`, `PositionMatchingEngine` holds `state.positions: Map<symbol, PositionEngine>`. Every market gets its own order book and its own position book — there is no cross-market matching or margin sharing.

---

## 3. Boot sequence & snapshots

```mermaid
flowchart TD
    START(["Engine.create()"]) --> TRY{"Restore latest<br/>snapshot from R2?"}
    TRY -- "found" --> APPLY["applySnapshot():<br/>rehydrate assets, markets, balances,<br/>marketRisk, funding history,<br/>insurance/commission funds,<br/>per-market orderbook + position state"]
    TRY -- "none found" --> BOOT["marketEngine.initializeMarkets():<br/>load active assets/markets from Postgres<br/>via prisma, build fresh empty<br/>orderbooks/positions/funds"]
    APPLY --> READY(["Engine ready, eventSequenceId restored"])
    BOOT --> UPLOAD["uploadSnapshot(0)<br/>(bootstraps the first snapshot file)"]
    UPLOAD --> READY

    READY --> LOOP["setInterval every SNAPSHOT_INTERVAL<br/>(default 3600s): upload a fresh snapshot"]
```

Every response also carries a monotonically increasing `eventId` (`Engine.getUpdatedEventId`) — a single global counter across *all* event types, not per-market — which restores from the snapshot's `eventSequenceId` so IDs stay strictly increasing across a restart.

---

## 4. The event loop (`Engine.process`)

```mermaid
sequenceDiagram
    participant R as Redis (engine.request)
    participant IDX as index.ts consumer
    participant E as Engine.process
    participant H as handler (e.g. createOrder)
    participant UM as UpdateManagerEngine

    R->>IDX: xReadGroup -> raw message
    IDX->>IDX: isValidMarketEvent(data)?
    alt malformed
        IDX->>IDX: log + drop (no publish)
    else valid
        IDX->>E: process(event)
        E->>H: dispatch on event.type (switch/case)
        H->>UM: capture*() calls as it mutates state
        H-->>E: EngineResponseUnion (success/failure)
        E->>UM: consume() drains the scratch buffer
        UM-->>E: BaseUpdate | undefined
        E-->>IDX: result (with .updates attached if any)
        IDX->>IDX: source===BACKEND OR updates!==undefined ?
        alt publish
            IDX->>R: xAdd engine.response {..result, requestId, backendId}
        else suppress
            IDX->>IDX: drop (WS-sourced no-op tick)
        end
    end
```

Every handler follows the same shape: validate via `OMSEngine` (pure checks, throws `RejectError`), mutate `EngineState` through the relevant sub-engine, call `updateManagerEngine.capture*` as things change, and return a typed `...EngineResponse`. If anything throws a `RejectError` anywhere in the chain, the specific handler's `catch` block rolls back what it can (order book/position snapshots, balance locks) and returns a `success:false` response with the `EVENT_REJECT_CODES` code. If something throws that *isn't* a `RejectError`, the outer `process()` catch calls `updateManagerEngine.reset()` (discarding any partial update buffer) and returns a generic `INTERNAL_ERROR`.

---

## 5. Order book internals

Each market's `OrderbookEngine` ([`src/engine/single-orderbook.ts`](src/engine/single-orderbook.ts)) is a classic price-level book:

- **Price levels**: `bids`/`asks` are `Map<price, OrderList>`, where `OrderList` ([`src/utils/order-list.ts`](src/utils/order-list.ts)) is a doubly linked list giving FIFO price-time priority within a level (O(1) append/remove).
- **Best-price lookup**: `bidTree`/`askTree` are red-black trees (`functional-red-black-tree`) keyed by price, so "best bid" (`bidTree.end`) and "best ask" (`askTree.begin`) are O(log n), and whole levels can be inserted/removed in O(log n) as they empty out or get created.
- **Direct lookup**: `orderMap: orderId -> OrderNode` for O(1) cancel/get.
- **Per-user index**: `userOrders: userId -> Set<orderId>` for listing a user's open orders and enforcing the 100-open-orders-per-user cap.

```mermaid
flowchart LR
    subgraph OrderbookEngine
        BT["bidTree (RB-tree, price keys)"] --> B1["bids.get(price) -> OrderList"]
        AT["askTree (RB-tree, price keys)"] --> A1["asks.get(price) -> OrderList"]
        B1 --> N1["OrderNode <-> OrderNode <-> OrderNode<br/>(FIFO within the level)"]
        A1 --> N2["OrderNode <-> OrderNode"]
        OM["orderMap: orderId -> OrderNode"] -.-> B1
        OM -.-> A1
        UO["userOrders: userId -> Set&lt;orderId&gt;"]
    end
```

`getDepth(limit)` walks both trees (highest bid down, lowest ask up) to answer `GET_MARKET_DEPTH` REST-style queries — this is a full read, distinct from the incremental depth *deltas* streamed out per tick (see [§12](#12-deep-dive-the-update-bundle-depths-tickers-mark-price-updates-fan-out)). `getOpenInterest()` reports resting-order count + total remaining quantity + last traded price for a market; note this is book-derived ("orders currently open"), not the position-derived "aggregate open notional" that "open interest" usually means on a perp exchange — worth keeping in mind if you're consuming `GET_ONE_OPEN_INTEREST`/`GET_ALL_OPEN_INTEREST`.

---

## 6. Deep dive: Create Order

This is the central, most involved path in the engine (`Engine.createOrder` in `core-engine.ts`, delegating into `OMSEngine`, `BalanceEngine`, `MatchingEngine` → `OrderbookEngine`, and — for PERP markets — `PositionMatchingEngine`).

```mermaid
sequenceDiagram
    participant C as Engine.createOrder
    participant OMS as OMSEngine
    participant BAL as BalanceEngine
    participant OB as OrderbookEngine
    participant POS as PositionMatchingEngine
    participant UM as UpdateManagerEngine

    C->>C: orderParseToMarket(payload)\nAssign UUID, defaults

    C->>OMS: createOrderCheck(order)
    Note over OMS: Validate market, side, type, quantity, price,\nTIF, leverage, lot/tick size, notional,\nreduce-only, open-order limits,\npost-only crossing, market liquidity,\nand balance existence.
    OMS-->>C: RejectError on validation failure

    C->>BAL: lockBalance(order)
    Note over BAL: PERP: estimate required margin\n(1.05x buffer for MARKET).\nLIMIT uses exact margin.\nSPOT BUY locks quote + fees.\nSPOT SELL locks base quantity.
    BAL-->>C: lockedAmount

    C->>OB: createSnapshot()
    C->>POS: createSnapshot()

    C->>OB: addOrder(order)

    alt FOK not fully fillable
        OB-->>C: Order CANCELLED (no fills)
    else Post-only crosses book
        OB-->>C: Order REJECTED
    else Matching
        OB->>OB: match()\nWalk opposite book\nPrice-time priority\nSTP handling\nPrepare fills\nApply fills\nRest leftover if GTC
        OB-->>C: taker + cancelledOrders + matchedOrders
    end

    loop Cancelled orders
        C->>BAL: releaseCancelledOrderBalances(order)
    end

    loop Each fill
        alt PERP market
            C->>POS: applyFills(fill, taker, maker)
            Note over POS: Realize PnL\nMove margin\nOpen/Add/Reduce/Close/Flip position
        end

        C->>BAL: applyFills(fill, taker, maker)
        Note over BAL: SPOT: exchange assets + fees.\nPERP: charge trading fees only.
    end

    C->>BAL: releaseUnusedBalance(taker)
    Note over BAL: Return unused locked balance\nunless order remains resting.

    C->>UM: captureOrders(matched, cancelled, taker, market)
    UM-->>C: Buffer orders, trades,\ndepth, ticker, mark price

    alt RejectError or Exception
        C->>OB: restoreSnapshot()
        C->>POS: restoreSnapshot()
        C->>BAL: releaseBalance(order, lockedAmount)
        Note over BAL: Unlock reserved balance\nDiscard buffered updates
        C-->>C: success = false
    else Success
        C-->>C: success = true\nReturn taker order
    end
```

A few details worth calling out explicitly:

- **Balance is locked *before* matching, using the worst case.** For a PERP market order, the price it'll actually fill at isn't known yet, so the lock buffers 5% above the current notional/leverage estimate. Whatever isn't ultimately consumed is released at the end (`releaseUnusedBalance`).
- **Reservation is per-fill, not per-order.** During matching, `BalanceEngine.prepareFill` computes the max quantity *both* the maker and the taker can actually afford (via a lot-size-aligned binary search when the full requested quantity would overdraw either side's remaining `order.balance` allotment), and only reserves that. This is how a resting order that's slowly running low on funds gets partially — rather than fully — filled against a larger incoming order.
- **Self-trade prevention (STP)** is handled inline in `OrderbookEngine.match` via `taker.stpMode` (`CANCEL_TAKER` / `CANCEL_MAKER` / `CANCEL_BOTH`) whenever the taker and a resting maker share a `userId`.
- **PnL settlement happens before fee settlement for PERP fills** — `positionEngine.applyFills` runs first (because it needs the un-fee-adjusted fill price to compute PnL and move margin), then `balanceEngine.applyFills` charges the maker/taker fee against quote balance separately.
- **The order-book/position snapshots taken before matching are a defensive rollback net**, not the primary correctness mechanism — the primary mechanism is that `OMSEngine` rejects invalid orders *before* anything mutates. The snapshot/restore exists so that if something later in the pipeline still throws (e.g. a balance invariant violation), the book is guaranteed to come back to a known-good state rather than being left half-mutated.
- **Liquidation orders go through this exact same path.** `Engine.executeLiquidation` (see [§9](#9-deep-dive-index-price-update-liquidation--adl)) builds a synthetic reduce-only IOC market order and calls `this.createOrder(...)` directly — there is no separate liquidation matching code path.

---

## 7. Deep dive: Balances

`BalanceEngine` ([`src/engine/balance-engine.ts`](src/engine/balance-engine.ts)) tracks, per user, `Map<assetSymbol, { total, locked }>`. **Available balance is always `total - locked`.** `locked` is never a separate pool of funds — it's a portion of `total` that's earmarked and can't be spent twice.

```mermaid
stateDiagram-v2
    [*] --> Available: onRamp() credits total
    Available --> Locked: lockBalance() at order placement<br/>(worst-case estimate)
    Locked --> Used: prepareFill()/reserveFillBalance()<br/>consumes order.balance.used<br/>per partial fill (order-scoped ledger)
    Used --> Settled: applyFills() / applyPerpFills()<br/>moves value, charges fee,<br/>credits commission fund
    Locked --> Available: releaseUnusedBalance() /<br/>releaseCancelledOrderBalances() /<br/>releaseBalance()<br/>(allotted - used - released)
    Available --> [*]: offRamp() debits total
```

Every order carries its own tiny ledger, `order.balance = { allotted, used, released }`, so the engine can always answer "how much of what I originally locked for this specific order is still available" (`allotted - released - used`) without touching the account's aggregate `locked` figure mid-match. That per-order ledger is what `getOrderAvailableBalance`/`getFillableQty` in `BalanceEngine` operate on.

What gets locked at order-placement time, and in which asset:

| Market type | Side | Locked asset | Amount |
|---|---|---|---|
| PERP, reduceOnly | either | quote | `0` (can only shrink a position) |
| PERP, MARKET order | either | quote | `ceil(notional * 1.05 / leverage)` (slippage buffer, since fill price is unknown) |
| PERP, LIMIT order | either | quote | `ceil(notional / leverage)` |
| SPOT | BUY | quote | `notional + estimatedFee` |
| SPOT | SELL | base | `quantity` (exact — nothing to estimate) |

Trading fees are tiered: **1 bps for makers, 2 bps for takers, and a flat 50 bps for any fill flagged `liquidation: true`** (`BalanceEngine.fillFees`). Every fee collected is routed through `FundManagementEngine.addCommissionFee` (see [§11](#11-deep-dive-commission--insurance-funds)).

For PERP fills specifically, realized PnL and margin movement don't happen in `BalanceEngine` at all — they happen in `PositionEngine.applyOrderFill`, which calls back into `BalanceEngine.releasePerpCollateral` to actually apply the credit/debit. That function is also where liquidation bad debt gets absorbed by the insurance fund (`deficit` parameter) instead of leaving a user's balance negative.

---

## 8. Deep dive: Positions

`PositionEngine` ([`src/engine/single-position.ts`](src/engine/single-position.ts)) is one-per-PERP-market, and holds **one net position per user** — this is a netted book, not hedge mode: a user can't hold simultaneous long and short positions in the same market, a fill on the opposite side always nets against the existing one first.

```mermaid
flowchart TD
    FILL["applyOrderFill(order, userId, qty, price, tradeId)"] --> HAS{"User has an open<br/>position in this market?"}
    HAS -- no --> CREATE["createPosition():<br/>margin = ceil(price*qty/leverage)<br/>derive bankruptcy & liquidation price"]
    HAS -- yes --> SIDE{"Fill side ==<br/>position side?"}
    SIDE -- yes, adding --> ADD["VWAP-blend averagePrice,<br/>sum qty & margin,<br/>re-derive fields, re-index liq price"]
    SIDE -- no, reducing --> QTY{"fillQty vs<br/>currentQty?"}
    QTY -- "< (partial close)" --> PARTIAL["release proportional margin+PnL,<br/>shrink qty & margin,<br/>re-derive & re-index"]
    QTY -- "== (exact close)" --> CLOSE["release all margin+PnL,<br/>delete position,<br/>emit ClosedPositionUpdate"]
    QTY -- "> (flip)" --> FLIP["close old position entirely (as above)<br/>+ open a brand-new position on the<br/>other side sized to the excess qty"]

    CREATE --> IDX["addLiquidationIndex()"]
    ADD --> DONE
    PARTIAL --> DONE
    CLOSE --> DONE
    FLIP --> DONE2["createPosition() for the flipped remainder"]
    IDX --> DONE(["capturePosition() -> UpdateManagerEngine"])
    DONE2 --> DONE
```

**Derived fields**, recomputed on every mutation (`updateDerivedFields`):

- `effectiveLeverage = ceil(notional / margin)`
- `bankruptcyPrice`: the price at which margin hits exactly zero — `price` moved against you by `margin / qty`
- `liquidationPrice`: `90%` of that same distance — a maintenance-margin buffer so liquidation fires *before* actual bankruptcy, leaving room for the liquidation order itself to fill

Both use `applyLossMove`: for a **long**, an adverse move is the price going *down* (`max(price - move, 0)`); for a **short**, it's the price going *up* (`price + move`).

**Liquidation index.** Every position is bucketed by its exact `liquidationPrice` into `Map<liquidationPrice, Set<positionId>>` (`longPositionBucket`/`shortPositionBucket`), with each distinct price also inserted into a red-black tree (`longPositionTree`/`shortPositionTree`). This means "which positions are liquidatable at index price X" is a single ordered range query — **all longs with `liquidationPrice >= indexPrice`, all shorts with `liquidationPrice <= indexPrice`** — instead of a scan over every open position on every price tick (`getLiquidatablePositions`). Any mutation that changes margin or quantity must remove-then-reinsert the position in this index, since its liquidation price shifts.

---

## 9. Deep dive: Index price update, liquidation & ADL

`ws-index-poller` subscribes to Binance's mark-price stream, maps Binance symbols to internal market symbols (`BTCUSDT -> BTC_PERP`, etc.), and publishes an `INDEX_PRICE_UPDATE_EVENT` (source `WS`) on essentially every tick (~1/s per market).

```mermaid
sequenceDiagram
    participant BN as Binance mark-price WS
    participant POLL as ws-index-poller
    participant R as engine.request
    participant E as Engine.indexPriceUpdate
    participant POS as PositionMatchingEngine
    participant C as Engine.createOrder
    participant ADL as PositionMatchingEngine.triggerADL

    BN->>POLL: markPrice tick
    POLL->>R: xAdd INDEX_PRICE_UPDATE_EVENT{symbol, indexPrice}
    R->>E: process(event)
    E->>POS: getLiquidPositions(payload)
    POS->>POS: update marketRisk.indexPrice<br/>getLiquidatablePositions(indexPrice)<br/>(RB-tree range query, see §8)
    POS-->>E: UserPositionType[]

    loop each liquidatable position
        E->>C: createOrder({ reduceOnly:true, liquidation:true,<br/>type:MARKET, TIF:IOC, STP:CANCEL_TAKER,<br/>side:opposite, quantity:position.quantity })
        Note over C: same pipeline as §6 — matched against<br/>the live book at a flat 50bps fee
        alt order failed (e.g. no liquidity)
            C-->>E: success:false -> counted as failure, skip
        else remainingQuantity > 0 after fill (book too thin)
            C-->>E: success:true, partial
            E->>ADL: triggerADL(symbol, userId, side,<br/>unfilledQty, bankruptcyPrice, tradeId)
        else fully closed
            C-->>E: success:true
        end
    end

    E-->>R: response (published only if updates non-empty,<br/>see §1 suppression rule)
```

**Auto-Deleverage (ADL).** When the order book doesn't have enough opposite-side liquidity to fully close a liquidated position at the index price, the engine doesn't let it sit half-liquidated — it force-closes the most-profitable opposite-side positions directly, bypassing the order book entirely:

- `getADLCandidates(oppositeSide, referencePrice)` returns every open position on the opposite side, **sorted by descending unrealized PnL** — the traders currently most profitable against the liquidated user's side get force-closed first.
- For each candidate (skipping the liquidated user themself), a synthetic fill is applied directly via `PositionEngine.applyOrderFill` for *both* the liquidated user and the candidate, at the liquidated position's **bankruptcy price** (not the index price — this guarantees the liquidated side nets to exactly zero margin rather than manufacturing extra loss/gain), until the unfilled quantity is exhausted or candidates run out.
- If ADL still can't fully close the position (no opposite-side exposure left anywhere in the market), the shortfall is logged (`console.error`) and the position is left open, underwater, for the next price tick to retry.

Synthetic liquidation and ADL orders are tagged `liquidation: true` / `adl: true` on the resulting order/position, which surfaces downstream as `closeReason: "LIQUIDATED" | "ADL" | "CLOSED"` on the `ClosedPositionUpdate` emitted by `PositionEngine.emitClosedPosition`.

---

## 10. Deep dive: Funding settlement

`ws-index-poller` also fires a `FUNDING_RATE_UPDATE_EVENT` per known market on a `setInterval` (`FUNDING_INTERVAL_SECONDS`, default 3600s / 1h).

```mermaid
sequenceDiagram
    participant POLL as ws-index-poller (interval timer)
    participant R as engine.request
    participant E as Engine.processFundingSettlment
    participant POS as PositionMatchingEngine
    participant PE as PositionEngine
    participant FM as FundManagementEngine

    POLL->>R: xAdd FUNDING_RATE_UPDATE_EVENT{symbol, intervalSeconds}
    R->>E: process(event)
    E->>POS: onFundingSettlement(payload)
    POS->>POS: premiumBps = (indexPrice - markPrice)<br/>/ indexPrice * 10_000, clamped to [-1, 1]
    POS->>PE: applyFunding(fundingRateBps, now)

    loop each open position in the market
        PE->>PE: amount = averagePrice * qty * |rateBps| / 10_000
        alt rate > 0
            Note over PE: LONGs pay, SHORTs receive
        else rate < 0
            Note over PE: SHORTs pay, LONGs receive
        end
        alt this position is on the paying side
            PE->>PE: deduct min(amount, position.margin) from margin
            alt amount > margin (can't fully pay)
                PE->>FM: useInsuranceFund(symbol, deficit)
            end
        else receiving side
            PE->>PE: credit amount to margin (+ user's quote balance)
        end
        PE->>PE: re-derive bankruptcy/liquidation price,<br/>re-index (margin changed)
        PE->>PE: push FundingPayment record
    end

    POS->>POS: getLiquidatablePositions(indexPrice) again<br/>(paying side may now be underwater)
    POS-->>E: { payments, usedInsuranceFund, liquidatablePositions }
    E->>E: executeLiquidation(liquidatablePositions, ...)
    Note over E: identical liquidation/ADL cascade as §9
```

The funding rate model here is intentionally simple: it's a single point-in-time premium between mark and index price, clamped to ±1 bps per interval — not the multi-sample time-weighted average that live exchanges typically use. Every position pays/receives proportionally to its own notional (`averagePrice * quantity`), and a payer who can't fully cover their obligation from margin has the shortfall absorbed by that market's insurance fund rather than going negative. Because margin changes for every position touched, liquidation eligibility is re-checked immediately after settlement — a funding payment can itself trigger a liquidation/ADL cascade.

---

## 11. Deep dive: Commission & Insurance funds

`FundManagementEngine` ([`src/engine/fund-management-engine.ts`](src/engine/fund-management-engine.ts)) tracks two running totals **per market**: `commissionFunds` (house revenue) and `insuranceFunds` (loss-absorption buffer).

```mermaid
flowchart LR
    FEE["Trading fee collected<br/>(spot or perp maker/taker fill,<br/>see fee tiers in §7)"] --> SPLIT{"addCommissionFee(symbol, amount)"}
    SPLIT -- "70%" --> INS[("insuranceFunds[symbol]")]
    SPLIT -- "30%" --> COM[("commissionFunds[symbol]")]

    INS --> DEFICIT["useInsuranceFund(symbol, amount)"]
    DEFICIT -.-> LIQ["Liquidation bad debt<br/>(releasePerpCollateral deficit)"]
    DEFICIT -.-> FUND["Funding payment shortfall<br/>(payer's margin insufficient)"]

    DEFICIT --> CHECK{"available < requested?"}
    CHECK -- yes --> REJECT["INSURANCE_FUND_DEPLETED<br/>-> order rejected, book/position<br/>snapshot rolled back (§6)"]
    CHECK -- no --> DRAW["fund debited, deficit covered"]
```

**Every trading fee is split 70% to insurance / 30% to commission** — the insurance fund is not a separate deposit, it's funded passively out of ordinary trading activity, and gets drawn down during liquidation cascades or funding shortfalls. If a liquidation's bad debt would exceed what the insurance fund can currently cover, `BalanceEngine.releasePerpCollateral` rejects with `INSURANCE_FUND_DEPLETED` *before* debiting anything — the synthetic liquidation order then fails in `createOrder`, its book/position mutations are rolled back via the snapshot mechanism (§6), and the still-underwater position is left for a later price tick / ADL pass.

Every change to either fund is captured via `UpdateManagerEngine.captureCommission(symbol, commissionFund, insuranceFund)`, which is how `commissions` shows up in the outbound update bundle (§12).

---

## 12. Deep dive: the update bundle (depths, tickers, mark price, updates fan-out)

`UpdateManagerEngine` ([`src/engine/update-manager-engine.ts`](src/engine/update-manager-engine.ts)) is a per-event scratch buffer, not persistent state. Every sub-engine calls one of its `capture*` methods as it mutates `EngineState`; at the very end of `Engine.process`, `consume()` drains everything captured into a single `BaseUpdate` object, attaches it to the response as `.updates`, and clears the buffer for the next event. On any thrown error, `reset()` is called instead — discarding whatever was captured, so a failed request can never leak a partial update downstream.

```mermaid
flowchart TD
    subgraph Capture["captured during one Engine.process() call"]
        ASSET["captureAsset/captureMarket/captureUser<br/>(admin ops)"]
        BALU["captureBalanceUpdate<br/>(every lock/release/fill, per user+asset,<br/>with an attached transaction log entry)"]
        ORD["captureOrders(orders, currentOrder, market)<br/>(every order touched this tick)"]
        POSU["capturePosition / captureClosedPosition"]
        FUND["captureFundingTransaction"]
        COMM["captureCommission"]
    end

    ORD --> DEPTH["mergeDepthLevels():<br/>walks every touched order's own<br/>order.depth.bids/asks, keeps the<br/>LAST quantity seen per price<br/>-> one clean delta set per symbol"]
    ORD --> TRADES["trades: Map&lt;tradeId, fill&gt;<br/>deduped across all touched orders"]
    TRADES --> TICKER["buildTickerUpdate(): first/last/high/low/<br/>volume/%change computed ONLY from<br/>THIS tick's fills — not a rolling 24h window"]
    TRADES --> MARK["buildMarkPriceUpdate(): PERP markets only,<br/>= latest trade price this tick"]

    Capture --> CONSUME["consume()"]
    DEPTH --> CONSUME
    TICKER --> CONSUME
    MARK --> CONSUME
    CONSUME --> BUNDLE["BaseUpdate {<br/>  asset?, market?, user?,<br/>  orders?, trades?,<br/>  balances?, positions?, closedPositions?,<br/>  fundingTransactions?, commissions?,<br/>  depths?, tickers?, markPrices?<br/>}"]
    BUNDLE --> RESP["attached to response.updates"]
    RESP --> PUB["published to engine.response<br/>(subject to the §1 suppression rule)"]
```

Two things worth being precise about, since they're easy to misread from the field names alone:

- **`tickers` is per-tick, not rolling.** `buildTickerUpdate` computes first/last/high/low/volume/priceChange purely from the trades generated by *this specific event* (e.g. the fills from one `createOrder` call). It is not a maintained 24h rolling ticker — a consumer wanting a rolling ticker needs to aggregate these increments itself.
- **`depths` is a delta, not a snapshot.** It only contains the price levels actually touched by orders in this tick, each carrying the *resulting* quantity at that level (`0` means the level emptied out and should be removed downstream). A consumer needing the full book state uses `GET_MARKET_DEPTH` (§5) to seed itself once, then applies these deltas.

`discardBalanceUpdates()` is a narrower version of `reset()`, used specifically by `BalanceEngine.releaseBalance` when an order is rolled back after its initial lock succeeded — it wipes only the buffered balance-transaction log for that failed call, since a rolled-back order should never appear to have moved anyone's balance.

---

## 13. Event catalog

Every `EVENT_SUBJECT` the engine's `process()` switch handles (`@workspace/shared`):

| Subject | Handler | Mutates state? |
|---|---|---|
| `engine.heath.check` | `healtCheck` | no |
| `engine.asset.add` / `.update` / `.delete` | `addAsset` / `updateAsset` / `deleteAsset` | yes (admin) |
| `engine.market.add` / `.update` / `.delete` | `addMarket` / `updateMarket` / `deleteMarket` | yes (admin) |
| `engine.user.add` | `addUser` | yes |
| `engine.balance.get` | `getUserBalances` | no |
| `engine.balance.onramp` / `.offramp` | `onRampBalance` / `offRampBalance` | yes |
| `engine.order.create` | `createOrder` | yes — see [§6](#6-deep-dive-create-order) |
| `engine.order.cancel` | `cancelOrder` | yes |
| `engine.order.open.one` / `.all` | `getOneOpenOrder` / `getAllOpenOrder` | no |
| `engine.order.open.delete` | `deleteAllOpenOrder` | yes (cancels every open order for a user in a market) |
| `engine.depth.get` | `getMarketDepth` | no |
| `engine.indexprice.update` | `indexPriceUpdate` | yes — see [§9](#9-deep-dive-index-price-update-liquidation--adl) |
| `engine.fundingrate.update` | `processFundingSettlment` | yes — see [§10](#10-deep-dive-funding-settlement) |
| `engine.marketrisk.get.one` / `engine.markprice.get.all` | `getOneMarketRisk` / `getAllMarketRisk` | no |
| `engine.openinterest.get.one` / `.all` | `getOneMarketOpenInterest` / `getAllMarketOpenInterest` | no |

---

## 14. Error handling

All rejections are typed via `EVENT_REJECT_CODES` (`@workspace/shared/types/engine.ts`) and thrown as `RejectError` (`src/utils/error.ts`), caught at the handler level and turned into a `success: false` response carrying `rejectCode` + a human-readable `message`. Validation codes are almost entirely produced by `OMSEngine` (`src/engine/oms-engine.ts`), which is deliberately kept stateless-and-pure — it only *reads* `EngineState` to check constraints, it never mutates. This means every `createOrderCheck`/`cancelOrderCheck` failure is guaranteed to happen before any balance lock, book mutation, or update is captured, so the common-case rejection path (bad input) never needs a rollback at all — rollback (§6's snapshot/restore) only exists for failures that occur *after* mutation has already started.
