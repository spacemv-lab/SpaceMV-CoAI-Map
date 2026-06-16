/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ExternalDataSyncService, ExternalDataSourceConfig, FetchedData } from '../services/external-data-sync.base';
import { DatasetService } from '../lib/dataset.service';
import { GisQueue } from '../queues/gis.queue';
import { OpenSkyAdapter } from '../adapters/opensky.adapter';
import { GeometryType } from '@prisma/client';

/**
 * ADS-B 数据同步服务
 *
 * 定时从 OpenSky Network 抓取全球航空器位置数据
 */
@Injectable()
export class AdsbSyncService extends ExternalDataSyncService implements OnModuleInit {
  protected readonly logger = new Logger(AdsbSyncService.name);

  readonly config: ExternalDataSourceConfig = {
    sourceName: 'OpenSky Network',
    datasetName: 'Global ADS-B',
    geometryType: GeometryType.POINT,
    sourceType: 'SYNC',
    defaultTags: ['ads-b', 'aviation', 'real-time'],
    externalId: 'global-adsb', // 唯一标识，避免与其他数据源冲突
  };

  constructor(
    datasetService: DatasetService,
    gisQueue: GisQueue,
    private openSkyAdapter: OpenSkyAdapter,
  ) {
    super(datasetService, gisQueue);
  }

  async onModuleInit() {
    this.logger.log('AdsbSyncService 初始化完成');
  }

  /**
   * 抓取 ADS-B 数据
   */
  async fetchData(): Promise<FetchedData> {
    return this.openSkyAdapter.getAllStates();
  }
}
