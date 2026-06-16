/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `Dataset` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[datasetId,version]` on the table `DatasetVersion` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[externalId]` on the table `Project` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "MappingType" AS ENUM ('DIRECT', 'EXPRESSION', 'LOOKUP', 'CUSTOM');

-- DropForeignKey
ALTER TABLE "Dataset" DROP CONSTRAINT "Dataset_currentVersionId_fkey";

-- DropForeignKey
ALTER TABLE "Dataset" DROP CONSTRAINT "Dataset_projectId_fkey";

-- DropForeignKey
ALTER TABLE "DatasetVersion" DROP CONSTRAINT "DatasetVersion_datasetId_fkey";

-- DropForeignKey
ALTER TABLE "DatasetVersion" DROP CONSTRAINT "DatasetVersion_mappingProfileId_fkey";

-- DropForeignKey
ALTER TABLE "GisFeature" DROP CONSTRAINT "GisFeature_versionId_fkey";

-- DropForeignKey
ALTER TABLE "MappingProfile" DROP CONSTRAINT "MappingProfile_datasetId_fkey";

-- DropForeignKey
ALTER TABLE "ValidationReport" DROP CONSTRAINT "ValidationReport_versionId_fkey";

-- AlterTable
ALTER TABLE "Dataset" ADD COLUMN     "externalId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Dataset_externalId_key" ON "Dataset"("externalId");

-- CreateIndex
CREATE INDEX "Dataset_projectId_idx" ON "Dataset"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetVersion_datasetId_version_key" ON "DatasetVersion"("datasetId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Project_externalId_key" ON "Project"("externalId");

-- AddForeignKey
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "DatasetVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetVersion" ADD CONSTRAINT "DatasetVersion_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetVersion" ADD CONSTRAINT "DatasetVersion_mappingProfileId_fkey" FOREIGN KEY ("mappingProfileId") REFERENCES "MappingProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GisFeature" ADD CONSTRAINT "GisFeature_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "DatasetVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationReport" ADD CONSTRAINT "ValidationReport_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "DatasetVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MappingProfile" ADD CONSTRAINT "MappingProfile_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
