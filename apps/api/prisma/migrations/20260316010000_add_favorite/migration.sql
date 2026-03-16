ALTER TABLE "clipboard_items" ADD COLUMN "is_favorite" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "clipboard_items_user_id_is_favorite_idx" ON "clipboard_items"("user_id", "is_favorite");
