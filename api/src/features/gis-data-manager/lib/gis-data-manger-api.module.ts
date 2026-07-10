/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatasetController } from './dataset.controller';
import { ProjectController } from './project.controller';
import { StorageStatsController } from './storage-stats.controller';
import { ExternalDataController } from './external-data.controller';
import { PublicShareController } from './public-share.controller';
import { ProjectShareController } from './project-share.controller';
import { ProjectShareService } from './project-share.service';
import { WhiteboardController } from './whiteboard.controller';
import { WhiteboardService } from './whiteboard.service';
import { WhiteboardTemplateController } from './whiteboard-template.controller';
import { WhiteboardTemplateService } from './whiteboard-template.service';
import { TileSourceController } from './tile-source.controller';
import { TileSourceService } from './tile-source.service';
import { DatasetService } from './dataset.service';
import { GisParseService } from '../services/gis-parse.service';
import { ValidationService } from '../services/validation.service';
import { MappingProfileService } from '../services/mapping-profile.service';
import { StorageStatsService } from '../services/storage-stats.service';
import { MinioService } from '../services/minio.service';
import { GisQueue } from '../queues/gis.queue';
import { GisProcessor } from '../queues/gis.processor';
import { CogQueue } from '../queues/cog.queue';
import { CogProcessor } from '../queues/cog.processor';
import { IndexProcessor } from '../queues/index.processor';
import { GeometryValidator } from '../validators/geometry.validator';
import { CrsValidator } from '../validators/crs.validator';
import { GeoJsonAdapter } from '../adapters/geojson.adapter';
import { ShapefileAdapter } from '../adapters/shapefile.adapter';
import { KmlAdapter } from '../adapters/kml.adapter';
import { TableAdapter } from '../adapters/table.adapter';
import { GdalService } from '../utils/gdal.service';
// 外部数据同步服务
import { ExternalDataSyncService } from '../services/external-data-sync.base';
import { OpenSkyAdapter } from '../adapters/opensky.adapter';
import { AISStreamAdapter } from '../adapters/aisstream.adapter';
import { FleetMonAdapter } from '../adapters/fleetmon.adapter';
import { OpenSeaMapAdapter } from '../adapters/openseamap.adapter';
import { AISHubAdapter } from '../adapters/aishub.adapter';
import { AdsbSyncService } from '../services/adsb-sync.service';
import { AisSourceFactoryService } from '../services/ais-source-factory.service';
import { ExternalDataSyncScheduler } from '../services/external-data-sync.scheduler';
import { ExternalDataConfigService } from '../services/external-data-config.service';
import { SyncStatusService } from '../services/sync-status.service';
import { FieldStatsService } from './field-stats.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '../.envs/map-ai/dev/api.env',
        '.envs/map-ai/dev/api.env',
      ],
    }),
  ],
  controllers: [
    ProjectController,
    DatasetController,
    StorageStatsController,
    ExternalDataController,
    PublicShareController,
    ProjectShareController,
    WhiteboardController,
    WhiteboardTemplateController,
    TileSourceController,
  ],
  providers: [
    // Core Services
    GdalService,
    DatasetService,
    ProjectShareService,
    WhiteboardService,
    WhiteboardTemplateService,
    TileSourceService,
    GisParseService,
    ValidationService,
    MappingProfileService,
    StorageStatsService,
    MinioService,

    // Queues and Processors
    GisQueue,
    GisProcessor,
    IndexProcessor,
    CogQueue,
    CogProcessor,

    // Validators
    GeometryValidator,
    CrsValidator,

    // Adapters
    GeoJsonAdapter,
    ShapefileAdapter,
    KmlAdapter,
    TableAdapter,

    // 外部数据同步服务
    OpenSkyAdapter,
    AISStreamAdapter,
    FleetMonAdapter,
    OpenSeaMapAdapter,
    AISHubAdapter,
    AdsbSyncService,
    AisSourceFactoryService,
    ExternalDataSyncScheduler,
    ExternalDataConfigService,
    SyncStatusService,
    FieldStatsService,
  ],
  exports: [
    DatasetService,
    GisParseService,
    ValidationService,
    MappingProfileService,
    StorageStatsService,
    MinioService,
    GisQueue,
    GeometryValidator,
    CrsValidator,
    // 导出外部数据同步服务
    AdsbSyncService,
    AisSourceFactoryService,
    FleetMonAdapter,
    OpenSeaMapAdapter,
    AISHubAdapter,
    SyncStatusService,
    FieldStatsService,
  ],
})
export class GisDataMangerApiModule {}
