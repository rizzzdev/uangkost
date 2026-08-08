-- Soft delete: nilai unik (phone, access_token) pada baris yang dihapus (deleted_at IS NOT NULL)
-- TIDAK boleh memblokir data baru dengan nilai yang sama.
-- Ganti unique constraint biasa dengan partial unique index (WHERE deleted_at IS NULL).

DROP INDEX IF EXISTS "users_phone_key";
DROP INDEX IF EXISTS "users_access_token_key";

CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_key" ON "users" ("phone") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "users_access_token_key" ON "users" ("access_token") WHERE "deleted_at" IS NULL;

-- Percepat query yang memfilter data non-terhapus
CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users" ("deleted_at");
