/**
 * config/db.ts
 *
 * Shared Knex instance for the application.
 */

import knex from "knex";
import { knexConfig } from "./knex-config.js";

const db = knex(knexConfig);

export default db;

/**
 * Ping the database. Throws if the connection cannot be established.
 */
export async function checkDbConnection(): Promise<void> {
  await db.raw("SELECT 1");
}
