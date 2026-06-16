-- AddDatasetFields migration
-- Create DatasetField table and add relation to Dataset

-- Create DatasetField table
CREATE TABLE IF NOT EXISTS "DatasetField" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "datasetId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "alias" TEXT,
  "type" TEXT NOT NULL,
  "nullable" BOOLEAN NOT NULL DEFAULT true,
  "sampleValue" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint
ALTER TABLE "DatasetField"
ADD CONSTRAINT "DatasetField_datasetId_fkey"
FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add unique constraint on datasetId + name
ALTER TABLE "DatasetField"
ADD CONSTRAINT "DatasetField_datasetId_name_unique"
UNIQUE ("datasetId", "name");

-- Create index on datasetId
CREATE INDEX IF NOT EXISTS "DatasetField_datasetId_idx" ON "DatasetField"("datasetId");