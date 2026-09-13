const assert = require('assert');
const jwt = require('jsonwebtoken');
const db = require('../src/prismaClient');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:10000';
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_here';

function makeToken(user) {
    return jwt.sign(
        {
            id: user.id.toString(),
            username: user.username,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

async function request(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
}

async function runTests() {
    console.log('=====================================================');
    console.log('🔍 RUNNING VERIFICATION FOR ACTIVE MEMBER GATE');
    console.log('=====================================================\n');

    const TEST_DATE = '2099-01-01';

    // Find a member to test with (Member 30)
    const memberRes = await db.pool.query(
        `SELECT id, username, role, status FROM "USERS" WHERE id = 30 LIMIT 1`
    );
    assert(memberRes.rows.length > 0, 'User ID 30 should exist in database');
    const member = memberRes.rows[0];
    const originalStatus = member.status;
    const token = makeToken(member);

    // Also find Admin (User 29) to test role independence
    const adminRes = await db.pool.query(
        `SELECT id, username, role, status FROM "USERS" WHERE role = 'ADMIN' LIMIT 1`
    );
    const admin = adminRes.rows[0];
    const adminOriginalStatus = admin.status;
    const adminToken = makeToken(admin);

    try {
        // Cleanup any test meal records for TEST_DATE
        await db.pool.query('DELETE FROM "MEAL_STATUS" WHERE date = $1', [TEST_DATE]);

        // ----------------------------------------------------
        // TEST 1: User with status INACTIVE -> 403 Forbidden
        // ----------------------------------------------------
        console.log('Test 1: Member with INACTIVE status calls POST /api/v1/meal-statuses...');
        await db.pool.query(`UPDATE "USERS" SET status = 'INACTIVE' WHERE id = $1`, [member.id]);

        const resInactive = await request('/api/v1/meal-statuses', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({ date: TEST_DATE, status: 'EAT' })
        });

        console.log('  Response status:', resInactive.status);
        console.log('  Response body:', resInactive.data);

        assert.strictEqual(resInactive.status, 403, 'Expected 403 Forbidden for INACTIVE member');
        assert.strictEqual(
            resInactive.data.error,
            'Only active members can set meal attendance. Your account status is currently INACTIVE.',
            'Expected specific error message with dynamic INACTIVE status'
        );
        console.log('  ✅ CONFIRMED: INACTIVE member was blocked with 403 Forbidden.');

        // ----------------------------------------------------
        // TEST 2: User with status AWAY -> 403 Forbidden
        // ----------------------------------------------------
        console.log('\nTest 2: Member with AWAY status calls POST /api/v1/meal-statuses...');
        await db.pool.query(`UPDATE "USERS" SET status = 'AWAY' WHERE id = $1`, [member.id]);

        const resAway = await request('/api/v1/meal-statuses', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({ date: TEST_DATE, status: 'EAT' })
        });

        console.log('  Response status:', resAway.status);
        console.log('  Response body:', resAway.data);

        assert.strictEqual(resAway.status, 403, 'Expected 403 Forbidden for AWAY member');
        assert.strictEqual(
            resAway.data.error,
            'Only active members can set meal attendance. Your account status is currently AWAY.',
            'Expected specific error message with dynamic AWAY status'
        );
        console.log('  ✅ CONFIRMED: AWAY member was blocked with 403 Forbidden.');

        // ----------------------------------------------------
        // TEST 3: Admin with AWAY or INACTIVE status -> 403 Forbidden (Role Independence)
        // ----------------------------------------------------
        console.log('\nTest 3: ADMIN with AWAY status calls POST /api/v1/meal-statuses (Role Independence)...');
        await db.pool.query(`UPDATE "USERS" SET status = 'AWAY' WHERE id = $1`, [admin.id]);

        const resAdminAway = await request('/api/v1/meal-statuses', {
            method: 'POST',
            headers: { Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ date: TEST_DATE, status: 'EAT' })
        });

        console.log('  Response status:', resAdminAway.status);
        console.log('  Response body:', resAdminAway.data);

        assert.strictEqual(resAdminAway.status, 403, 'Expected 403 Forbidden for AWAY admin');
        assert.strictEqual(
            resAdminAway.data.error,
            'Only active members can set meal attendance. Your account status is currently AWAY.'
        );
        console.log('  ✅ CONFIRMED: Rule applies to ADMIN based on personal account status.');

        // ----------------------------------------------------
        // TEST 4: Read Access remains open for INACTIVE / AWAY users
        // ----------------------------------------------------
        console.log('\nTest 4: Checking GET /api/v1/meal-statuses remains open for INACTIVE / AWAY user...');
        const resGet = await request('/api/v1/meal-statuses', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('  GET response status:', resGet.status);
        assert.strictEqual(resGet.status, 200, 'GET /meal-statuses should remain 200 OK');
        assert(Array.isArray(resGet.data), 'Expected array of meal statuses');
        console.log('  ✅ CONFIRMED: Read access remains accessible to all authenticated users.');

        // ----------------------------------------------------
        // TEST 5: User with status ACTIVE -> 200 / 201 OK
        // ----------------------------------------------------
        console.log('\nTest 5: Member with ACTIVE status calls POST /api/v1/meal-statuses...');
        await db.pool.query(`UPDATE "USERS" SET status = 'ACTIVE' WHERE id = $1`, [member.id]);

        const resActive = await request('/api/v1/meal-statuses', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({ date: TEST_DATE, status: 'EAT' })
        });

        console.log('  Response status:', resActive.status);
        console.log('  Response body:', resActive.data);

        assert([200, 201].includes(resActive.status), 'Expected 200 or 201 for ACTIVE member');
        assert.strictEqual(resActive.data.record.status, 'EAT');
        assert.strictEqual(resActive.data.record.confirmationType, 'MANUAL');
        console.log('  ✅ CONFIRMED: ACTIVE member succeeded with status EAT and confirmationType MANUAL.');

        console.log('\n=====================================================');
        console.log('🎉 ALL ACTIVE MEMBER GATE TESTS PASSED SUCCESSFULLY!');
        console.log('=====================================================\n');

    } catch (err) {
        console.error('\n❌ TEST FAILED:', err);
        process.exit(1);
    } finally {
        // Restore statuses
        await db.pool.query(`UPDATE "USERS" SET status = $1 WHERE id = $2`, [originalStatus, member.id]);
        await db.pool.query(`UPDATE "USERS" SET status = $1 WHERE id = $2`, [adminOriginalStatus, admin.id]);
        await db.pool.query('DELETE FROM "MEAL_STATUS" WHERE date = $1', [TEST_DATE]);
        await db.pool.end();
    }
}

runTests();
