-- CreateEnum
CREATE TYPE "SchedulerLogType" AS ENUM ('reminder', 'bill_creation');

-- CreateEnum
CREATE TYPE "SchedulerLogStatus" AS ENUM ('success', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "scheduler_logs" (
    "id" TEXT NOT NULL,
    "type" "SchedulerLogType" NOT NULL,
    "status" "SchedulerLogStatus" NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduler_logs_pkey" PRIMARY KEY ("id")
);
