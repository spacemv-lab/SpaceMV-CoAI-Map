-- CreateTable
CREATE TABLE "TileSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "DatasetScope" NOT NULL DEFAULT 'GLOBAL',
    "ownerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "credential" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TileSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TileSource_scope_ownerId_idx" ON "TileSource"("scope", "ownerId");

-- CreateIndex
CREATE INDEX "TileSource_ownerId_kind_idx" ON "TileSource"("ownerId", "kind");
