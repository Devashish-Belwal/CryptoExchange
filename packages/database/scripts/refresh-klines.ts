import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

// CALL refresh_continuous_aggregate(...) manages its own transactions
// internally and cannot run inside a wrapped transaction, so this connects
// directly with `pg` instead of going through Prisma.
const sqlPath = fileURLToPath(new URL("../prisma/refresh-continuous-aggregates.sql", import.meta.url));
const statements = readFileSync(sqlPath, "utf-8")
    .split("\n")
    .filter((line) => line.trim().startsWith("CALL "));

const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();

for (const statement of statements) {
    console.log(`Running: ${statement}`);
    await client.query(statement);
}

await client.end();

console.log("Backfilled all kline continuous aggregates.");
