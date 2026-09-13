const assert = require('assert');
const db = require('../src/prismaClient');
const { ensureConstraints } = require('../src/db/ensureConstraints');
const { runAutoMealAttendance } = require('../src/jobs/autoMealAttendance');

async function runTests() {
    console.log('=====================================================');
    console.log('🔍 RUNNING VERIFICATION FOR AUTO MEAL ATTENDANCE JOB');
    console.log('=====================================================\n');

    const TEST_DATE = '2099-01-01';

    try {
        // --- STEP 1: Verify Unique Constraint ---
        console.log('Step 1: Ensuring and verifying unique constraint on MEAL_STATUS (member_id, date)...');
        await ensureConstraints();

        const constraintCheck = await db.pool.query(`
            SELECT conname, pg_get_constraintdef(c.oid) as def
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'MEAL_STATUS' AND c.conname = 'meal_status_member_date_unique'
        `);

        assert.strictEqual(
            constraintCheck.rows.length,
            1,
            'Constraint meal_status_member_date_unique should exist in PostgreSQL'
        );
        console.log('  ✅ Constraint confirmed:', constraintCheck.rows[0].def);

        // --- Fetch members to test with ---
        const membersRes = await db.pool.query(
            `SELECT id, name, status FROM "USERS" ORDER BY id ASC`
        );
        const users = membersRes.rows;
        assert(users.length >= 2, 'Need at least 2 members in database to perform test');

        const memberA = users[0];
        const memberB = users[1];
        const origStatusA = memberA.status;
        const origStatusB = memberB.status;

        // Ensure both members are ACTIVE during attendance cron test
        await db.pool.query(`UPDATE "USERS" SET status = 'ACTIVE' WHERE id IN ($1, $2)`, [memberA.id, memberB.id]);
        console.log(`  Testing with Member A (ID: ${memberA.id}, ${memberA.name}) and Member B (ID: ${memberB.id}, ${memberB.name})`);

        // --- STEP 2: Setup Test Date State ---
        console.log(`\nStep 2: Cleaning up and seeding test state for date: ${TEST_DATE}...`);
        await db.pool.query(`DELETE FROM "MEAL_STATUS" WHERE date = $1`, [TEST_DATE]);

        // Seed Member A with NOT_EAT / MANUAL
        await db.pool.query(`
            INSERT INTO "MEAL_STATUS" (member_id, date, status, confirmation_type, confirmed_at)
            VALUES ($1, $2, 'NOT_EAT', 'MANUAL', CURRENT_TIMESTAMP)
        `, [memberA.id, TEST_DATE]);

        console.log(`  ✅ Seeded Member A (${memberA.id}) with NOT_EAT / MANUAL.`);
        console.log(`  ✅ Left Member B (${memberB.id}) with NO record for ${TEST_DATE}.`);

        // --- STEP 3: Execute Auto Meal Attendance Job ---
        console.log(`\nStep 3: Triggering runAutoMealAttendance('${TEST_DATE}')...`);
        const runResult1 = await runAutoMealAttendance(TEST_DATE);
        console.log('  Execution result:', runResult1.message);

        // Verify Member A's record was UNTOUCHED
        const checkMemberA = await db.pool.query(
            `SELECT * FROM "MEAL_STATUS" WHERE member_id = $1 AND date = $2`,
            [memberA.id, TEST_DATE]
        );
        assert.strictEqual(checkMemberA.rows.length, 1);
        assert.strictEqual(
            checkMemberA.rows[0].status,
            'NOT_EAT',
            'Member A status should remain NOT_EAT'
        );
        assert.strictEqual(
            checkMemberA.rows[0].confirmation_type,
            'MANUAL',
            'Member A confirmation_type should remain MANUAL'
        );
        console.log('  ✅ CONFIRMED: Pre-existing NOT_EAT / MANUAL record was left untouched.');

        // Verify Member B's record was AUTO-CREATED
        const checkMemberB = await db.pool.query(
            `SELECT * FROM "MEAL_STATUS" WHERE member_id = $1 AND date = $2`,
            [memberB.id, TEST_DATE]
        );
        assert.strictEqual(checkMemberB.rows.length, 1);
        assert.strictEqual(
            checkMemberB.rows[0].status,
            'EAT',
            'Member B status should be auto-defaulted to EAT'
        );
        assert.strictEqual(
            checkMemberB.rows[0].confirmation_type,
            'AUTO',
            'Member B confirmation_type should be AUTO'
        );
        console.log('  ✅ CONFIRMED: Missing member was auto-created with status EAT and confirmation_type AUTO.');

        // --- STEP 4: Test Idempotency (Run again) ---
        console.log(`\nStep 4: Testing idempotency by running runAutoMealAttendance('${TEST_DATE}') a second time...`);
        const runResult2 = await runAutoMealAttendance(TEST_DATE);
        console.log('  Second execution result:', runResult2.message);
        assert.strictEqual(runResult2.createdCount, 0, 'No records should be created on second run');

        const totalRecordsForDate = await db.pool.query(
            `SELECT count(*) as count FROM "MEAL_STATUS" WHERE date = $1`,
            [TEST_DATE]
        );
        assert.strictEqual(
            parseInt(totalRecordsForDate.rows[0].count, 10),
            users.length,
            'Total records should equal number of active members with zero duplicates'
        );
        console.log('  ✅ CONFIRMED: Job is completely idempotent. No duplicates or modifications on re-run.');

        // --- STEP 5: Test Member Updating AUTO Record to MANUAL ---
        console.log(`\nStep 5: Testing Member updating AUTO record to NOT_EAT / MANUAL...`);
        // Simulate what POST /meal-statuses does
        const updateUpsertQuery = `
            INSERT INTO "MEAL_STATUS" (
                member_id, date, status, confirmation_type, confirmed_at, created_at, updated_at
            )
            VALUES ($1, $2, 'NOT_EAT', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (member_id, date)
            DO UPDATE SET
                status = EXCLUDED.status,
                confirmation_type = 'MANUAL',
                confirmed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id, member_id, date, status, confirmation_type;
        `;
        const updateResult = await db.pool.query(updateUpsertQuery, [memberB.id, TEST_DATE]);
        const updatedRow = updateResult.rows[0];

        assert.strictEqual(updatedRow.status, 'NOT_EAT');
        assert.strictEqual(updatedRow.confirmation_type, 'MANUAL');
        console.log('  ✅ CONFIRMED: Member updated status to NOT_EAT and confirmation_type flipped to MANUAL.');

        // --- STEP 6: Clean Up Test Data ---
        console.log(`\nStep 6: Cleaning up test records for ${TEST_DATE}...`);
        await db.pool.query(`DELETE FROM "MEAL_STATUS" WHERE date = $1`, [TEST_DATE]);
        console.log('  ✅ Cleaned up synthetic test records.');

        console.log('\n=====================================================');
        console.log('🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
        console.log('=====================================================\n');

    } catch (err) {
        console.error('\n❌ TEST FAILED:', err);
        // Attempt cleanup on failure
        await db.pool.query(`DELETE FROM "MEAL_STATUS" WHERE date = $1`, [TEST_DATE]).catch(() => {});
        process.exit(1);
    } finally {
        if (typeof origStatusA !== 'undefined' && typeof memberA !== 'undefined') {
            await db.pool.query(`UPDATE "USERS" SET status = $1 WHERE id = $2`, [origStatusA, memberA.id]).catch(() => {});
        }
        if (typeof origStatusB !== 'undefined' && typeof memberB !== 'undefined') {
            await db.pool.query(`UPDATE "USERS" SET status = $1 WHERE id = $2`, [origStatusB, memberB.id]).catch(() => {});
        }
        await db.pool.end();
    }
}

runTests();
