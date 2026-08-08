-- AlterTable
ALTER TABLE "installments" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3);

-- Backfill existing rows (updated_at defaults to created_at)
UPDATE "installments" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;

-- Set NOT NULL now that all rows have a value
ALTER TABLE "installments" ALTER COLUMN "updated_at" SET NOT NULL;
