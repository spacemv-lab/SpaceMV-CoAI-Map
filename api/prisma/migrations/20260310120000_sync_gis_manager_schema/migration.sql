-- CreateEnum
CREATE TYPE "IngestStatus" AS ENUM ('PENDING', 'PARSING', 'VALIDATING', 'IMPORTING', 'INDEXING', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "Dataset"
ADD COLUMN "description" TEXT;

-- AlterTable
ALTER TABLE "DatasetVersion"
ADD COLUMN "status" "IngestStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "statusMessage" TEXT,
ADD COLUMN "sourceCRS" TEXT,
ADD COLUMN "targetCRS" TEXT,
ADD COLUMN "bbox" JSONB,
ADD COLUMN "mappingProfileId" TEXT,
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3);

ALTER TABLE "DatasetVersion"
ALTER COLUMN "recordCount" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "ValidationReport" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "geometryErrors" JSONB,
    "attributeErrors" JSONB,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValidationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MappingProfile" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceType" TEXT NOT NULL,
    "mappings" JSONB NOT NULL,
    "crs" TEXT,
    "geometryColumn" TEXT,
    "geometryType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MappingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dataset_currentVersionId_key" ON "Dataset"("currentVersionId");

-- CreateIndex
CREATE INDEX "DatasetVersion_datasetId_idx" ON "DatasetVersion"("datasetId");

-- CreateIndex
CREATE INDEX "DatasetVersion_status_idx" ON "DatasetVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationReport_versionId_key" ON "ValidationReport"("versionId");

-- CreateIndex
CREATE INDEX "ValidationReport_versionId_idx" ON "ValidationReport"("versionId");

-- CreateIndex
CREATE INDEX "MappingProfile_datasetId_idx" ON "MappingProfile"("datasetId");

-- AddForeignKey
ALTER TABLE "Dataset"
ADD CONSTRAINT "Dataset_currentVersionId_fkey"
FOREIGN KEY ("currentVersionId")
REFERENCES "DatasetVersion"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetVersion"
ADD CONSTRAINT "DatasetVersion_mappingProfileId_fkey"
FOREIGN KEY ("mappingProfileId")
REFERENCES "MappingProfile"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationReport"
ADD CONSTRAINT "ValidationReport_versionId_fkey"
FOREIGN KEY ("versionId")
REFERENCES "DatasetVersion"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MappingProfile"
ADD CONSTRAINT "MappingProfile_datasetId_fkey"
FOREIGN KEY ("datasetId")
REFERENCES "Dataset"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
