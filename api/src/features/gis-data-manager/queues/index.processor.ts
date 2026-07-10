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

      // versionId 是系统生成的 UUID，拼进索引名（标识符位置不能参数化——$executeRaw 会把
      // ${versionId} 变成 $1，标识符里出现 $1 会语法错）；sanitize 兜底，WHERE 的值仍走 $1 参数化防注入。
      const safeId = versionId.replace(/[^a-zA-Z0-9-]/g, '');

      // partial GIST on geometry（仅本 version 行）→ MVT bbox 查询走此索引
      await this.datasetService.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "idx_gisfeature_${safeId}_geometry" ON "GisFeature" USING GIST ("geometry") WHERE "versionId" = $1`,
        versionId,
      );

      // partial GIN on properties（属性筛选/搜索）
      await this.datasetService.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "idx_gisfeature_${safeId}_properties" ON "GisFeature" USING GIN ("properties") WHERE "versionId" = $1`,
        versionId,
      );

      this.logger.log(`Spatial index built for version ${versionId}`);
    } catch (error) {
      this.logger.error(`Failed to build spatial index: ${error.message}`);
      // Don't throw - index creation is not critical
    }
  }
}
