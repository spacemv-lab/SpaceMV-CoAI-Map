/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Injectable, Logger } from '@nestjs/common';
import httpx from 'httpx';
import * as http from 'http';
import * as https from 'https';

/**
 * AISHub API 响应数据结构
 * API 文档：http://www.aishub.net/
 * AISHub 提供免费的 AIS 数据聚合服务
 */
interface AISHubVessel {
  MMSI: string;
  Shipname: string;
  Latitude: number;
  Longitude: number;
  Speed: number;
  Course: number;
  Heading: number;
  Timestamp: string;
  Type?: number;
  Length?: number;
  Width?: number;
  Draught?: number;
}

interface AISHubResponse {
  ships: AISHubVessel[];
  timestamp: number;
}

/**
 * AISHub 配置
 */
export interface AISHubConfig {
  apiKey?: string;
  baseUrl: string;
}

/**
 * AISHub API 适配器
 *
 * 用于从 AISHub 获取全球船舶位置数据
 * AISHub 是免费的 AIS 数据聚合服务，需要申请 API Key
 */
@Injectable()
export class AISHubAdapter {
  private readonly logger = new Logger(AISHubAdapter.name);
  private readonly config: AISHubConfig;

  constructor() {
    this.config = {
      baseUrl: 'http://api.aishub.net/ws.php',
      apiKey: process.env.AISHUB_API_KEY,
    };
  }

  /**
   * 获取所有船舶位置数据
   */
  async fetchAll(): Promise<{
    features: Array<{
      id: string;
      properties: Record<string, any>;
      geometry: {
        type: string;
        coordinates: number[];
      };
    }>;
    bbox?: [number, number, number, number];
    timestamp: Date;
  }> {
    if (!this.config.apiKey) {
      throw new Error('AISHub API Key 未配置');
    }

    const url = `${this.config.baseUrl}?format=json&key=${this.config.apiKey}`;

    try {
      const response = await this.makeRequest(url);
      const data: AISHubResponse = response;

      const features = data.ships
        .filter((vessel) => {
          const lon = vessel.Longitude;
          const lat = vessel.Latitude;
          return lon !== null && lat !== null &&
                 Number.isFinite(lon) && Number.isFinite(lat) &&
                 lon >= -180 && lon <= 180 &&
                 lat >= -90 && lat <= 90;
        })
        .map((vessel) => ({
          id: `mmsi-${vessel.MMSI}`,
          properties: {
            mmsi: vessel.MMSI,
            name: vessel.Shipname,
            speed: vessel.Speed,
            course: vessel.Course,
            heading: vessel.Heading,
            timestamp: this.parseTimestamp(vessel.Timestamp),
            vessel_type: vessel.Type,
            length: vessel.Length,
            width: vessel.Width,
            draught: vessel.Draught,
            source: 'AISHub',
          },
          geometry: {
            type: 'Point',
            coordinates: [vessel.Longitude, vessel.Latitude],
          },
        }));

      // 计算边界框
      let bbox: [number, number, number, number] | undefined;
      if (features.length > 0) {
        const coords = features.map((f) => f.geometry.coordinates);
        bbox = [
          Math.min(...coords.map((c) => c[0])),
          Math.min(...coords.map((c) => c[1])),
          Math.max(...coords.map((c) => c[0])),
          Math.max(...coords.map((c) => c[1])),
        ];
      }

      return {
        features,
        bbox,
        timestamp: new Date(data.timestamp * 1000),
      };
    } catch (error) {
      this.logger.error(`AISHub API 请求失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 解析时间戳（支持字符串或数字）
   */
  private parseTimestamp(timestamp: string): string {
    // AISHub 返回的时间戳可能是 Unix 时间戳（秒）或 ISO 字符串
    const numeric = Number(timestamp);
    if (!Number.isNaN(numeric)) {
      // Unix 时间戳（秒）转换为毫秒
      return new Date(numeric * 1000).toISOString();
    }
    // 尝试直接解析为 ISO 字符串
    return new Date(timestamp).toISOString();
  }

  /**
   * HTTP GET 请求
   */
  private async makeRequest(url: string): Promise<any> {
    const agent = url.startsWith('https') ? https.globalAgent : http.globalAgent;

    const response = await new Promise<any>((resolve, reject) => {
      const req = httpx.get(url, {
        agent,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SpaceMV-CoAI-Map/1.0',
        },
        timeout: 10000,
      }, (res: http.IncomingMessage) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`响应不是有效的 JSON: ${e.message}`));
            }
          } else {
            reject(new Error(`HTTP 错误：${res.statusCode} - ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时（10 秒）'));
      });
    });

    return response;
  }
}
