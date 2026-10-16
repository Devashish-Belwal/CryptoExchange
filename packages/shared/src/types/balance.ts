
export type BalanceLedger = {
    allotted: string;
    used: string;
    released: string;
}

export type InMarketBalanceLedger = {
    allotted: number;
    used: number;
    released: number;
}

export type BalanceType = Map<string, BaseBalanceType>

export type BaseBalanceType = Map<string, { total: number, locked: number }>

export type BalanceReturnType = Record<string, { total: number, locked: number }>

export enum BalanceChangeType {
    LOCK = "LOCK",
    TRADE = "TRADE",
    RELEASE = "RELEASE",
    TRANSACTION = "TRANSACTION",
}

export enum BalanceChangeSide {
    DEBIT = "DEBIT",
    CREDIT = "CREDIT",
    TRANSFER = "TRANSFER",
}

export type BalanceUpdateType = {
    userId: string;
    symbol: string;
    total: number;
    locked: number;
    transactions: BalanceUpdateTransactionType[]
}

export type BalanceUpdateTransactionType = {
    userId: string;
    symbol: string;
    side: BalanceChangeSide,
    type: BalanceChangeType,
    amount: string;
    marketSymbol?: string;
    orderId?: string;
    tradeId?: string;
    timestamp: number;
}

