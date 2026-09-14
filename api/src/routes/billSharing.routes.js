const express = require('express');
const router = express.Router();
const db = require('../prismaClient');
const { verifyAdmin } = require('../middleware/auth.middleware');
const { convertAmount, formatCurrency } = require('../utils/currencyHelper');

const DEFAULT_RATE = 4000;

/**
 * Helper to parse dates formatted as YYYY-MM-DD reliably without timezone shifts
 */
const toDateStr = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    return d.toISOString().slice(0, 10);
};

/**
 * @swagger
 * /api/v1/bills/summary:
 *   get:
 *     summary: Calculate total cost sharing per member for a specific month or period
 *     tags: [Bills]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           example: "2026-09-01"
 *         required: true
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           example: "2026-09-30"
 *         required: true
 *     responses:
 *       200:
 *         description: Successfully calculated bill summaries
 */
router.get('/summary', verifyAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                error: 'Please provide startDate and endDate (YYYY-MM-DD)'
            });
        }

        const membersResult = await db.pool.query(`
            SELECT id, name, username, email, status
            FROM "USERS"
            ORDER BY id ASC
        `);
        const allMembers = membersResult.rows;

        if (allMembers.length === 0) {
            return res.json({
                message: 'No members found',
                memberSummaries: []
            });
        }

        const activeMembers = allMembers.filter(m => m.status === 'ACTIVE');
        const activeMemberCount = activeMembers.length;

        const dailyCostsResult = await db.pool.query(
            `SELECT * FROM "DAILY_FOOD_COST" WHERE date BETWEEN $1 AND $2 ORDER BY date ASC`,
            [startDate, endDate]
        );
        const dailyCosts = dailyCostsResult.rows;

        let totalFoodCostPoolKHR = 0;
        let totalIngredientCostPoolKHR = 0;

        dailyCosts.forEach(cost => {
            const foodAmt = Number(cost.food_price || cost.foodPrice || 0);
            const ingAmt = Number(cost.ingredient_price || cost.ingredientPrice || 0);
            const currency = cost.currency || 'KHR';
            const rate = Number(cost.exchange_rate || DEFAULT_RATE);

            totalFoodCostPoolKHR += convertAmount(foodAmt, currency, 'KHR', rate);
            totalIngredientCostPoolKHR += convertAmount(ingAmt, currency, 'KHR', rate);
        });

        const mealStatusesResult = await db.pool.query(
            `SELECT * FROM "MEAL_STATUS" WHERE date BETWEEN $1 AND $2 AND status = 'EAT' ORDER BY date ASC`,
            [startDate, endDate]
        );
        const mealStatuses = mealStatusesResult.rows;

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

        const ingredientCostPerPersonKHR = activeMemberCount > 0
            ? totalIngredientCostPoolKHR / activeMemberCount
            : 0;

        const memberBillDetails = allMembers.map(member => {
            const memberId = member.id.toString();
            let personalFoodCostKHR = 0;
            const memberIngredientCostKHR = member.status === 'ACTIVE' ? ingredientCostPerPersonKHR : 0;

            dailyCosts.forEach(cost => {
                const costDateStr = toDateStr(cost.date);
                const currency = cost.currency || 'KHR';
                const rate = Number(cost.exchange_rate || DEFAULT_RATE);
                const dayFoodPriceKHR = convertAmount(Number(cost.food_price || cost.foodPrice || 0), currency, 'KHR', rate);

                const eatersOnThisDay = mealStatuses.filter(meal => {
                    const mealDateStr = toDateStr(meal.date);
                    return mealDateStr === costDateStr && meal.status === 'EAT';
                });

                const actualEatCount = eatersOnThisDay.length;
                const ateOnThisDay = eatersOnThisDay.some(meal => meal.member_id.toString() === memberId);

                if (ateOnThisDay && actualEatCount > 0) {
                    personalFoodCostKHR += dayFoodPriceKHR / actualEatCount;
                }
            });

            const totalOwedKHR = personalFoodCostKHR + memberIngredientCostKHR;
            const totalOwedUSD = convertAmount(totalOwedKHR, 'KHR', 'USD', DEFAULT_RATE);

            return {
                memberId,
                name: member.name,
                username: member.username,
                status: member.status,
                daysEaten: memberEatCounts[memberId],
                foodCostKHR: Math.round(personalFoodCostKHR),
                foodCostUSD: convertAmount(personalFoodCostKHR, 'KHR', 'USD', DEFAULT_RATE),
                ingredientCostKHR: Math.round(memberIngredientCostKHR),
                ingredientCostUSD: convertAmount(memberIngredientCostKHR, 'KHR', 'USD', DEFAULT_RATE),
                totalDueKHR: Math.round(totalOwedKHR),
                totalDueUSD: totalOwedUSD,
                formattedTotalKHR: formatCurrency(totalOwedKHR, 'KHR'),
                formattedTotalUSD: formatCurrency(totalOwedUSD, 'USD')
            };
        });

        const totalFoodUSD = convertAmount(totalFoodCostPoolKHR, 'KHR', 'USD', DEFAULT_RATE);
        const totalIngredientUSD = convertAmount(totalIngredientCostPoolKHR, 'KHR', 'USD', DEFAULT_RATE);

        res.json({
            period: { startDate, endDate },
            totalMembers: allMembers.length,
            activeMembersCount: activeMemberCount,
            exchangeRate: DEFAULT_RATE,
            poolSummary: {
                totalFoodCostKHR: Math.round(totalFoodCostPoolKHR),
                totalFoodCostUSD: totalFoodUSD,
                totalIngredientCostKHR: Math.round(totalIngredientCostPoolKHR),
                totalIngredientCostUSD: totalIngredientUSD,
                formattedFoodKHR: formatCurrency(totalFoodCostPoolKHR, 'KHR'),
                formattedFoodUSD: formatCurrency(totalFoodUSD, 'USD'),
                formattedIngredientKHR: formatCurrency(totalIngredientCostPoolKHR, 'KHR'),
                formattedIngredientUSD: formatCurrency(totalIngredientUSD, 'USD')
            },
            memberSummaries: memberBillDetails
        });

    } catch (error) {
        console.error('GET bill summary error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
});

/**
 * @swagger
 * /api/v1/bills/settle:
 *   post:
 *     summary: Settle bills for a period and deduct from member deposits
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
 *         description: Monthly bill settlement processed successfully
 */
router.post('/settle', verifyAdmin, async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { startDate, endDate } = req.body;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Please provide startDate and endDate (YYYY-MM-DD)' });
        }

        await client.query('BEGIN');

        const membersResult = await client.query(`SELECT id, name, username, status FROM "USERS" ORDER BY id ASC`);
        const allMembers = membersResult.rows;
        const activeMembers = allMembers.filter(m => m.status === 'ACTIVE');
        const activeMemberCount = activeMembers.length;

        const dailyCostsResult = await client.query(
            `SELECT * FROM "DAILY_FOOD_COST" WHERE date BETWEEN $1 AND $2 ORDER BY date ASC`,
            [startDate, endDate]
        );
        const dailyCosts = dailyCostsResult.rows;

        const mealStatusesResult = await client.query(
            `SELECT * FROM "MEAL_STATUS" WHERE date BETWEEN $1 AND $2 AND status = 'EAT'`,
            [startDate, endDate]
        );
        const mealStatuses = mealStatusesResult.rows;

        let totalFoodCostPoolKHR = 0;
        let totalIngredientCostPoolKHR = 0;

        dailyCosts.forEach(cost => {
            const foodAmt = Number(cost.food_price || cost.foodPrice || 0);
            const ingAmt = Number(cost.ingredient_price || cost.ingredientPrice || 0);
            const currency = cost.currency || 'KHR';
            const rate = Number(cost.exchange_rate || DEFAULT_RATE);

            totalFoodCostPoolKHR += convertAmount(foodAmt, currency, 'KHR', rate);
            totalIngredientCostPoolKHR += convertAmount(ingAmt, currency, 'KHR', rate);
        });

        const ingredientCostPerPersonKHR = activeMemberCount > 0 ? totalIngredientCostPoolKHR / activeMemberCount : 0;
        const settlementResults = [];

        for (const member of allMembers) {
            const memberId = member.id.toString();
            let personalFoodCostKHR = 0;
            const memberIngredientCostKHR = member.status === 'ACTIVE' ? ingredientCostPerPersonKHR : 0;

            dailyCosts.forEach(cost => {
                const costDateStr = toDateStr(cost.date);
                const currency = cost.currency || 'KHR';
                const rate = Number(cost.exchange_rate || DEFAULT_RATE);
                const dayFoodPriceKHR = convertAmount(Number(cost.food_price || cost.foodPrice || 0), currency, 'KHR', rate);

                const eatersOnThisDay = mealStatuses.filter(meal => {
                    const mealDateStr = toDateStr(meal.date);
                    return mealDateStr === costDateStr && meal.status === 'EAT';
                });

                const actualEatCount = eatersOnThisDay.length;
                const ateOnThisDay = eatersOnThisDay.some(meal => meal.member_id.toString() === memberId);

                if (ateOnThisDay && actualEatCount > 0) {
                    personalFoodCostKHR += dayFoodPriceKHR / actualEatCount;
                }
            });

            const totalDueKHR = Math.round(personalFoodCostKHR + memberIngredientCostKHR);

            const depRes = await client.query(
                'SELECT type, amount FROM member_deposits WHERE user_id = $1',
                [memberId]
            );
            let balanceKHR = 0;

            depRes.rows.forEach(tx => {
                const amt = parseFloat(tx.amount || 0);
                if (tx.type === 'DEPOSIT') balanceKHR += amt;
                if (tx.type === 'DEDUCTION') balanceKHR -= amt;
            });

            let settlementStatus = 'SUCCESSFULLY_DEDUCTED';
            let amountToDeductKHR = totalDueKHR;

            if (balanceKHR < totalDueKHR) {
                settlementStatus = 'INSUFFICIENT_DEPOSIT_PARTIAL_OR_DEBT';
                amountToDeductKHR = balanceKHR > 0 ? balanceKHR : 0;
            }

            if (amountToDeductKHR > 0) {
                await client.query(`
                    INSERT INTO member_deposits (id, user_id, amount, type, note, created_at)
                    VALUES (gen_random_uuid(), $1, $2, 'DEDUCTION', $3, NOW())
                `, [
                    memberId,
                    amountToDeductKHR,
                    `Settlement for period ${startDate} to ${endDate}`
                ]);
            }

            // Record all members in settlementResults regardless of totalDue amount
            settlementResults.push({
                userId: memberId,
                name: member.name,
                totalDue: totalDueKHR,
                totalDueKHR,
                totalDueUSD: convertAmount(totalDueKHR, 'KHR', 'USD', DEFAULT_RATE),
                previousDepositBalance: Math.round(balanceKHR),
                previousDepositBalanceKHR: Math.round(balanceKHR),
                previousDepositBalanceUSD: convertAmount(balanceKHR, 'KHR', 'USD', DEFAULT_RATE),
                deductedAmount: Math.round(amountToDeductKHR),
                deductedAmountKHR: Math.round(amountToDeductKHR),
                deductedAmountUSD: convertAmount(amountToDeductKHR, 'KHR', 'USD', DEFAULT_RATE),
                formattedTotalDueKHR: formatCurrency(totalDueKHR, 'KHR'),
                settlementStatus
            });
        }

        const totalDueAllKHR = settlementResults.reduce((sum, r) => sum + r.totalDueKHR, 0);
        const settledByUserId = req.user && req.user.id ? req.user.id.toString() : null;

        await client.query(`
            INSERT INTO "BILL_SETTLEMENTS"
                (start_date, end_date, settled_by, total_food_cost, total_ingredient_cost, total_due_all, results, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
            startDate,
            endDate,
            settledByUserId,
            totalFoodCostPoolKHR,
            totalIngredientCostPoolKHR,
            totalDueAllKHR,
            JSON.stringify(settlementResults)
        ]);

        await client.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: 'Monthly bill settlement processed successfully',
            period: { startDate, endDate },
            results: settlementResults
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Settlement execution error:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    } finally {
        client.release();
    }
});

/**
 * @swagger
 * /api/v1/bills/last-settlement:
 *   get:
 *     summary: Get the most recent bill settlement summary with KHR/USD formatting
 *     tags: [Bills]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully fetched latest settlement record
 */
router.get('/last-settlement', verifyAdmin, async (req, res) => {
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

        const row = result.rows[0];
        const foodKHR = Number(row.total_food_cost || 0);
        const ingKHR = Number(row.total_ingredient_cost || 0);
        const dueKHR = Number(row.total_due_all || 0);

        // Ensure results object is parsed correctly if returned as string
        const parsedResults = typeof row.results === 'string' ? JSON.parse(row.results) : row.results;

        res.json({
            ...row,
            results: parsedResults || [],
            formattedPool: {
                totalFoodCostKHR: Math.round(foodKHR),
                totalFoodCostUSD: convertAmount(foodKHR, 'KHR', 'USD', DEFAULT_RATE),
                formattedFoodKHR: formatCurrency(foodKHR, 'KHR'),
                formattedFoodUSD: formatCurrency(convertAmount(foodKHR, 'KHR', 'USD', DEFAULT_RATE), 'USD'),
                totalIngredientCostKHR: Math.round(ingKHR),
                totalIngredientCostUSD: convertAmount(ingKHR, 'KHR', 'USD', DEFAULT_RATE),
                formattedIngredientKHR: formatCurrency(ingKHR, 'KHR'),
                formattedIngredientUSD: formatCurrency(convertAmount(ingKHR, 'KHR', 'USD', DEFAULT_RATE), 'USD'),
                totalDueAllKHR: Math.round(dueKHR),
                totalDueAllUSD: convertAmount(dueKHR, 'KHR', 'USD', DEFAULT_RATE),
                formattedDueAllKHR: formatCurrency(dueKHR, 'KHR'),
                formattedDueAllUSD: formatCurrency(convertAmount(dueKHR, 'KHR', 'USD', DEFAULT_RATE), 'USD')
            }
        });
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
 *     tags: [Bills]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully fetched settlement history
 */
router.get('/settlements', verifyAdmin, async (req, res) => {
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

        const formattedSettlements = result.rows.map(row => {
            const foodKHR = Number(row.total_food_cost || 0);
            const ingKHR = Number(row.total_ingredient_cost || 0);
            const dueKHR = Number(row.total_due_all || 0);

            return {
                ...row,
                formattedTotalDueKHR: formatCurrency(dueKHR, 'KHR'),
                formattedTotalDueUSD: formatCurrency(convertAmount(dueKHR, 'KHR', 'USD', DEFAULT_RATE), 'USD')
            };
        });

        res.json({
            total: parseInt(countResult.rows[0].count),
            limit,
            offset,
            settlements: formattedSettlements
        });
    } catch (error) {
        console.error('GET settlements history error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
});

module.exports = router;