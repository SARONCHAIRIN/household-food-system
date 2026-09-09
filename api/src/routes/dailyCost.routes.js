const express = require('express');
const router = express.Router();
const db = require('../prismaClient');
const { verifyToken, verifyAdmin } = require('../middleware/auth.middleware');

/**
 * @swagger
 * /api/v1/daily-costs:
 *   get:
 *     summary: Get all daily food costs
 *     description: Retrieve all recorded daily food and ingredient costs.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */
router.get('/', verifyToken, async(req, res) => {
    try {
        const result = await db.pool.query(
            'SELECT * FROM "DAILY_FOOD_COST" ORDER BY date DESC'
        );

        const rows = result.rows;

        const formatted = rows.map(r => ({
            ...r,
            id: r.id.toString(),
            createdBy: r.created_by ?
                r.created_by.toString() :
                null
        }));

        res.json(formatted);

    } catch (error) {
        console.error('GET daily costs error:', error);

        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/v1/daily-costs:
 *   post:
 *     summary: Create or record daily food cost
 *     description: Record daily prices and automatically calculate cost per person.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 example: "2026-09-09"
 *               foodPrice:
 *                 type: number
 *                 example: 30
 *               ingredientPrice:
 *                 type: number
 *                 example: 10
 *               eatCount:
 *                 type: integer
 *                 example: 4
 *               totalMemberCount:
 *                 type: integer
 *                 example: 10
 *     responses:
 *       201:
 *         description: Created successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/', verifyAdmin, async(req, res) => {
    try {
        const {
            date,
            foodPrice,
            ingredientPrice,
            eatCount,
            totalMemberCount
        } = req.body;

        const createdBy = req.user.id;

        // Validate date
        if (!date) {
            return res.status(400).json({
                error: 'Date is required'
            });
        }

        // Convert values to numbers
        const foodPriceValue = Number(foodPrice) || 0;
        const ingredientPriceValue = Number(ingredientPrice) || 0;
        const eatCountValue = Number(eatCount) || 0;
        const totalMemberCountValue = Number(totalMemberCount) || 0;

        // Calculate food cost per eater
        const costFoodPerPerson =
            eatCountValue > 0 ?
            Number((foodPriceValue / eatCountValue).toFixed(2)) :
            0;

        // Calculate ingredient cost shared by all members
        const costIngredientPerPerson =
            totalMemberCountValue > 0 ?
            Number(
                (ingredientPriceValue / totalMemberCountValue).toFixed(2)
            ) :
            0;

        const calculationStatus = 'COMPLETED';

        const query = `
            INSERT INTO "DAILY_FOOD_COST"
            (
                date,
                food_price,
                ingredient_price,
                eat_count,
                total_member_count,
                cost_food_per_person,
                cost_ingredient_per_person,
                calculation_status,
                created_by,
                confirmed_at
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                CURRENT_TIMESTAMP
            )
            RETURNING id
        `;

        const values = [
            date,
            foodPriceValue,
            ingredientPriceValue,
            eatCountValue,
            totalMemberCountValue,
            costFoodPerPerson,
            costIngredientPerPerson,
            calculationStatus,
            createdBy
        ];

        const result = await db.pool.query(query, values);

        const insertedId = result.rows[0].id;

        res.status(201).json({
            message: 'Daily food cost recorded successfully',
            id: insertedId.toString(),
            costFoodPerPerson,
            costIngredientPerPerson
        });

    } catch (error) {
        console.error('POST daily cost error:', error);

        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

module.exports = router;