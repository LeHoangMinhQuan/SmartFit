require("dotenv").config();
const { DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME } = process.env;
/**
 * @type { import("knex").Knex.Config }
 */
module.exports = {
  client: "pg",
  connection: {
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
  },
  searchPath: ["project"],
  pool: {
    min: 0,
    max: 10,
    afterCreate: (conn, done) => {
      conn.query("SET search_path TO 'project'", (err) => {
        done(err, conn);
      });
    },
  },
  seeds: {
    directory: "./seeds",
  },
};
