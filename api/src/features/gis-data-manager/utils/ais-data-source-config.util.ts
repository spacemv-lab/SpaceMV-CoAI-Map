/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Logger } from '@nestjs/common';

/**
 * AIS 数据源配置项
 */
export interface AisDataSourceConfig {
  /** 统一 sourceName，满足 `^[A-Z][A-Za-z0-9]*$`，全局唯一 */
  name: string;
  /** 是否启用该数据源 */
  enabled: boolean;
  /** 传输协议类型 */
  type: 'websocket' | 'http';
  /** 绝对地址 */
  url: string;
  /** BullMQ repeatable job 的 cron pattern */
  schedule: string;
  /** 供应商需要鉴权时提供 */
  apiKey?: string;
  /** 订阅区域 [[south, west], [north, east]]，WGS84 */
  bbox?: [[number, number], [number, number]];
  /** 仅 `http` 数据源使用 */
  headers?: Record<string, string>;
}

/**
 * 派生命名结果
 */
export interface DerivedNaming {
  sourceName: string;
  sourceKey: string;
  datasetName: string;
  externalId: string;
  tag: string;
  jobId: string;
}

/**
 * 从环境变量解析 AIS 数据源配置
 *
 * @param envVarName 环境变量名称，默认为 `AIS_DATA_SOURCES`
 * @param failFast 如果配置为空是否抛出异常（应用启动时应设置为 true）
 * @returns 解析后的配置数组
 * @throws 当配置无效或为空时抛出错误
 */
export function parseDataSourcesConfig(
  envVarName: string = 'AIS_DATA_SOURCES',
  failFast: boolean = false,
): AisDataSourceConfig[] {
  const logger = new Logger(parseDataSourcesConfig.name);
  const envValue = process.env[envVarName];

  if (!envValue) {
    const msg = `环境变量 ${envVarName} 未配置`;
    if (failFast) {
      throw new Error(`${msg}，应用无法启动`);
    }
    logger.warn(`${msg}，返回空配置数组`);
    return [];
  }

  let parsed: unknown;
  try {
    const normalizedValue = envValue.trim();
    const jsonValue =
      (normalizedValue.startsWith("'") && normalizedValue.endsWith("'")) ||
      (normalizedValue.startsWith('"') && normalizedValue.endsWith('"'))
        ? normalizedValue.slice(1, -1)
        : normalizedValue;
    parsed = JSON.parse(jsonValue);
  } catch (error) {
    throw new Error(
      `${envVarName} 不是有效的 JSON 格式：${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${envVarName} 必须是一个 JSON 数组`);
  }

  return parsed.map((item, index) => {
    validateDataSourceConfig(item, index, envVarName);
    return item as AisDataSourceConfig;
  });
}

/**
 * 验证单个数据源配置项
 *
 * @param config 待验证的配置项
 * @param index 配置项在数组中的索引（用于错误提示）
 * @param envVarName 环境变量名称（用于错误提示）
 * @throws 当配置无效时抛出错误
 */
export function validateDataSourceConfig(
  config: unknown,
  index: number,
  envVarName: string = 'AIS_DATA_SOURCES',
): asserts config is AisDataSourceConfig {
  if (!config || typeof config !== 'object') {
    throw new Error(`${envVarName}[${index}] 必须是一个对象`);
  }

  const item = config as Record<string, unknown>;

  // 检查必填字段
  const requiredFields = ['name', 'enabled', 'type', 'url', 'schedule'];
  for (const field of requiredFields) {
    if (!(field in item)) {
      throw new Error(`${envVarName}[${index}] 缺少必填字段：${field}`);
    }
  }

  // 验证 name 格式：必须是 UpperCamelCase 且仅允许字母数字
  const name = item.name as string;
  const namePattern = /^[A-Z][A-Za-z0-9]*$/;
  if (!namePattern.test(name)) {
    throw new Error(
      `${envVarName}[${index}].name "${name}" 不满足命名规则：必须是 UpperCamelCase 且仅允许字母数字（^[A-Z][A-Za-z0-9]*$）`,
    );
  }

  // 验证 enabled 类型
  if (typeof item.enabled !== 'boolean') {
    throw new Error(`${envVarName}[${index}].enabled 必须是 boolean 类型`);
  }

  // 验证 type 类型
  const type = item.type as string;
  if (!['websocket', 'http'].includes(type)) {
    throw new Error(`${envVarName}[${index}].type 必须是 "websocket" 或 "http"`);
  }

  // 验证 url 类型
  if (typeof item.url !== 'string' || !item.url.startsWith('http') && !item.url.startsWith('ws')) {
    throw new Error(`${envVarName}[${index}].url 必须是一个有效的 URL`);
  }

  // 验证 schedule 类型（简单的 cron 表达式检查）
  if (typeof item.schedule !== 'string') {
    throw new Error(`${envVarName}[${index}].schedule 必须是 string 类型`);
  }

  // 可选字段验证
  if ('apiKey' in item && typeof item.apiKey !== 'string') {
    throw new Error(`${envVarName}[${index}].apiKey 必须是 string 类型`);
  }

  if ('bbox' in item) {
    const bbox = item.bbox;
    if (!Array.isArray(bbox) || bbox.length !== 2 || !Array.isArray(bbox[0]) || !Array.isArray(bbox[1])) {
      throw new Error(`${envVarName}[${index}].bbox 必须是 [[number, number], [number, number]] 格式`);
    }
  }

  if ('headers' in item && (typeof item.headers !== 'object' || item.headers === null)) {
    throw new Error(`${envVarName}[${index}].headers 必须是一个对象`);
  }
}

/**
 * 验证配置中 name 的唯一性
 *
 * @param configs 配置数组
 * @throws 当存在重复 name 时抛出错误
 */
export function validateUniqueNames(configs: AisDataSourceConfig[]): void {
  const names = new Set<string>();
  for (const config of configs) {
    if (names.has(config.name)) {
      throw new Error(`数据源名称 "${config.name}" 重复，每个数据源的 name 必须全局唯一`);
    }
    names.add(config.name);
  }
}

/**
 * 根据 name 派生统一命名
 *
 * @param name 数据源名称（如 `AISStream`）
 * @returns 派生命名结果
 */
export function deriveNaming(name: string): DerivedNaming {
  const sourceKey = name.toLowerCase();
  return {
    sourceName: name,
    sourceKey,
    datasetName: `Global AIS - ${name}`,
    externalId: `global-ais-${sourceKey}`,
    tag: `source:${sourceKey}`,
    jobId: `ais-sync-${sourceKey}`,
  };
}

/**
 * 解析并验证完整配置（包含唯一性检查和派生命名）
 *
 * @param envVarName 环境变量名称
 * @returns 包含配置和派生命名的结果
 */
export function parseAndValidateConfig(
  envVarName: string = 'AIS_DATA_SOURCES',
): { configs: AisDataSourceConfig[]; namings: Record<string, DerivedNaming> } {
  const configs = parseDataSourcesConfig(envVarName);
  validateUniqueNames(configs);

  const namings: Record<string, DerivedNaming> = {};
  for (const config of configs) {
    namings[config.name] = deriveNaming(config.name);
  }

  return { configs, namings };
}
