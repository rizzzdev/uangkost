/*
  Warnings:

  - You are about to drop the column `access_token` on the `users` table. All the data in the column will be lost.
*/
-- DropIndex (IF EXISTS: aman untuk shadow DB / state berbeda)
DROP INDEX IF EXISTS "users_deleted_at_idx";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "access_token",
ADD COLUMN     "access_token_expires_at" TIMESTAMP(3),
ADD COLUMN     "access_token_hash" VARCHAR(64);

-- Index unik lama (users_access_token_key) ikut terhapus bersama kolom access_token.
-- Buat ulang sebagai partial unique index pada HASH (WHERE deleted_at IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS "users_access_token_key" ON "users" ("access_token_hash") WHERE "deleted_at" IS NULL;

-- Index pendukung query non-deleted (dibuat ulang)
CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users" ("deleted_at");
