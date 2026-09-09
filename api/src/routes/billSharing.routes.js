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

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Please provide startDate and endDate (YYYY-MM-DD)' });
        }

        // ១. ទាញយកសមាជិកទាំងអស់ដើម្បីពិនិត្យ Status (ACTIVE, INACTIVE, AWAY)
        const [allMembers] = await db.pool.query('SELECT id, name, username, email, status FROM USERS');

        if (allMembers.length === 0) {
            return res.json({ message: 'No members found', summary: [] });
        }

        // រាប់เฉพาะសមាជិកដែល ACTIVE យកមកចែកថ្លៃគ្រឿងទេសរួម
        const activeMembers = allMembers.filter(m => m.status === 'ACTIVE');
        const activeMemberCount = activeMembers.length;

        // ២. ទាញយកតម្លៃចំណាយប្រចាំថ្ងៃក្នុងចន្លោះពេលកំណត់
        const [dailyCosts] = await db.pool.query(
            'SELECT * FROM DAILY_FOOD_COST WHERE date BETWEEN ? AND ?', [startDate, endDate]
        );

        let totalFoodCostPool = 0;
        let totalIngredientCostPool = 0;

        dailyCosts.forEach(cost => {
            totalFoodCostPool += parseFloat(cost.food_price || 0);
            totalIngredientCostPool += parseFloat(cost.ingredient_price || 0);
        });

        // ៣. ទាញយកស្ថានភាពហូបបាយ EAT
        const [mealStatuses] = await db.pool.query(
            'SELECT * FROM MEAL_STATUS WHERE date BETWEEN ? AND ? AND status = "EAT"', [startDate, endDate]
        );

        const memberEatCounts = {};
        allMembers.forEach(m => {
            memberEatCounts[m.id.toString()] = 0;
        });

        mealStatuses.forEach(ms => {
            const mId = ms.member_id.toString();
            if (memberEatCounts[mId] !== undefined) {
                memberEatCounts[mId] += 1;
            }
        });

        // ថ្លៃគ្រឿងទេសក្នុងមនុស្សម្នាក់ គណនាเฉพาะសមាជិក ACTIVE
        const ingredientCostPerPerson = activeMemberCount > 0 ? (totalIngredientCostPool / activeMemberCount) : 0;

        const memberBillDetails = allMembers.map(m => {
            const mId = m.id.toString();
            let personalFoodCost = 0;

            // បើ Member មិនមែន ACTIVE (ឧ. AWAY ឬ INACTIVE) មិនគិតថ្លៃគ្រឿងទេសទេ
            const isEligibleForIngredient = m.status === 'ACTIVE';
            const memberIngredientCost = isEligibleForIngredient ? ingredientCostPerPerson : 0;

            dailyCosts.forEach(cost => {
                // រាប់ចំនួនអ្នកហូបពិតប្រាកដក្នុងថ្ងៃនោះ
                const eatersOnThisDay = mealStatuses.filter(ms =>
                    new Date(ms.date).toISOString().slice(0, 10) === new Date(cost.date).toISOString().slice(0, 10) &&
                    ms.status === 'EAT'
                );

                const actualEatCount = eatersOnThisDay.length;
                const ateOnThisDay = eatersOnThisDay.some(ms => ms.member_id.toString() === mId);

                if (ateOnThisDay && actualEatCount > 0) {
                    personalFoodCost += parseFloat(cost.food_price) / actualEatCount;
                }
            });

            const totalOwed = personalFoodCost + memberIngredientCost;

            return {
                memberId: mId,
                name: m.name,
                username: m.username,
                status: m.status, // បង្ហាញ Status របស់សមាជិក
                daysEaten: memberEatCounts[mId],
                foodCost: personalFoodCost.toFixed(2),
                ingredientCost: memberIngredientCost.toFixed(2),
                totalDue: totalOwed.toFixed(2)
            };
        });

        res.json({
            period: { startDate, endDate },
            totalMembers: allMembers.length,
            activeMembersCount: activeMemberCount,
            poolSummary: {
                totalFoodPrice: totalFoodCostPool.toFixed(2),
                totalIngredientPrice: totalIngredientCostPool.toFixed(2)
            },
            memberSummaries: memberBillDetails
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;