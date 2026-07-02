-- AddWhiteboardDoc
-- 项目白板：一站式配图（tldraw 画布文档）。仅含本模型的 DDL；
-- 该 dev 库存在既有漂移（Dataset/DatasetVersion 等缺索引/FK），不在本次范围内，故手工只应用本表。
-- DDL 由 `prisma migrate diff --from-url ... --to-schema-datamodel prisma/schema.prisma --script` 中本模型部分摘出。

-- CreateTable
CREATE TABLE "WhiteboardDoc" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "document" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhiteboardDoc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhiteboardDoc_projectId_key" ON "WhiteboardDoc"("projectId");

-- CreateIndex
CREATE INDEX "WhiteboardDoc_projectId_idx" ON "WhiteboardDoc"("projectId");

-- AddForeignKey
ALTER TABLE "WhiteboardDoc" ADD CONSTRAINT "WhiteboardDoc_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
