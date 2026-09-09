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

module.exports = router;