import { type Knex } from "knex";
import { env } from "./env.js";
const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = env;

/**
 * @type { import("knex").Knex.Config }
 */
export const knexConfig: Knex.Config = {
  client: "pg",
  connection: {
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  },
  searchPath: ["project"],
  pool: {
    min: 0,
    max: 10,
    // afterCreate: (conn, done) => {
    //   conn.query("SET search_path TO 'project'", (err) => {
    //     done(err, conn);
    //   });
    // },
  },
  seeds: {
    directory: "./seeds",
  },
};
