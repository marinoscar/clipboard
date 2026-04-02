-- CreateTable
CREATE TABLE "personal_access_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "last_chars" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" DATETIME,
    CONSTRAINT "personal_access_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "personal_access_tokens_token_hash_key" ON "personal_access_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "personal_access_tokens_user_id_idx" ON "personal_access_tokens"("user_id");

-- CreateIndex
CREATE INDEX "personal_access_tokens_token_hash_idx" ON "personal_access_tokens"("token_hash");
