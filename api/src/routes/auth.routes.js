const express = require('express');
const router = express.Router();
const db = require('../prismaClient');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: User Login
 *     description: Authenticate user with username and password.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: "admin"
 *               password:
 *                 type: string
 *                 example: "admin123"
 *     responses:
 *       200:
 *         description: Login successful.
 *       401:
 *         description: Invalid credentials.
 */
router.post('/login', async(req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: 'Username and password are required'
            });
        }

        const user = await db.user.findFirst({
            where: { username }
        });

        if (!user) {
            return res.status(401).json({
                error: 'Invalid username or password'
            });
        }

        const isPasswordValid = await bcrypt.compare(
            password,
            user.passwordHash || user.password_hash
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Invalid username or password'
            });
        }

        const accessToken = jwt.sign({
                id: user.id.toString(),
                username: user.username,
                role: user.role
            },
            JWT_SECRET, {
                expiresIn: '1d'
            }
        );

        const refreshToken = jwt.sign({
                id: user.id.toString()
            },
            JWT_SECRET, {
                expiresIn: '7d'
            }
        );

        res.json({
            message: 'Login successful',
            accessToken,
            refreshToken
        });

    } catch (error) {
        console.error('LOGIN ERROR:', error);

        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new household member/user
 *     description: Create a new user account with hashed password.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "chai rin"
 *               username:
 *                 type: string
 *                 example: "rin"
 *               email:
 *                 type: string
 *                 example: "rin@gmail.com"
 *               password:
 *                 type: string
 *                 example: "rin123"
 *               role:
 *                 type: string
 *                 enum: [ADMIN, MEMBER, USER]
 *                 example: "USER"
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Username or email already exists
 */
router.post('/register', async(req, res) => {
    try {
        const {
            name,
            username,
            email,
            password,
            role
        } = req.body;

        // Validate required fields
        if (!name || !username || !email || !password) {
            return res.status(400).json({
                error: 'Name, username, email and password are required'
            });
        }

        // Default role
        const userRole = role || 'MEMBER';

        // Validate role
        if (!['ADMIN', 'MEMBER', 'USER'].includes(userRole)) {
            return res.status(400).json({
                error: 'Invalid role. Use ADMIN, MEMBER or USER'
            });
        }

        // Check username or email
        const existingResult = await db.pool.query(
            `
            SELECT id
            FROM "USERS"
            WHERE username = $1
               OR email = $2
            LIMIT 1
            `, [username, email]
        );

        const existing = existingResult.rows;

        if (existing.length > 0) {
            return res.status(400).json({
                error: 'Username or email already exists'
            });
        }

        // Hash password
        const saltRounds = 10;

        const passwordHash = await bcrypt.hash(
            password,
            saltRounds
        );

        // Insert user
        const insertResult = await db.pool.query(
            `
            INSERT INTO "USERS"
            (
                name,
                username,
                email,
                password_hash,
                role,
                status,
                joined_at
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5,
                'ACTIVE',
                CURRENT_DATE
            )
            RETURNING id, name, username, email, role, status, joined_at
            `, [
                name,
                username,
                email,
                passwordHash,
                userRole
            ]
        );

        const newUser = insertResult.rows[0];

        const newUserId = newUser.id.toString();

        // Create access token
        const accessToken = jwt.sign({
                id: newUserId,
                username: newUser.username,
                role: newUser.role
            },
            JWT_SECRET, {
                expiresIn: '1d'
            }
        );

        // Create refresh token
        const refreshToken = jwt.sign({
                id: newUserId
            },
            JWT_SECRET, {
                expiresIn: '7d'
            }
        );

        res.status(201).json({
            message: 'Member registered successfully',
            userId: newUserId,
            name: newUser.name,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role,
            status: newUser.status,
            accessToken,
            refreshToken
        });

    } catch (error) {
        console.error('REGISTER ERROR:', error);

        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

module.exports = router;