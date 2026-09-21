const { Pool } = require('pg');
require('dotenv').config();

// =========================================================
// PostgreSQL Connection Pool
// =========================================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    ssl: {
        rejectUnauthorized: false
    },

    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});


// =========================================================
// Helper: Convert PostgreSQL User row
// =========================================================

function mapUserRow(row) {
    if (!row) return null;

    return {
        ...row,

        // Database:
        // id BIGINT
        //
        // Convert BigInt to string so JSON.stringify()
        // will not throw BigInt serialization error.
        id: row.id.toString(),

        // Prisma-style field name
        passwordHash: row.password_hash || row.passwordHash,

        // Prisma-style camelCase fields
        joinedAt: row.joined_at,
        inactiveAt: row.inactive_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,

        // FCM token
        fcmToken: row.fcmToken
    };
}


// =========================================================
// Mock Prisma Client using PostgreSQL
// =========================================================

const db = {

    // =====================================================
    // USER
    // =====================================================

    user: {

        // -------------------------------------------------
        // findMany
        // -------------------------------------------------

        findMany: async (params = {}) => {

            let query = 'SELECT * FROM "USERS"';
            const values = [];

            // Support simple where conditions
            if (params.where) {

                const keys = Object.keys(params.where);

                if (keys.length > 0) {

                    const conditions = keys.map((key, index) => {

                        values.push(params.where[key]);

                        return `"${key}" = $${index + 1}`;

                    });

                    query += ` WHERE ${conditions.join(' AND ')}`;
                }
            }

            // Support select
            if (params.select) {

                const fields = Object.keys(params.select)
                    .filter(key => params.select[key] === true);

                if (fields.length > 0) {

                    const columnMap = {
                        id: 'id',
                        name: 'name',
                        username: 'username',
                        email: 'email',
                        passwordHash: 'password_hash',
                        role: 'role',
                        status: 'status',
                        joinedAt: 'joined_at',
                        inactiveAt: 'inactive_at',
                        createdAt: 'created_at',
                        updatedAt: 'updated_at',
                        refresh_token: 'refresh_token',
                        fcmToken: '"fcmToken"'
                    };

                    const selectedFields = fields.map(
                        field => columnMap[field] || `"${field}"`
                    );

                    query = query.replace(
                        'SELECT *',
                        `SELECT ${selectedFields.join(', ')}`
                    );
                }
            }

            const result = await pool.query(query, values);

            return result.rows.map(mapUserRow);
        },


        // -------------------------------------------------
        // findFirst
        // -------------------------------------------------

        findFirst: async (params) => {

            const whereClause = params && params.where;

            if (!whereClause) {
                return null;
            }

            const keys = Object.keys(whereClause);

            if (keys.length === 0) {
                return null;
            }

            const conditions = [];
            const values = [];

            keys.forEach((key, index) => {

                conditions.push(`"${key}" = $${index + 1}`);
                values.push(whereClause[key]);

            });

            const query = `
                SELECT *
                FROM "USERS"
                WHERE ${conditions.join(' AND ')}
                LIMIT 1
            `;

            const result = await pool.query(query, values);

            if (result.rows.length === 0) {
                return null;
            }

            return mapUserRow(result.rows[0]);
        },


        // -------------------------------------------------
        // findUnique
        // -------------------------------------------------

        findUnique: async (params) => {

            const whereClause = params && params.where;

            if (!whereClause) {
                return null;
            }

            const keys = Object.keys(whereClause);

            if (keys.length === 0) {
                return null;
            }

            const conditions = [];
            const values = [];

            keys.forEach((key, index) => {

                // Prisma id is BigInt
                if (key === 'id') {
                    values.push(BigInt(whereClause[key]));
                } else {
                    values.push(whereClause[key]);
                }

                conditions.push(`"${key}" = $${index + 1}`);
            });

            const query = `
                SELECT *
                FROM "USERS"
                WHERE ${conditions.join(' AND ')}
                LIMIT 1
            `;

            const result = await pool.query(query, values);

            if (result.rows.length === 0) {
                return null;
            }

            return mapUserRow(result.rows[0]);
        },


        // -------------------------------------------------
        // update
        // -------------------------------------------------

        update: async (params) => {

            const whereClause = params && params.where;
            const data = params && params.data;

            if (!whereClause || !data) {
                return null;
            }

            if (whereClause.id === undefined) {
                throw new Error('User ID is required for update');
            }

            const id = BigInt(whereClause.id);

            const fields = [];
            const values = [];

            // =================================================
            // IMPORTANT:
            //
            // Only update fields that are actually provided.
            //
            // OLD CODE:
            //
            // const status = data.status;
            //
            // UPDATE USERS SET status = $1
            //
            // This caused FCM update to set status = NULL.
            //
            // NEW CODE:
            // Dynamically update only data.status,
            // data.fcmToken, etc.
            // =================================================


            // -------------------------------------------------
            // status
            // -------------------------------------------------

            if (Object.prototype.hasOwnProperty.call(data, 'status')) {

                if (
                    data.status !== 'ACTIVE' &&
                    data.status !== 'INACTIVE' &&
                    data.status !== 'AWAY'
                ) {
                    throw new Error(
                        'Invalid status. Use ACTIVE, INACTIVE, or AWAY'
                    );
                }

                fields.push(`status = $${values.length + 1}`);
                values.push(data.status);
            }


            // -------------------------------------------------
            // fcmToken
            // -------------------------------------------------

            if (Object.prototype.hasOwnProperty.call(data, 'fcmToken')) {

                fields.push(`"fcmToken" = $${values.length + 1}`);
                values.push(data.fcmToken);
            }


            // -------------------------------------------------
            // name
            // -------------------------------------------------

            if (Object.prototype.hasOwnProperty.call(data, 'name')) {

                fields.push(`name = $${values.length + 1}`);
                values.push(data.name);
            }


            // -------------------------------------------------
            // username
            // -------------------------------------------------

            if (Object.prototype.hasOwnProperty.call(data, 'username')) {

                fields.push(`username = $${values.length + 1}`);
                values.push(data.username);
            }


            // -------------------------------------------------
            // email
            // -------------------------------------------------

            if (Object.prototype.hasOwnProperty.call(data, 'email')) {

                fields.push(`email = $${values.length + 1}`);
                values.push(data.email);
            }


            // -------------------------------------------------
            // passwordHash
            // -------------------------------------------------

            if (Object.prototype.hasOwnProperty.call(data, 'passwordHash')) {

                fields.push(`password_hash = $${values.length + 1}`);
                values.push(data.passwordHash);
            }


            // -------------------------------------------------
            // role
            // -------------------------------------------------

            if (Object.prototype.hasOwnProperty.call(data, 'role')) {

                fields.push(`role = $${values.length + 1}`);
                values.push(data.role);
            }


            // -------------------------------------------------
            // refresh_token
            // -------------------------------------------------

            if (Object.prototype.hasOwnProperty.call(data, 'refresh_token')) {

                fields.push(`refresh_token = $${values.length + 1}`);
                values.push(data.refresh_token);
            }


            // -------------------------------------------------
            // joinedAt
            // -------------------------------------------------

            if (Object.prototype.hasOwnProperty.call(data, 'joinedAt')) {

                fields.push(`joined_at = $${values.length + 1}`);
                values.push(data.joinedAt);
            }


            // -------------------------------------------------
            // inactiveAt
            // -------------------------------------------------

            if (Object.prototype.hasOwnProperty.call(data, 'inactiveAt')) {

                fields.push(`inactive_at = $${values.length + 1}`);
                values.push(data.inactiveAt);
            }


            // -------------------------------------------------
            // No fields to update
            // -------------------------------------------------

            if (fields.length === 0) {
                throw new Error('No valid fields provided for update');
            }


            // -------------------------------------------------
            // Always update updated_at
            // -------------------------------------------------

            fields.push('updated_at = NOW()');


            // -------------------------------------------------
            // WHERE id
            // -------------------------------------------------

            values.push(id);

            const query = `
                UPDATE "USERS"
                SET ${fields.join(', ')}
                WHERE id = $${values.length}
                RETURNING *
            `;

            console.log('USER UPDATE SQL:', query);
            console.log('USER UPDATE FIELDS:', fields);
            console.log('USER UPDATE USER ID:', id.toString());

            const result = await pool.query(query, values);

            if (result.rows.length === 0) {
                return null;
            }

            return mapUserRow(result.rows[0]);
        }
    },

    // =====================================================
    // PostgreSQL pool
    // =====================================================

    pool
};



// =========================================================
// Export
// =========================================================

module.exports = db;