-- Enable TimescaleDB (one-time, per-database).
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- CreateTable
-- Append-only tick log, populated by the trigger below on every "Trade"
-- insert. It deliberately has no primary key or unique constraint: a
-- hypertable requires every unique index (PK included) to contain the time
-- partitioning column, and this table has no need for row-level uniqueness
-- (unlike "Trade", whose (symbol, tradeId) upsert key is relied on for
-- idempotent fill application in database-engine and can't include the
-- time column either -- which is exactly why klines are sourced from this
-- separate table instead of "Trade" directly).
CREATE TABLE "TradeTick" (
    "id" BIGSERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE INDEX "TradeTick_symbol_createdAt_idx" ON "TradeTick"("symbol", "createdAt");

-- Convert "TradeTick" into a hypertable partitioned by time. migrate_data
-- isn't needed here since the table is freshly created and empty.
SELECT create_hypertable('"TradeTick"', by_range('createdAt'));

-- Mirror every "Trade" insert into "TradeTick". This keeps "Trade" and its
-- upsert-based fill-dedup logic in database-engine completely untouched --
-- application code never writes to "TradeTick" directly.
CREATE FUNCTION trade_tick_fn() RETURNS trigger AS $$
BEGIN
    INSERT INTO "TradeTick" (symbol, price, quantity, "createdAt")
    VALUES (NEW.symbol, NEW.price, NEW.quantity, NEW."createdAt");
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trade_tick_trigger
AFTER INSERT ON "Trade"
FOR EACH ROW EXECUTE FUNCTION trade_tick_fn();

-- One continuous aggregate (materialized view) per kline interval, built off
-- "TradeTick" rather than "Trade" directly (see above for why). WITH NO DATA
-- defers the initial materialization so this migration doesn't block on
-- aggregating historical data -- run refresh-continuous-aggregates.sql once
-- after this migration is applied to backfill them.

CREATE MATERIALIZED VIEW kline_candles_1m
WITH (timescaledb.continuous) AS
SELECT
    symbol,
    time_bucket('1 minute', "createdAt") AS bucket,
    first(price::numeric, "createdAt")   AS open,
    max(price::numeric)                  AS high,
    min(price::numeric)                  AS low,
    last(price::numeric, "createdAt")    AS close,
    sum(quantity::numeric)               AS volume,
    count(*)                             AS trade_count
FROM "TradeTick"
GROUP BY symbol, bucket
WITH NO DATA;

CREATE MATERIALIZED VIEW kline_candles_5m
WITH (timescaledb.continuous) AS
SELECT
    symbol,
    time_bucket('5 minutes', "createdAt") AS bucket,
    first(price::numeric, "createdAt")    AS open,
    max(price::numeric)                   AS high,
    min(price::numeric)                   AS low,
    last(price::numeric, "createdAt")     AS close,
    sum(quantity::numeric)                AS volume,
    count(*)                              AS trade_count
FROM "TradeTick"
GROUP BY symbol, bucket
WITH NO DATA;

CREATE MATERIALIZED VIEW kline_candles_15m
WITH (timescaledb.continuous) AS
SELECT
    symbol,
    time_bucket('15 minutes', "createdAt") AS bucket,
    first(price::numeric, "createdAt")     AS open,
    max(price::numeric)                    AS high,
    min(price::numeric)                    AS low,
    last(price::numeric, "createdAt")      AS close,
    sum(quantity::numeric)                 AS volume,
    count(*)                               AS trade_count
FROM "TradeTick"
GROUP BY symbol, bucket
WITH NO DATA;

CREATE MATERIALIZED VIEW kline_candles_30m
WITH (timescaledb.continuous) AS
SELECT
    symbol,
    time_bucket('30 minutes', "createdAt") AS bucket,
    first(price::numeric, "createdAt")     AS open,
    max(price::numeric)                    AS high,
    min(price::numeric)                    AS low,
    last(price::numeric, "createdAt")      AS close,
    sum(quantity::numeric)                 AS volume,
    count(*)                               AS trade_count
FROM "TradeTick"
GROUP BY symbol, bucket
WITH NO DATA;

CREATE MATERIALIZED VIEW kline_candles_1h
WITH (timescaledb.continuous) AS
SELECT
    symbol,
    time_bucket('1 hour', "createdAt")   AS bucket,
    first(price::numeric, "createdAt")   AS open,
    max(price::numeric)                  AS high,
    min(price::numeric)                  AS low,
    last(price::numeric, "createdAt")    AS close,
    sum(quantity::numeric)               AS volume,
    count(*)                             AS trade_count
FROM "TradeTick"
GROUP BY symbol, bucket
WITH NO DATA;

CREATE MATERIALIZED VIEW kline_candles_4h
WITH (timescaledb.continuous) AS
SELECT
    symbol,
    time_bucket('4 hours', "createdAt")  AS bucket,
    first(price::numeric, "createdAt")   AS open,
    max(price::numeric)                  AS high,
    min(price::numeric)                  AS low,
    last(price::numeric, "createdAt")    AS close,
    sum(quantity::numeric)               AS volume,
    count(*)                             AS trade_count
FROM "TradeTick"
GROUP BY symbol, bucket
WITH NO DATA;

CREATE MATERIALIZED VIEW kline_candles_1d
WITH (timescaledb.continuous) AS
SELECT
    symbol,
    time_bucket('1 day', "createdAt")    AS bucket,
    first(price::numeric, "createdAt")   AS open,
    max(price::numeric)                  AS high,
    min(price::numeric)                  AS low,
    last(price::numeric, "createdAt")    AS close,
    sum(quantity::numeric)               AS volume,
    count(*)                             AS trade_count
FROM "TradeTick"
GROUP BY symbol, bucket
WITH NO DATA;

CREATE MATERIALIZED VIEW kline_candles_1w
WITH (timescaledb.continuous) AS
SELECT
    symbol,
    time_bucket('1 week', "createdAt")   AS bucket,
    first(price::numeric, "createdAt")   AS open,
    max(price::numeric)                  AS high,
    min(price::numeric)                  AS low,
    last(price::numeric, "createdAt")    AS close,
    sum(quantity::numeric)               AS volume,
    count(*)                             AS trade_count
FROM "TradeTick"
GROUP BY symbol, bucket
WITH NO DATA;

-- Refresh policies: tell TimescaleDB how often to materialize new buckets
-- and how far back to look. end_offset roughly tracks the bucket width so a
-- still-forming bucket is never materialized as "final".

SELECT add_continuous_aggregate_policy('kline_candles_1m',
    start_offset => INTERVAL '1 hour',
    end_offset   => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute');

SELECT add_continuous_aggregate_policy('kline_candles_5m',
    start_offset => INTERVAL '3 hours',
    end_offset   => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '5 minutes');

SELECT add_continuous_aggregate_policy('kline_candles_15m',
    start_offset => INTERVAL '6 hours',
    end_offset   => INTERVAL '15 minutes',
    schedule_interval => INTERVAL '15 minutes');

SELECT add_continuous_aggregate_policy('kline_candles_30m',
    start_offset => INTERVAL '12 hours',
    end_offset   => INTERVAL '30 minutes',
    schedule_interval => INTERVAL '30 minutes');

SELECT add_continuous_aggregate_policy('kline_candles_1h',
    start_offset => INTERVAL '1 day',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('kline_candles_4h',
    start_offset => INTERVAL '3 days',
    end_offset   => INTERVAL '4 hours',
    schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('kline_candles_1d',
    start_offset => INTERVAL '7 days',
    end_offset   => INTERVAL '1 day',
    schedule_interval => INTERVAL '6 hours');

SELECT add_continuous_aggregate_policy('kline_candles_1w',
    start_offset => INTERVAL '30 days',
    end_offset   => INTERVAL '1 week',
    schedule_interval => INTERVAL '1 day');
