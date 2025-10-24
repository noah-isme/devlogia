-- Add full-text search vector for posts
ALTER TABLE "Post"
ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("summary", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("contentMdx", '')), 'C')
) STORED;

CREATE INDEX "Post_searchVector_idx" ON "Post" USING GIN ("searchVector");
CREATE INDEX IF NOT EXISTS "Post_status_publishedAt_idx" ON "Post" ("status", "publishedAt");
