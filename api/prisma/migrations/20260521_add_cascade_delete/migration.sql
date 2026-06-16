-- Add cascade delete to foreign key constraints

-- Dataset -> Project
ALTER TABLE "Dataset"
DROP CONSTRAINT "Dataset_projectId_fkey",
ADD CONSTRAINT "Dataset_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"(id) ON DELETE CASCADE;

-- Dataset.currentVersion -> DatasetVersion (SetNull)
ALTER TABLE "Dataset"
DROP CONSTRAINT "Dataset_currentVersionId_fkey",
ADD CONSTRAINT "Dataset_currentVersionId_fkey"
FOREIGN KEY ("currentVersionId") REFERENCES "DatasetVersion"(id) ON DELETE SET NULL;

-- DatasetVersion -> Dataset
ALTER TABLE "DatasetVersion"
DROP CONSTRAINT "DatasetVersion_datasetId_fkey",
ADD CONSTRAINT "DatasetVersion_datasetId_fkey"
FOREIGN KEY ("datasetId") REFERENCES "Dataset"(id) ON DELETE CASCADE;

-- DatasetVersion -> MappingProfile (SetNull)
ALTER TABLE "DatasetVersion"
DROP CONSTRAINT "DatasetVersion_mappingProfileId_fkey",
ADD CONSTRAINT "DatasetVersion_mappingProfileId_fkey"
FOREIGN KEY ("mappingProfileId") REFERENCES "MappingProfile"(id) ON DELETE SET NULL;

-- GisFeature -> DatasetVersion
ALTER TABLE "GisFeature"
DROP CONSTRAINT "GisFeature_versionId_fkey",
ADD CONSTRAINT "GisFeature_versionId_fkey"
FOREIGN KEY ("versionId") REFERENCES "DatasetVersion"(id) ON DELETE CASCADE;

-- ValidationReport -> DatasetVersion
ALTER TABLE "ValidationReport"
DROP CONSTRAINT "ValidationReport_versionId_fkey",
ADD CONSTRAINT "ValidationReport_versionId_fkey"
FOREIGN KEY ("versionId") REFERENCES "DatasetVersion"(id) ON DELETE CASCADE;

-- MappingProfile -> Dataset
ALTER TABLE "MappingProfile"
DROP CONSTRAINT "MappingProfile_datasetId_fkey",
ADD CONSTRAINT "MappingProfile_datasetId_fkey"
FOREIGN KEY ("datasetId") REFERENCES "Dataset"(id) ON DELETE CASCADE;