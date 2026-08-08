-- DropIndex
DROP INDEX "users_deleted_at_idx";

-- AlterTable
ALTER TABLE "installments" ADD COLUMN     "payment_date" DATE;
