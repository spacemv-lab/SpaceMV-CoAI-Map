-- Add DatasetScope enum for data classification

-- Create enum
CREATE TYPE "DatasetScope" AS ENUM ('GLOBAL', 'PROJECT');

-- Add scope column with default
ALTER TABLE "Dataset" ADD COLUMN "scope" "DatasetScope" NOT NULL DEFAULT 'PROJECT';

-- Make projectId nullable for global datasets
ALTER TABLE "Dataset" ALTER COLUMN "projectId" DROP NOT NULL;

-- Update existing data: all current datasets are PROJECT scope (default already set)
-- No need for explicit UPDATE since default is PROJECT

-- Add index for scope queries
CREATE INDEX "Dataset_scope_idx" ON "Dataset"("scope");

-- Create partial index for projectId when not null
CREATE INDEX "Dataset_projectId_idx" ON "Dataset"("projectId") WHERE "projectId" IS NOT NULL;