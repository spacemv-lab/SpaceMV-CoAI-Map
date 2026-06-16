-- CreateTable
CREATE TABLE "ProjectState" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "viewport" JSONB NOT NULL,
    "basemap" TEXT NOT NULL DEFAULT 'tianditu',
    "layers" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectState_projectId_key" ON "ProjectState"("projectId");

-- CreateIndex
CREATE INDEX "ProjectState_projectId_idx" ON "ProjectState"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectState"
ADD CONSTRAINT "ProjectState_projectId_fkey"
FOREIGN KEY ("projectId")
REFERENCES "Project"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
