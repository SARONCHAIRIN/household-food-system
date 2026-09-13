const db = require('../prismaClient');

/**
 * Ensures required database constraints exist for MEAL_STATUS.
 * Idempotently adds a unique constraint on (member_id, date) if not already present.
 */
async function ensureConstraints() {
    const query = `
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'meal_status_member_date_unique'
            ) THEN
                ALTER TABLE "MEAL_STATUS"
                ADD CONSTRAINT meal_status_member_date_unique UNIQUE (member_id, date);
            END IF;
        END $$;
    `;

    try {
        await db.pool.query(query);
        console.log('[DB] Verified unique constraint (member_id, date) on "MEAL_STATUS".');
    } catch (error) {
        console.error('[DB] Failed to ensure database constraints:', error);
        throw error;
    }
}

module.exports = {
    ensureConstraints
};
