-- AddWhiteboardTemplate
-- 白板模板：保存的画板快照（shapes + assets）+ 名称 + 缩略图。跨项目共享，owner 可删。
-- dev 库存在既有漂移，手工只应用本表；DDL 由 migrate diff 中本模型部分摘出，列类型对齐 WhiteboardDoc。

CREATE TABLE "WhiteboardTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "thumbnailUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhiteboardTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WhiteboardTemplate_ownerId_idx" ON "WhiteboardTemplate"("ownerId");
