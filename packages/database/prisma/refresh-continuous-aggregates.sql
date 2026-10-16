-- Run once, manually, after applying the 20260719120000_add_timescaledb_klines
-- migration. CALL refresh_continuous_aggregate(...) manages its own
-- transactions internally, so it cannot run inside the migration.sql
-- transaction -- that's why this lives in a separate file.
--
-- Usage: bun run refresh:klines   (see packages/database/package.json)

CALL refresh_continuous_aggregate('kline_candles_1m', NULL, NULL);
CALL refresh_continuous_aggregate('kline_candles_5m', NULL, NULL);
CALL refresh_continuous_aggregate('kline_candles_15m', NULL, NULL);
CALL refresh_continuous_aggregate('kline_candles_30m', NULL, NULL);
CALL refresh_continuous_aggregate('kline_candles_1h', NULL, NULL);
CALL refresh_continuous_aggregate('kline_candles_4h', NULL, NULL);
CALL refresh_continuous_aggregate('kline_candles_1d', NULL, NULL);
CALL refresh_continuous_aggregate('kline_candles_1w', NULL, NULL);
