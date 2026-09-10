const express = require('express');
const router = express.Router();
const db = require('../prismaClient');
const { verifyAdmin } = require('../middleware/auth.middleware');

/**
 * @swagger
 * /api/v1/bills/summary:
 *   get:
 *     summary: Calculate total cost sharing per member for a specific month or period
 *     description: Automatically calculates food cost and ingredient cost for active members. Restricted to Admin.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           example: "2026-09-01"
 *         required: true
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           example: "2026-09-30"
 *         required: true
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Successfully calculated bill summaries
 *       403:
 *         description: Admin resource access denied
 */
router.get('/summary', verifyAdmin, async(req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Validate dates
        if (!startDate || !endDate) {
            return res.status(400).json({
                error: 'Please provide startDate and endDate (YYYY-MM-DD)'
            });
        }

        // 1. Get all members
        const membersResult = await db.pool.query(`
            SELECT id, name, username, email, status
            FROM "USERS"
            ORDER BY id ASC
        `);

        const allMembers = membersResult.rows;

        if (allMembers.length === 0) {
            return res.json({
                message: 'No members found',
                summary: []
            });
        }

        // Only ACTIVE members share ingredient costs
        const activeMembers = allMembers.filter(
            member => member.status === 'ACTIVE'
        );

        const activeMemberCount = activeMembers.length;

        // 2. Get daily costs for selected period
        const dailyCostsResult = await db.pool.query(
            `
            SELECT *
            FROM "DAILY_FOOD_COST"
            WHERE date BETWEEN $1 AND $2
            ORDER BY date ASC
            `, [startDate, endDate]
        );

        const dailyCosts = dailyCostsResult.rows;

        let totalFoodCostPool = 0;
        let totalIngredientCostPool = 0;

        dailyCosts.forEach(cost => {
            totalFoodCostPool += Number(cost.food_price || 0);
            totalIngredientCostPool += Number(cost.ingredient_price || 0);
        });

        // 3. Get EAT meal statuses
        const mealStatusesResult = await db.pool.query(
            `
            SELECT *
            FROM "MEAL_STATUS"
            WHERE date BETWEEN $1 AND $2
              AND status = 'EAT'
            ORDER BY date ASC
            `, [startDate, endDate]
        );

        const mealStatuses = mealStatusesResult.rows;

        // Count eating days for each member
        const memberEatCounts = {};

        allMembers.forEach(member => {
            memberEatCounts[member.id.toString()] = 0;
        });

        mealStatuses.forEach(meal => {
            const memberId = meal.member_id.toString();

            if (memberEatCounts[memberId] !== undefined) {
                memberEatCounts[memberId] += 1;
            }
        });

        // 4. Ingredient cost shared by ACTIVE members
        const ingredientCostPerPerson =
            activeMemberCount > 0 ?
            totalIngredientCostPool / activeMemberCount :
            0;

        // 5. Calculate each member's bill
        const memberBillDetails = allMembers.map(member => {
            const memberId = member.id.toString();

            let personalFoodCost = 0;

            // Only ACTIVE members pay ingredient cost
            const isEligibleForIngredient =
                member.status === 'ACTIVE';

            const memberIngredientCost =
                isEligibleForIngredient ?
                ingredientCostPerPerson :
                0;

            // Calculate food cost day by day
            dailyCosts.forEach(cost => {
                const costDate = new Date(cost.date)
                    .toISOString()
                    .slice(0, 10);

                const eatersOnThisDay = mealStatuses.filter(meal => {
                    const mealDate = new Date(meal.date)
                        .toISOString()
                        .slice(0, 10);

                    return (
                        mealDate === costDate &&
                        meal.status === 'EAT'
                    );
                });

                const actualEatCount = eatersOnThisDay.length;

                const ateOnThisDay = eatersOnThisDay.some(
                    meal => meal.member_id.toString() === memberId
                );

                if (ateOnThisDay && actualEatCount > 0) {
                    personalFoodCost +=
                        Number(cost.food_price || 0) /
                        actualEatCount;
                }
            });

            const totalOwed =
                personalFoodCost + memberIngredientCost;

            return {
                memberId,
                name: member.name,
                username: member.username,
                status: member.status,
                daysEaten: memberEatCounts[memberId],
                foodCost: personalFoodCost.toFixed(2),
                ingredientCost: memberIngredientCost.toFixed(2),
                totalDue: totalOwed.toFixed(2)
            };
        });

        // 6. Return summary
        res.json({
            period: {
                startDate,
                endDate
            },

            totalMembers: allMembers.length,

            activeMembersCount: activeMemberCount,

            poolSummary: {
                totalFoodPrice: totalFoodCostPool.toFixed(2),
                totalIngredientPrice: totalIngredientCostPool.toFixed(2)
            },

            memberSummaries: memberBillDetails
        });

    } catch (error) {
        console.error('GET bill summary error:', error);

        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
});


/**
 * @swagger
 * /api/v1/bills/settle:
 *   post:
 *     summary: Settle bills for a period and deduct from member deposits
 *     description: Automatically calculates totalDue and deducts from member wallet/deposits. Restricted to Admin.
 *     tags: [Bills]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - startDate
 *               - endDate
 *             properties:
 *               startDate:
 *                 type: string
 *                 example: "2026-09-01"
 *               endDate:
 *                 type: string
 *                 example: "2026-09-30"
 *     responses:
 *       200:
 *         description: Bill settlement processed successfully
 *       400:
 *         description: Invalid input data
 *       403:
 *         description: Admin resource access denied
 */
router.post('/settle', verifyAdmin, async(req, res) => {
    const client = await db.pool.connect();
    try {
        const { startDate, endDate } = req.body;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Please provide startDate and endDate (YYYY-MM-DD)' });
        }

        await client.query('BEGIN'); // เริ่มต้น Transaction

        // 1. Get all members
        const membersResult = await client.query(`
            SELECT id, name, username, status
            FROM "USERS"
            ORDER BY id ASC
        `);
        const allMembers = membersResult.rows;
        const activeMembers = allMembers.filter(m => m.status === 'ACTIVE');
        const activeMemberCount = activeMembers.length;

        // 2. Get daily costs
        const dailyCostsResult = await client.query(
            `SELECT * FROM "DAILY_FOOD_COST" WHERE date BETWEEN $1 AND $2 ORDER BY date ASC`, [startDate, endDate]
        );
        const dailyCosts = dailyCostsResult.rows;

        // 3. Get meal statuses
        const mealStatusesResult = await client.query(
            `SELECT * FROM "MEAL_STATUS" WHERE date BETWEEN $1 AND $2 AND status = 'EAT'`, [startDate, endDate]
        );
        const mealStatuses = mealStatusesResult.rows;

        // 🆕 បន្ថែម totalFoodCostPool (មិនធ្លាប់មានពីមុន)
        let totalFoodCostPool = dailyCosts.reduce((sum, c) => sum + Number(c.food_price || 0), 0);
        let totalIngredientCostPool = dailyCosts.reduce((sum, c) => sum + Number(c.ingredient_price || 0), 0);
        let ingredientCostPerPerson = activeMemberCount > 0 ? totalIngredientCostPool / activeMemberCount : 0;

        const settlementResults = [];

        for (const member of allMembers) {
            const memberId = member.id.toString();
            let personalFoodCost = 0;
            const memberIngredientCost = member.status === 'ACTIVE' ? ingredientCostPerPerson : 0;

            dailyCosts.forEach(cost => {
                const costDate = new Date(cost.date).toISOString().slice(0, 10);
                const eatersOnThisDay = mealStatuses.filter(meal => {
                    const mealDate = new Date(meal.date).toISOString().slice(0, 10);
                    return mealDate === costDate && meal.status === 'EAT';
                });

                const actualEatCount = eatersOnThisDay.length;
                const ateOnThisDay = eatersOnThisDay.some(meal => meal.member_id.toString() === memberId);

                if (ateOnThisDay && actualEatCount > 0) {
                    personalFoodCost += Number(cost.food_price || 0) / actualEatCount;
                }
            });

            const totalDue = personalFoodCost + memberIngredientCost;

            if (totalDue > 0) {
                // 4. Get member deposit balance
                const depRes = await client.query('SELECT type, amount FROM member_deposits WHERE user_id = $1', [memberId]);
                let balance = 0;
                depRes.rows.forEach(tx => {
                    const amt = parseFloat(tx.amount);
                    if (tx.type === 'DEPOSIT') balance += amt;
                    if (tx.type === 'DEDUCTION') balance -= amt;
                });

                let status = '';
                let amountToDeduct = totalDue;

                if (balance >= totalDue) {
                    status = 'SUCCESSFULLY_DEDUCTED';
                } else {
                    status = 'INSUFFICIENT_DEPOSIT_PARTIAL_OR_DEBT';
                    amountToDeduct = balance > 0 ? balance : 0; // កាត់យកទឹកប្រាក់ដែលមានសិន (បើមាន)
                }

                // 5. Insert deduction transaction if balance > 0
                if (amountToDeduct > 0) {
                    await client.query(`
                        INSERT INTO member_deposits (id, user_id, amount, type, note, created_at)
                        VALUES (gen_random_uuid(), $1, $2, 'DEDUCTION', $3, NOW())
                    `, [memberId, amountToDeduct, `Settlement for period ${startDate} to ${endDate}`]);
                }

                settlementResults.push({
                    userId: memberId,
                    name: member.name,
                    totalDue: totalDue.toFixed(2),
                    previousDepositBalance: balance.toFixed(2),
                    deductedAmount: amountToDeduct.toFixed(2),
                    settlementStatus: status
                });
            }
        }

        // 🆕🆕🆕 កត់ត្រា settlement history ចូល BILL_SETTLEMENTS (ជានិច្ច) 🆕🆕🆕
        const totalDueAll = settlementResults.reduce(
            (sum, r) => sum + Number(r.totalDue), 0
        );

        await client.query(`
            INSERT INTO "BILL_SETTLEMENTS"
                (start_date, end_date, settled_by, total_food_cost, total_ingredient_cost, total_due_all, results)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            startDate,
            endDate,
            req.user && req.user.id ? req.user.id : null,
            totalFoodCostPool,
            totalIngredientCostPool,
            totalDueAll,
            JSON.stringify(settlementResults)
        ]);
        // 🆕🆕🆕 ចប់កូដថ្មី 🆕🆕🆕

        await client.query('COMMIT');
        res.status(200).json({
            message: 'Monthly bill settlement processed successfully',
            period: { startDate, endDate },
            results: settlementResults
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Settlement error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    } finally {
        client.release();
    }
});


/**
 * @swagger
 * /api/v1/bills/last-settlement:
 *   get:
 *     summary: Get the most recent bill settlement summary
 *     description: Returns the latest settlement record with full breakdown per member. Restricted to Admin.
 *     tags: [Bills]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Latest settlement retrieved
 *       404:
 *         description: No settlement found
 */
router.get('/last-settlement', verifyAdmin, async(req, res) => {
    try {
        const result = await db.pool.query(`
            SELECT bs.id,
                   to_char(bs.start_date, 'YYYY-MM-DD') AS start_date,
                   to_char(bs.end_date, 'YYYY-MM-DD') AS end_date,
                   bs.settled_by,
                   u.name AS settled_by_name,
                   bs.total_food_cost, bs.total_ingredient_cost, bs.total_due_all,
                   bs.results, bs.created_at
            FROM "BILL_SETTLEMENTS" bs
            LEFT JOIN "USERS" u ON u.id = bs.settled_by
            ORDER BY bs.created_at DESC
            LIMIT 1
        `);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No settlement history found yet' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('GET last settlement error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
});

/**
 * @swagger
 * /api/v1/bills/settlements:
 *   get:
 *     summary: Get bill settlement history with pagination
 *     description: Returns a list of past settlements, most recent first. Restricted to Admin.
 *     tags: [Bills]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of records to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of records to skip (for pagination)
 *     responses:
 *       200:
 *         description: Settlement history retrieved
 */
router.get('/settlements', verifyAdmin, async(req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        const result = await db.pool.query(`
            SELECT bs.id,
                   to_char(bs.start_date, 'YYYY-MM-DD') AS start_date,
                   to_char(bs.end_date, 'YYYY-MM-DD') AS end_date,
                   bs.settled_by,
                   u.name AS settled_by_name,
                   bs.total_food_cost, bs.total_ingredient_cost, bs.total_due_all,
                   bs.created_at
            FROM "BILL_SETTLEMENTS" bs
            LEFT JOIN "USERS" u ON u.id = bs.settled_by
            ORDER BY bs.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const countResult = await db.pool.query(`SELECT COUNT(*) FROM "BILL_SETTLEMENTS"`);

        res.json({
            total: parseInt(countResult.rows[0].count),
            limit,
            offset,
            settlements: result.rows
        });
    } catch (error) {
        console.error('GET settlements history error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
});

module.exports = router;