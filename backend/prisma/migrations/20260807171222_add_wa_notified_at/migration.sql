-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "wa_notified_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL;
