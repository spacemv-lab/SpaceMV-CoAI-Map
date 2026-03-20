/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { RedisOptions } from 'ioredis';

export function buildRedisOptions(
  connectionName: string,
  extra: Partial<RedisOptions> = {},
): RedisOptions {
  // 从环境变量读取 Redis 配置，本地开发可使用默认值
  const redisHost = process.env['REDIS_HOST'] || '127.0.0.1';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  const redisUsername = process.env.REDIS_USERNAME || undefined;
  const redisPassword = process.env['REDIS_PASSWORD'] || undefined;

  return {
    host: redisHost,
    port: redisPort,
    username: redisUsername || undefined,
    password: redisPassword || undefined,
    connectionName,
    // Some Redis deployments reject the INFO-based ready check during startup.
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    ...extra,
  };
}
