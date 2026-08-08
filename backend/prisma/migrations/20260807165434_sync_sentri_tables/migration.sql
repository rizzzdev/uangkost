-- CreateTable
CREATE TABLE "sentri_identifiers" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sentri_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sentri_sessions" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "replaced_by" VARCHAR(36),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sentri_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sentri_users" (
    "id" VARCHAR(36) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "roles" TEXT NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sentri_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sentri_identifiers_value_key" ON "sentri_identifiers"("value");

-- CreateIndex
CREATE INDEX "idx_sentri_identifiers_user_id" ON "sentri_identifiers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sentri_identifiers_user_id_type_unique" ON "sentri_identifiers"("user_id", "type");

-- CreateIndex
CREATE INDEX "idx_sentri_sessions_user_id" ON "sentri_sessions"("user_id");

-- AddForeignKey
ALTER TABLE "sentri_identifiers" ADD CONSTRAINT "sentri_identifiers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "sentri_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sentri_sessions" ADD CONSTRAINT "sentri_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "sentri_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
