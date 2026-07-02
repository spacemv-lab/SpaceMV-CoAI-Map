-- AddWhiteboardPreview
-- 给 WhiteboardDoc 加 previewDataUrl 列（发布的预览图 PNG dataURL）。
-- dev 库有既有漂移，手工只应用本列；DDL 由 migrate diff 中本列部分摘出。

ALTER TABLE "WhiteboardDoc" ADD COLUMN "previewDataUrl" TEXT;
