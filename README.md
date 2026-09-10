# 🏠 Household Food Cost Sharing & Meal Management System

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.x-000000?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![Swagger](https://img.shields.io/badge/Docs-Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)
![Render](https://img.shields.io/badge/Deployed-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)

**A backend RESTful API for households and roommates to track shared meals, split grocery bills, and settle food costs fairly — automatically.**

[🚀 Live API](https://household-food-system.onrender.com) · [📚 Swagger Docs](https://household-food-system.onrender.com/swagger-ui/) · [🐛 Report an Issue](https://github.com/SARONCHAIRIN/household-food-system/issues)

</div>

---

## 📑 Table of Contents

- [About the Project](#-about-the-project)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [System Preview](#-system-preview)
- [Architecture & Flow](#-architecture--flow)
- [Data Model](#-data-model)
- [API Reference](#-api-reference)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Project Structure](#-project-structure)
- [Roles & Permissions](#-roles--permissions)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 📖 About The Project

Splitting food costs fairly between roommates or family members is usually a manual, error-prone chore — someone tracks a spreadsheet, someone forgets to log a grocery run, and disagreements follow.

The **Household Food Cost Sharing & Meal Management System** replaces that spreadsheet with a proper backend service. Members mark whether they're eating a given day, an admin logs the day's grocery and food spend, and a calculation engine works out — per member, per period — exactly how much of the food pool and shared ingredient pool each person owes.

---

## ✨ Key Features

| | Feature | Description |
|---|---|---|
| 🔐 | **Authentication & Authorization** | JWT-based login and registration with role-based access control (`ADMIN` / `MEMBER`). |
| 🍳 | **Meal Status Tracking** | Members mark themselves as eating (`EAT`) or not (`NOT_EAT`) on a given day, auto- or manually confirmed. |
| 🛒 | **Daily Cost Logging** | Admins record daily food price and shared-ingredient price for the household. |
| 💸 | **Automated Bill Sharing** | A calculation engine splits food cost across the members who actually ate each day, and splits shared ingredient cost evenly across active members — for any date range. |
| 👥 | **Member Administration** | Admins can view all members and update a member's status (`ACTIVE` / `INACTIVE`). |
| 📚 | **Interactive API Docs** | Full OpenAPI/Swagger documentation, live at [`/swagger-ui`](https://household-food-system.onrender.com/swagger-ui/). |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18.x |
| Framework | Express 5 |
| Database | PostgreSQL |
| Schema / ORM | Prisma (schema definition; queries run via `pg`) |
| Auth | JWT (`jsonwebtoken`) + `bcrypt` password hashing |
| API Docs | `swagger-jsdoc` + `swagger-ui-express` |
| Deployment | Render |
| Local DB tooling | Docker Compose (MySQL/Adminer for local dev tooling) |

---

## 📸 System Preview

<div align="center">
  <img src="api/assets/swagger-preview.png" alt="API Swagger UI Preview" width="85%"/>
</div>

<div align="center"><sub>Live Swagger UI — try it yourself at <a href="https://household-food-system.onrender.com/swagger-ui/">household-food-system.onrender.com/swagger-ui</a></sub></div>

---

## 🔄 Architecture & Flow

```mermaid
flowchart TD
    A[User / Admin Registration & Login] --> B[Household Membership<br/>Admin manages members & status]
    B --> C[Meal Status Entry<br/>Members mark EAT / NOT_EAT per day]
    B --> D[Daily Cost Recording<br/>Admin logs food & ingredient price]
    C --> E[Bill Sharing Calculation Engine]
    D --> E
    E --> F[Per-Member Settlement Summary<br/>food cost + ingredient cost = total due]
```

**How the split works:**
1. Each day's **food cost** is divided only among the members who marked `EAT` that day.
2. Each day's **ingredient cost** pool is divided evenly across all currently **active** members, regardless of daily attendance.
3. Summed over the requested date range, this produces a fair `totalDue` per member.

---

## 🗄 Data Model

```mermaid
erDiagram
    USERS ||--o{ MEAL_STATUS : logs
    USERS ||--o{ DAILY_FOOD_COST : records
    USERS ||--o{ MEMBER_WEEK_SUMMARY : has
    USERS ||--o{ AUDIT_LOG : triggers

    USERS {
        bigint id PK
        string name
        string username
        string email
        string passwordHash
        enum role "ADMIN | USER"
        enum status "ACTIVE | INACTIVE"
        date joinedAt
        date inactiveAt
    }
    DAILY_FOOD_COST {
        bigint id PK
        date date
        decimal foodPrice
        decimal ingredientPrice
        int eatCount
        int totalMemberCount
        enum calculationStatus "PENDING | COMPLETED"
    }
    MEAL_STATUS {
        bigint id PK
        bigint memberId FK
        date date
        enum status "EAT | NOT_EAT"
        enum confirmationType "AUTO | MANUAL"
        decimal costTotal
    }
    MEMBER_WEEK_SUMMARY {
        bigint id PK
        bigint memberId FK
        date weekStart
        date weekEnd
        decimal totalCost
    }
    AUDIT_LOG {
        bigint id PK
        bigint userId FK
        string action
        string entityType
    }
```

---

## 📡 API Reference

Base URL: `https://household-food-system.onrender.com/api/v1` &nbsp;·&nbsp; Full interactive docs: [`/swagger-ui`](https://household-food-system.onrender.com/swagger-ui/)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register a new member (`ADMIN`, `MEMBER`, or `USER`). Returns access + refresh tokens. |
| `POST` | `/auth/login` | Public | Authenticate with username/password. Returns access + refresh tokens. |
| `GET` | `/members` | Public | List all household members. |
| `PATCH` | `/users/:id/status` | 🔒 Admin | Update a member's status (`ACTIVE` / `INACTIVE`). |
| `GET` | `/daily-costs` | 🔑 Token | List recorded daily food/ingredient costs. |
| `POST` | `/daily-costs` | 🔒 Admin | Record a new day's food & ingredient cost. |
| `GET` | `/meal-statuses` | 🔑 Token | List meal statuses (who's eating, on what day). |
| `POST` | `/meal-statuses` | 🔑 Token | Set or update your meal status for a given date. |
| `GET` | `/bills/summary` | 🔒 Admin | Calculate each member's cost breakdown for a `startDate`–`endDate` range. |

**Legend:** 🔑 Token = any authenticated member · 🔒 Admin = `ADMIN` role required (`Authorization: Bearer <token>`)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18.x or higher
- A PostgreSQL database (local or hosted, e.g. Render/Supabase)
- npm

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/SARONCHAIRIN/household-food-system.git
cd household-food-system/api

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env   # then fill in the values (see below)

# 4. (Optional) Generate the Prisma client / run migrations
npx prisma generate
npx prisma migrate dev

# 5. Start the server
npm run dev      # development, with nodemon
npm start        # production
```

The API will be available at `http://localhost:10000`, with Swagger docs at `http://localhost:10000/swagger-ui`.

---

## 🔑 Environment Variables

Create a `.env` file inside `/api` with the following:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string, e.g. `postgresql://user:pass@host:5432/dbname` |
| `JWT_SECRET` | ✅ | Secret key used to sign access & refresh tokens |
| `PORT` | ⬜ | Port to run the server on (defaults to `10000`) |
| `RENDER_EXTERNAL_URL` | ⬜ | Public server URL, used to populate Swagger's server list in production |

---

## 📁 Project Structure

```text
household-food-system/
├── docker-compose.yml        # Local DB tooling (MySQL + Adminer)
└── api/
    ├── assets/
    │   └── swagger-preview.png
    ├── prisma/
    │   └── schema.prisma      # Data model definition
    └── src/
        ├── server.js           # App entry point & Swagger setup
        ├── prismaClient.js     # DB connection layer
        ├── middleware/
        │   └── auth.middleware.js   # verifyToken / verifyAdmin
        ├── routes/
        │   ├── auth.routes.js
        │   ├── members.routes.js
        │   ├── users.routes.js
        │   ├── dailyCost.routes.js
        │   ├── mealStatus.routes.js
        │   └── billSharing.routes.js
        └── services/
            └── costSharingEngine.js
```

---

## 👥 Roles & Permissions

| Action | Member | Admin |
|---|:---:|:---:|
| Register / Login | ✅ | ✅ |
| View members list | ✅ | ✅ |
| Set own meal status | ✅ | ✅ |
| View daily costs / meal statuses | ✅ | ✅ |
| Record daily food/ingredient cost | ❌ | ✅ |
| Update a member's status | ❌ | ✅ |
| View bill-sharing summary | ❌ | ✅ |

---

## 🗺 Roadmap

- [ ] Add automated tests (unit + integration)
- [ ] Add `.env.example` file to the repository
- [ ] Migrate raw SQL queries fully onto Prisma Client
- [ ] Add per-member settlement history endpoint
- [ ] Add pagination & filtering to list endpoints
- [ ] Add a companion frontend (web/mobile) client

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

No license has been specified for this project yet. Consider adding a [LICENSE](https://choosealicense.com/) file (e.g. MIT) to clarify how others may use this code.

---

<div align="center">
<sub>Built with ❤️ by <a href="https://github.com/SARONCHAIRIN">SARONCHAIRIN</a></sub>
</div>