-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('LIMIT', 'MARKET');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'PARTIAL_FILLED', 'PARTIAL_REJECTED', 'FILLED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "STPMode" AS ENUM ('CANCEL_MAKER', 'CANCEL_TAKER', 'CANCEL_BOTH');

-- CreateEnum
CREATE TYPE "TimeInForce" AS ENUM ('GTC', 'IOC', 'FOK');

-- CreateEnum
CREATE TYPE "FillStatus" AS ENUM ('TRADE', 'STP');

-- CreateEnum
CREATE TYPE "PositionSide" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "PositionCloseReason" AS ENUM ('CLOSED', 'LIQUIDATED', 'ADL');

-- CreateEnum
CREATE TYPE "FundType" AS ENUM ('INSURANCE', 'COMMISSION');

-- CreateEnum
CREATE TYPE "FundTransactionType" AS ENUM ('TRADE_FEE', 'FUNDING_DEFICIT', 'LIQUIDATION_COVERAGE', 'ADJUSTMENT');

-- AlterEnum
ALTER TYPE "TransactionSide" ADD VALUE 'TRANSFER';

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'LOCK';

-- AlterTable
ALTER TABLE "BalanceTransaction" ADD COLUMN     "marketSymbol" TEXT,
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "tradeId" TEXT;

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "marketType" "MarketType" NOT NULL,
    "side" "OrderSide" NOT NULL,
    "type" "OrderType" NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "timeInForce" "TimeInForce" NOT NULL,
    "stpMode" "STPMode" NOT NULL,
    "postOnly" BOOLEAN NOT NULL DEFAULT false,
    "reduceOnly" BOOLEAN NOT NULL DEFAULT false,
    "liquidation" BOOLEAN NOT NULL DEFAULT false,
    "entryPrice" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "remainingQuantity" TEXT NOT NULL,
    "filledQuantity" TEXT NOT NULL DEFAULT '0',
    "averagePrice" TEXT NOT NULL DEFAULT '0',
    "leverage" INTEGER,
    "margin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "tradeId" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "status" "FillStatus" NOT NULL DEFAULT 'TRADE',
    "takerOrderId" TEXT NOT NULL,
    "takerUserId" TEXT NOT NULL,
    "takerFee" TEXT NOT NULL DEFAULT '0',
    "makerOrderId" TEXT NOT NULL,
    "makerUserId" TEXT NOT NULL,
    "makerFee" TEXT NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" "PositionSide" NOT NULL,
    "leverage" INTEGER NOT NULL,
    "entryPrice" TEXT NOT NULL,
    "exitPrice" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "margin" TEXT NOT NULL,
    "realizedPnl" TEXT NOT NULL,
    "closeReason" "PositionCloseReason" NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Liquidation" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "bankruptcyPrice" TEXT NOT NULL,
    "liquidationPrice" TEXT NOT NULL,
    "markPrice" TEXT NOT NULL,
    "deficit" TEXT NOT NULL DEFAULT '0',
    "insuranceCovered" TEXT NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Liquidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingPayment" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "fundingRateBps" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fund" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "type" "FundType" NOT NULL,
    "balance" TEXT NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundTransaction" (
    "id" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "type" "FundType" NOT NULL,
    "side" "TransactionSide" NOT NULL,
    "reason" "FundTransactionType" NOT NULL,
    "amount" TEXT NOT NULL,
    "tradeId" TEXT,
    "positionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderId_key" ON "Order"("orderId");

-- CreateIndex
CREATE INDEX "Order_userId_symbol_idx" ON "Order"("userId", "symbol");

-- CreateIndex
CREATE INDEX "Order_userId_status_idx" ON "Order"("userId", "status");

-- CreateIndex
CREATE INDEX "Order_symbol_status_idx" ON "Order"("symbol", "status");

-- CreateIndex
CREATE INDEX "Trade_takerUserId_idx" ON "Trade"("takerUserId");

-- CreateIndex
CREATE INDEX "Trade_makerUserId_idx" ON "Trade"("makerUserId");

-- CreateIndex
CREATE INDEX "Trade_symbol_createdAt_idx" ON "Trade"("symbol", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_symbol_tradeId_key" ON "Trade"("symbol", "tradeId");

-- CreateIndex
CREATE UNIQUE INDEX "Position_positionId_key" ON "Position"("positionId");

-- CreateIndex
CREATE INDEX "Position_userId_symbol_idx" ON "Position"("userId", "symbol");

-- CreateIndex
CREATE INDEX "Position_symbol_closedAt_idx" ON "Position"("symbol", "closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Liquidation_positionId_key" ON "Liquidation"("positionId");

-- CreateIndex
CREATE INDEX "Liquidation_userId_idx" ON "Liquidation"("userId");

-- CreateIndex
CREATE INDEX "Liquidation_symbol_createdAt_idx" ON "Liquidation"("symbol", "createdAt");

-- CreateIndex
CREATE INDEX "FundingPayment_userId_symbol_idx" ON "FundingPayment"("userId", "symbol");

-- CreateIndex
CREATE INDEX "FundingPayment_symbol_createdAt_idx" ON "FundingPayment"("symbol", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Fund_symbol_type_key" ON "Fund"("symbol", "type");

-- CreateIndex
CREATE INDEX "FundTransaction_symbol_type_idx" ON "FundTransaction"("symbol", "type");

-- CreateIndex
CREATE INDEX "FundTransaction_fundId_createdAt_idx" ON "FundTransaction"("fundId", "createdAt");

-- CreateIndex
CREATE INDEX "BalanceTransaction_orderId_idx" ON "BalanceTransaction"("orderId");

-- AddForeignKey
ALTER TABLE "BalanceTransaction" ADD CONSTRAINT "BalanceTransaction_marketSymbol_fkey" FOREIGN KEY ("marketSymbol") REFERENCES "Market"("symbol") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceTransaction" ADD CONSTRAINT "BalanceTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("orderId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Market"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Market"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_takerOrderId_fkey" FOREIGN KEY ("takerOrderId") REFERENCES "Order"("orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_makerOrderId_fkey" FOREIGN KEY ("makerOrderId") REFERENCES "Order"("orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Market"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidation" ADD CONSTRAINT "Liquidation_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("positionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidation" ADD CONSTRAINT "Liquidation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidation" ADD CONSTRAINT "Liquidation_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Market"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingPayment" ADD CONSTRAINT "FundingPayment_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Market"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingPayment" ADD CONSTRAINT "FundingPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fund" ADD CONSTRAINT "Fund_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Market"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundTransaction" ADD CONSTRAINT "FundTransaction_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
