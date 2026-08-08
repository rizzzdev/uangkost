-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'partial';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "total_paid" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "installments" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_proof_url" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
