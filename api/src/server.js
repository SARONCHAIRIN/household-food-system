const express = require('express');
const cors = require('cors');
require('dotenv').config();
const prisma = require('./prismaClient');

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
app.use(express.json());
app.use(cors());

// Render ມັກប្រើ Port 10000 ជាលំនាំដើម ប្រសិនបើមិនបានកំណត់ក្នុង Env
const PORT = process.env.PORT || 10000;

// --- Import Routes ---
const authRoutes = require('./routes/auth.routes');
const membersRoutes = require('./routes/members.routes');
const dailyCostRoutes = require('./routes/dailyCost.routes');
const mealStatusRoutes = require('./routes/mealStatus.routes');
const billSharingRoutes = require('./routes/billSharing.routes');
const userRoutes = require('./routes/users.routes');
const depositsRoutes = require('./routes/deposits.routes');

// --- Register Routes ---
app.use('/api/v1/daily-costs', dailyCostRoutes);
app.use('/api/v1/meal-statuses', mealStatusRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/members', membersRoutes);
app.use('/api/v1/bills', billSharingRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1', depositsRoutes);


// --- Swagger Configuration ---
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Household Food Cost Sharing & Meal Management System API',
            version: '1.0.0',
            description: 'API documentation for managing household meals, daily costs, and bill sharing.',
        },
        // កែចំណុចនេះ៖ ប្រើប្រាស់ Array ស្ራល ឬ Relative Path ដើម្បីឱ្យវាត្រូវទាំង Local និង Render
        servers: [{
            url: process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`,
            description: 'Active Server (Local or Render)',
        }, ],
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
    apis: ['./src/server.js', './src/routes/*.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

app.use('/swagger-ui', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.get('/', (req, res) => {
    res.redirect('/swagger-ui');
});

// --- Test Route ---
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

// បន្ថែម '0.0.0.0' ដើម្បីឱ្យ Render Server ស្គាល់ Host ត្រឹមត្រូវ
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Swagger UI available at http://localhost:${PORT}/swagger-ui`);
});