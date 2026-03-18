/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Injectable, Logger } from '@nestjs/common';
import { DatasetService } from '../lib/dataset.service';

/**
 * Index processor for building spatial indexes
 */
@Injectable()
export class IndexProcessor {
  private readonly logger = new Logger(IndexProcessor.name);

  constructor(private datasetService: DatasetService) {}

  /**
   * Build spatial index for a dataset version
   */
  async buildIndex(versionId: string): Promise<void> {
    this.logger.log(`Building spatial index for version ${versionId}`);

    try {
      // Update status to INDEXING
      await this.datasetService.datasetVersion.update({
        where: { id: versionId },
        data: { status: 'INDEXING' },
      });

      // Create GIST index on geometry column
      // Note: This requires direct SQL execution
      await this.datasetService.$executeRaw`
        CREATE INDEX IF NOT EXISTS "idx_gisfeature_${versionId}_geometry"
        ON "GisFeature"
        USING GIST ("geometry")
        WHERE "versionId" = ${versionId}
      `;

      // Create index on properties for common queries
      await this.datasetService.$executeRaw`
        CREATE INDEX IF NOT EXISTS "idx_gisfeature_${versionId}_properties"
        ON "GisFeature"
        USING GIN ("properties")
        WHERE "versionId" = ${versionId}
      `;

      this.logger.log(`Spatial index built for version ${versionId}`);
    } catch (error) {
      this.logger.error(`Failed to build spatial index: ${error.message}`);
      // Don't throw - index creation is not critical
    }
  }
}
