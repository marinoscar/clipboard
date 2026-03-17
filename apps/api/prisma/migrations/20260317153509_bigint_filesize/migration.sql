/*
  Warnings:

  - You are about to alter the column `file_size` on the `clipboard_items` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_clipboard_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "file_name" TEXT,
    "file_size" BIGINT,
    "mime_type" TEXT,
    "storage_key" TEXT,
    "thumbnail_key" TEXT,
    "metadata" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "share_token" TEXT,
    "s3_upload_id" TEXT,
    "upload_status" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "clipboard_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_clipboard_items" ("content", "created_at", "file_name", "file_size", "id", "is_favorite", "is_public", "metadata", "mime_type", "s3_upload_id", "share_token", "status", "storage_key", "thumbnail_key", "type", "updated_at", "upload_status", "user_id") SELECT "content", "created_at", "file_name", "file_size", "id", "is_favorite", "is_public", "metadata", "mime_type", "s3_upload_id", "share_token", "status", "storage_key", "thumbnail_key", "type", "updated_at", "upload_status", "user_id" FROM "clipboard_items";
DROP TABLE "clipboard_items";
ALTER TABLE "new_clipboard_items" RENAME TO "clipboard_items";
CREATE UNIQUE INDEX "clipboard_items_share_token_key" ON "clipboard_items"("share_token");
CREATE INDEX "clipboard_items_user_id_status_idx" ON "clipboard_items"("user_id", "status");
CREATE INDEX "clipboard_items_user_id_created_at_idx" ON "clipboard_items"("user_id", "created_at");
CREATE INDEX "clipboard_items_share_token_idx" ON "clipboard_items"("share_token");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
