const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL Connection Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

// Mock Prisma Client structure using PostgreSQL
const db = {
    user: {
        findMany: async() => {
            const result = await pool.query('SELECT * FROM "USERS"');

            return result.rows.map(r => ({
                ...r,
                id: r.id.toString(),
                passwordHash: r.password_hash || r.passwordHash
            }));
        },

        findFirst: async(params) => {
            const whereClause = params && params.where;

            if (!whereClause) return null;

            const keys = Object.keys(whereClause);

            if (keys.length === 0) return null;

            const key = keys[0];
            const value = whereClause[key];

            const query = `SELECT * FROM "USERS" WHERE "${key}" = $1 LIMIT 1`;

            const result = await pool.query(query, [value]);

            if (result.rows.length === 0) return null;

            const r = result.rows[0];

            return {
                ...r,
                id: r.id.toString(),
                passwordHash: r.password_hash || r.passwordHash
            };
        },

        // 👉 បន្ថែម findUnique ជំនួស Prisma
        findUnique: async(params) => {
            const whereClause = params && params.where;
            if (!whereClause) return null;

            const keys = Object.keys(whereClause);
            if (keys.length === 0) return null;

            const key = keys[0];
            const value = whereClause[key];

            // កែសម្រួល Field id ឱ្យត្រូវជាមួយ Database (ឧ. id អាចជា integer ឬ string)
            const query = `SELECT * FROM "USERS" WHERE "${key}" = $1 LIMIT 1`;
            const result = await pool.query(query, [value]);

            if (result.rows.length === 0) return null;

            const r = result.rows[0];
            return {
                ...r,
                id: r.id.toString(),
                passwordHash: r.password_hash || r.passwordHash
            };
        },

        // 👉 បន្ថែម update ជំនួស Prisma
        update: async(params) => {
            const whereClause = params && params.where;
            const data = params && params.data;

            if (!whereClause || !data) return null;

            const id = whereClause.id;
            const status = data.status;

            const query = `UPDATE "USERS" SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
            const result = await pool.query(query, [status, id]);

            if (result.rows.length === 0) return null;

            const r = result.rows[0];
            return {
                ...r,
                id: r.id.toString(),
                passwordHash: r.password_hash || r.passwordHash
            };
        }
    },

    pool
};

module.exports = db;