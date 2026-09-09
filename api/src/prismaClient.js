const mysql = require('mysql2/promise');
require('dotenv').config();

// បង្កើត MySQL Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '312007',
    database: process.env.DB_NAME || 'FOODTODAY',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Mock Prisma Client structure using mysql2
const db = {
    user: {
        findMany: async() => {
            const [rows] = await pool.query('SELECT * FROM USERS');
            return rows.map(r => ({
                ...r,
                id: r.id.toString(),
                passwordHash: r.password_hash || r.passwordHash
            }));
        },
        findFirst: async(params) => {
            const whereClause = params && params.where;
            if (!whereClause) return null;
            const keys = Object.keys(whereClause);
            const values = Object.values(whereClause);
            const query = `SELECT * FROM USERS WHERE ${keys[0]} = ? LIMIT 1`;
            const [rows] = await pool.query(query, values);
            if (rows.length === 0) return null;
            const r = rows[0];
            return {
                ...r,
                id: r.id.toString(),
                passwordHash: r.password_hash || r.passwordHash
            };
        }
    },
    pool
};

// ត្រូវមានអក្សរ 's' ត្រង់ module.exports
module.exports = db;