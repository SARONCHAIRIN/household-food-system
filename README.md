# 🏠 Household Food Cost Sharing & Meal Management System

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18.x-green?style=for-the-badge&logo=node.js)
![Express.js](https://img.shields.io/badge/Express.js-4.x-black?style=for-the-badge&logo=express)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-316192?style=for-the-badge&logo=postgresql)
![Render](https://img.shields.io/badge/Render-Deployed-46E3B7?style=for-the-badge&logo=render)

A robust backend RESTful API designed to streamline household management, daily food cost tracking, meal status coordination, and fair bill-sharing calculations among members.

[🚀 **Access Live API / Swagger Documentation**](https://household-food-system.onrender.com)

</div>

---

## 📸 System Preview
> *Put your UI screenshots or Swagger API preview inside an `assets` folder in your repository and link them below.*

<div align="center">
  <img src="assets/swagger-preview.png" alt="API Swagger UI Preview" width="85%"/>
</div>

---

## 📖 About The Project

Managing shared living spaces, food expenses, and meal counts can be chaotic. The **Household Food Cost Sharing & Meal Management System** solves this by providing a centralized digital hub. It automates daily meal tracking, records food-related expenditures, and calculates precise cost-sharing metrics per member for transparent and fair financial splitting.

---

## ✨ Key Features

*   **🔐 Authentication & Authorization:** Secure user registration and login using JWT with role-based access control (Admin & Members).
*   **🍳 Meal Status Management:** Daily tracking of who is eating or participating in home-cooked meals to ensure fair grocery calculations.
*   **🛒 Daily Cost Tracking:** Recording and categorizing daily food expenses and grocery shopping bills.
*   **💸 Bill Sharing & Settlement:** Automated calculation engine that splits total monthly or period expenses proportionally among active household members.
*   **👥 Member & Status Administration:** Admins can manage household users and update member statuses directly through protected endpoints.
*   **📚 Interactive API Documentation:** Fully documented via Swagger UI for seamless integration with mobile or web frontends.

---

## 🔄 System Feature Flow

```text
[ User / Admin Registration & Login ]
                 │
                 ▼
     [ Household Membership ] 
  (Admin adds users/members to home)
                 │
        ┌────────┴────────┐
        ▼                 ▼
[ Meal Status Entry ] [ Daily Cost Recording ]
  (Track meals)         (Log grocery/food bills)
        │                 │
        └────────┬────────┘
                 ▼
  [ Bill Sharing Calculation Engine ]
   (Computes monthly individual splits)
