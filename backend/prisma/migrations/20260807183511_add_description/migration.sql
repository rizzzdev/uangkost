-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "description" TEXT,
ALTER COLUMN "category" SET DATA TYPE VARCHAR(100);
