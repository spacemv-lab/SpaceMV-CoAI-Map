/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from '@map-ai/features/ai-chat/server';
import { GisDataMangerApiModule } from '@txwx-monorepo/gis-data-manger-api';

@Module({
  imports: [ChatModule, GisDataMangerApiModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
