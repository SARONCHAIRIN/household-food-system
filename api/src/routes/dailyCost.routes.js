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
        const [rows] = await db.pool.query('SELECT * FROM DAILY_FOOD_COST ORDER BY date DESC');
        const formatted = rows.map(r => ({
            ...r,
            id: r.id.toString(),
            createdBy: r.created_by ? r.created_by.toString() : null
        }));
        res.json(formatted);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
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
        const { date, foodPrice, ingredientPrice, eatCount, totalMemberCount } = req.body;
        const createdBy = req.user.id;

        const costFoodPerPerson = eatCount > 0 ? (foodPrice / eatCount).toFixed(2) : 0;
        const costIngredientPerPerson = totalMemberCount > 0 ? (ingredientPrice / totalMemberCount).toFixed(2) : 0;
        const calculationStatus = 'COMPLETED';

        const query = `
            INSERT INTO DAILY_FOOD_COST 
            (date, food_price, ingredient_price, eat_count, total_member_count, cost_food_per_person, cost_ingredient_per_person, calculation_status, created_by, confirmed_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        const values = [
            date, foodPrice || 0, ingredientPrice || 0, eatCount || 0,
            totalMemberCount || 0, costFoodPerPerson, costIngredientPerPerson,
            calculationStatus, createdBy
        ];

        const [result] = await db.pool.query(query, values);
        res.status(201).json({
            message: 'Daily food cost recorded successfully',
            id: result.insertId.toString(),
            costFoodPerPerson,
            costIngredientPerPerson
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;