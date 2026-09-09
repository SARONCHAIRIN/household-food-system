const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

/**
 * @swagger
 * /api/v1/members:
 *   get:
 *     summary: Get all members
 *     description: Retrieve all household members.
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/', async(req, res) => {
    try {
        const users = await prisma.user.findMany();
        const formatted = users.map(u => ({...u, id: u.id.toString() }));
        res.json(formatted);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;