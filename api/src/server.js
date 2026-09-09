const express = require('express');
const cors = require('cors');
require('dotenv').config();
const prisma = require('./prismaClient');

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// --- Import Routes ---
const authRoutes = require('./routes/auth.routes');
const membersRoutes = require('./routes/members.routes');


//--- Import Daily Cost Routes ---
const dailyCostRoutes = require('./routes/dailyCost.routes');
app.use('/api/v1/daily-costs', dailyCostRoutes);

//--- Import Meal Status Routes ---
const mealStatusRoutes = require('./routes/mealStatus.routes');
app.use('/api/v1/meal-statuses', mealStatusRoutes);

// --- Register Routes ---
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/members', membersRoutes);


// --- Import Bill Sharing Routes ---
const billSharingRoutes = require('./routes/billSharing.routes');
app.use('/api/v1/bills', billSharingRoutes);

// --- Import User Routes ---
const userRoutes = require('./routes/users.routes'); // ឈ្មោះឯកសារតាមที่คุณបានរក្សាទុក

// ត្រូវធានាថាមានការភ្ជាប់ Path Prefix នេះ៖
app.use('/api/v1/users', userRoutes);

// --- Swagger Configuration ---
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Household Food Cost Sharing & Meal Management System API',
            version: '1.0.0',
            description: 'API documentation for managing household meals, daily costs, and bill sharing.',
        },
        servers: [{
            url: `http://localhost:${PORT}`,
            description: 'Local Development Server',
        }],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
    },
    apis: ['./src/server.js', './src/routes/*.js'], // អាន JSDoc ទាំងក្នុង server.js និង ថត routes
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

// Swagger UI Route ស្រដៀង Spring Boot
app.use('/swagger-ui', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Redirect root ទៅកាន់ swagger-ui
app.get('/', (req, res) => {
    res.redirect('/swagger-ui');
});

// --- API Endpoints (Test route) ---
/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: Get all system users
 *     description: Retrieve a list of all users/members in the household database.
 *     responses:
 *       200:
 *         description: A list of users.
 *       500:
 *         description: Internal server error.
 */
app.get('/api/v1/users', async(req, res) => {
    try {
        const users = await prisma.user.findMany();
        const formattedUsers = users.map(user => ({
            ...user,
            id: user.id.toString()
        }));
        res.json(formattedUsers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Swagger UI available at http://localhost:${PORT}/swagger-ui`);
});