/*
  Warnings:

  - A unique constraint covering the columns `[userId,symbol]` on the table `Balance` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Balance_symbol_key";

-- CreateIndex
CREATE INDEX "Balance_userId_symbol_idx" ON "Balance"("userId", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "Balance_userId_symbol_key" ON "Balance"("userId", "symbol");

-- AddForeignKey
ALTER TABLE "Balance" ADD CONSTRAINT "Balance_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
