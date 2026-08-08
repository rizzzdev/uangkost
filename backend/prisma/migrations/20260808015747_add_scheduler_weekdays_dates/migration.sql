-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "bill_creation_dates" VARCHAR(100),
ADD COLUMN     "bill_creation_weekdays" VARCHAR(20),
ADD COLUMN     "reminder_dates" VARCHAR(100),
ADD COLUMN     "reminder_weekdays" VARCHAR(20);
