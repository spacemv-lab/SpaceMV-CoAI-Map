/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseDataSourcesConfig } from '../utils/ais-data-source-config.util';

/**
 * 外部数据同步配置验证服务
 *
 * 在应用启动时检查必填的环境变量配置
 */
@Injectable()
export class ExternalDataConfigService implements OnModuleInit {
  private readonly logger = new Logger(ExternalDataConfigService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.validateExternalDataConfig();
  }

  /**
   * 验证外部数据同步相关配置
   */
  private validateExternalDataConfig(): void {
    const openskyUsername = this.configService.get<string>('OPENSKY_USERNAME');
    const openskyPassword = this.configService.get<string>('OPENSKY_PASSWORD');
    const aisstreamApiKey = this.configService.get<string>('AISSTREAM_API_KEY');

    let hasWarning = false;

    // OpenSky 配置检查
    if (!openskyUsername || !openskyPassword) {
      this.logger.warn(
        'OpenSky Network 配置缺失：OPENSKY_USERNAME 或 OPENSKY_PASSWORD 未设置',
      );
      this.logger.warn(
        'ADS-B 数据同步将受限（匿名访问有速率限制）',
      );
      hasWarning = true;
    } else {
      this.logger.log('OpenSky Network 配置已设置');
    }

    // AISStream 配置检查
    if (!aisstreamApiKey) {
      this.logger.warn(
        'AISStream API Key 未设置：AISSTREAM_API_KEY',
      );
      this.logger.warn(
        'AIS 数据同步将无法工作',
      );
      hasWarning = true;
    } else {
      this.logger.log('AISStream API Key 已设置');
    }

    // AIS_DATA_SOURCES 配置检查（fail-fast）
    try {
      const aisConfigs = parseDataSourcesConfig('AIS_DATA_SOURCES', true);
      if (aisConfigs.length === 0) {
        throw new Error('AIS_DATA_SOURCES 配置为空数组，至少需要配置一个 AIS 数据源');
      }
      this.logger.log(`AIS_DATA_SOURCES 配置已设置，共 ${aisConfigs.length} 个数据源`);
      for (const config of aisConfigs) {
        this.logger.log(`  - ${config.name}: ${config.type} (${config.enabled ? 'enabled' : 'disabled'})`);
      }
    } catch (error) {
      this.logger.error(`AIS_DATA_SOURCES 配置验证失败：${error.message}`);
      throw error;
    }

    if (hasWarning) {
      this.logger.warn(
        '外部数据同步配置不完整，请检查 .env 文件中的配置',
      );
      this.logger.warn(
        '配置示例请参考：.envs/map-ai/dev/api.env.example',
      );
    } else {
      this.logger.log('外部数据同步配置验证通过');
    }
  }

  /**
   * 检查 OpenSky 配置是否可用
   */
  isOpenSkyConfigured(): boolean {
    const username = this.configService.get<string>('OPENSKY_USERNAME');
    const password = this.configService.get<string>('OPENSKY_PASSWORD');
    return !!(username && password);
  }

  /**
   * 检查 AISStream 配置是否可用
   */
  isAisStreamConfigured(): boolean {
    const apiKey = this.configService.get<string>('AISSTREAM_API_KEY');
    return !!apiKey;
  }
}
