-- Standardize installment fields:
-- 1) Tanggal pembayaran manual dihapus (tanggal = createdAt otomatis).
-- 2) "note" di-rename ke "description" agar konsisten dengan Transaction.description
--    (RENAME COLUMN menjaga data note yang sudah ada).
ALTER TABLE "installments" DROP COLUMN "payment_date";
ALTER TABLE "installments" RENAME COLUMN "note" TO "description";
