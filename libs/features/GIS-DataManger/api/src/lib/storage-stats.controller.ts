/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Controller, Get } from '@nestjs/common';
import { StorageStatsService } from '../services/storage-stats.service';

@Controller('stats')
export class StorageStatsController {
  constructor(private readonly storageStatsService: StorageStatsService) {}

  @Get('storage')
  async getStorageStats() {
    return this.storageStatsService.getStorageStats();
  }
}
