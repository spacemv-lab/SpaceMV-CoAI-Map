/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3000;

  // 启动时打印数据库和 Redis 连接信息
  const databaseUrl = process.env.DATABASE_URL || 'not set';
  const redisHost = process.env.REDIS_HOST || '127.0.0.1';
  const redisPort = process.env.REDIS_PORT || '6379';

  // 从 DATABASE_URL 提取数据库信息
  // 格式：postgresql://user:password@host:port/database?options
  const urlPattern = /postgresql:\/\/[^@]+@([^:/]+):(\d+)\/([^?]+)/;
  const dbMatch = databaseUrl.match(urlPattern);
  const dbHost = dbMatch ? dbMatch[1] : 'unknown';
  const dbPort = dbMatch ? dbMatch[2] : '5432';
  const dbName = dbMatch ? dbMatch[3] : 'unknown';

  Logger.log(`Database: PostgreSQL at ${dbHost}:${dbPort}/${dbName}`);
  Logger.log(`Redis: ${redisHost}:${redisPort}`);
  Logger.log(`Environment: ${process.env.NODE_ENV || 'development'} (${process.env.DEPLOY_ENV || 'local'})`);

  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
