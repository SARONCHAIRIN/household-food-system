-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "USERS" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "joined_at" DATE,
    "inactive_at" DATE,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "refresh_token" TEXT,

    CONSTRAINT "USERS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DAILY_FOOD_COST" (
    "id" BIGSERIAL NOT NULL,
    "date" DATE NOT NULL,
    "food_price" DECIMAL(10,2),
    "ingredient_price" DECIMAL(10,2),
    "eat_count" INTEGER,
    "total_member_count" INTEGER,
    "cost_food_per_person" DECIMAL(10,2),
    "cost_ingredient_per_person" DECIMAL(10,2),
    "calculation_status" VARCHAR(20) NOT NULL,
    "confirmed_at" TIMESTAMP(6),
    "created_by" BIGINT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DAILY_FOOD_COST_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MEAL_STATUS" (
    "id" BIGSERIAL NOT NULL,
    "member_id" BIGINT NOT NULL,
    "date" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "confirmation_type" VARCHAR(20) NOT NULL,
    "confirmed_at" TIMESTAMP(6),
    "cost_food" DECIMAL(10,2),
    "cost_ingredient" DECIMAL(10,2),
    "cost_total" DECIMAL(10,2),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MEAL_STATUS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MEMBER_WEEK_SUMMARY" (
    "id" BIGSERIAL NOT NULL,
    "member_id" BIGINT NOT NULL,
    "week_start" DATE NOT NULL,
    "week_end" DATE NOT NULL,
    "eat_days" INTEGER,
    "dont_eat_days" INTEGER,
    "total_food_cost" DECIMAL(10,2),
    "total_ingredient_cost" DECIMAL(10,2),
    "total_cost" DECIMAL(10,2),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MEMBER_WEEK_SUMMARY_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "action" VARCHAR(255) NOT NULL,
    "entity_type" VARCHAR(100),
    "entity_id" BIGINT,
    "old_value" TEXT,
    "new_value" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_deposits" (
    "id" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
    "user_id" BIGINT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BILL_SETTLEMENTS" (
    "id" BIGSERIAL NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "settled_by" BIGINT,
    "total_food_cost" DECIMAL(10,2),
    "total_ingredient_cost" DECIMAL(10,2),
    "total_due_all" DECIMAL(10,2),
    "results" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BILL_SETTLEMENTS_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meal_status_member_date_unique" ON "MEAL_STATUS"("member_id", "date");

-- CreateIndex
CREATE INDEX "idx_member_deposits_user_id" ON "member_deposits"("user_id");

-- CreateIndex
CREATE INDEX "idx_bill_settlements_created_at" ON "BILL_SETTLEMENTS"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "DAILY_FOOD_COST" ADD CONSTRAINT "daily_food_cost_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MEAL_STATUS" ADD CONSTRAINT "meal_status_member_fk" FOREIGN KEY ("member_id") REFERENCES "USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MEMBER_WEEK_SUMMARY" ADD CONSTRAINT "member_week_summary_member_fk" FOREIGN KEY ("member_id") REFERENCES "USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_fk" FOREIGN KEY ("user_id") REFERENCES "USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "member_deposits" ADD CONSTRAINT "fk_member_deposits_user" FOREIGN KEY ("user_id") REFERENCES "USERS"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "BILL_SETTLEMENTS" ADD CONSTRAINT "bill_settlements_settled_by_fk" FOREIGN KEY ("settled_by") REFERENCES "USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

