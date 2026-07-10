-- AddColumn: TileSource COG 转码状态(仅 kind='titiler-cog' 用;tianditu 恒 READY)
ALTER TABLE "TileSource" ADD COLUMN     "ingestStatus" TEXT NOT NULL DEFAULT 'READY',
ADD COLUMN     "statusMessage" TEXT;
