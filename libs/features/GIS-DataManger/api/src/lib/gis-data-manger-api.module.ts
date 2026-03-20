/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Module, Global } from '@nestjs/common';
import { DatasetController } from './dataset.controller';
import { StorageStatsController } from './storage-stats.controller';
import { DatasetService } from './dataset.service';
import { GisParseService } from '../services/gis-parse.service';
import { ValidationService } from '../services/validation.service';
import { MappingProfileService } from '../services/mapping-profile.service';
import { StorageStatsService } from '../services/storage-stats.service';
import { MinioService } from '../services/minio.service';
import { GisQueue } from '../queues/gis.queue';
import { GisProcessor } from '../queues/gis.processor';
import { IndexProcessor } from '../queues/index.processor';
import { GeometryValidator } from '../validators/geometry.validator';
import { CrsValidator } from '../validators/crs.validator';
import { GeoJsonAdapter } from '../adapters/geojson.adapter';
import { ShapefileAdapter } from '../adapters/shapefile.adapter';
import { KmlAdapter } from '../adapters/kml.adapter';
import { TableAdapter } from '../adapters/table.adapter';
import { GdalService } from '../utils/gdal.service';

@Global()
@Module({
  controllers: [
    DatasetController,
    StorageStatsController,
  ],
  providers: [
    // Core Services
    GdalService,
    DatasetService,
    GisParseService,
    ValidationService,
    MappingProfileService,
    StorageStatsService,
    MinioService,

    // Queues and Processors
    GisQueue,
    GisProcessor,
    IndexProcessor,

    // Validators
    GeometryValidator,
    CrsValidator,

    // Adapters
    GeoJsonAdapter,
    ShapefileAdapter,
    KmlAdapter,
    TableAdapter,
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
  ],
})
export class GisDataMangerApiModule {}
