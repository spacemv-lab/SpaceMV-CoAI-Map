/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Injectable, Logger } from '@nestjs/common';
import httpx from 'httpx';
import * as http from 'http';
import * as https from 'https';

/**
 * OpenSeaMap API 响应数据结构
 * API 文档：http://openseamap.org/
 * OpenSeaMap 提供免费的 AIS 数据下载
 */
interface OpenSeaMapVessel {
  mmsi: string;
  shipname: string;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  heading: number;
  timestamp: string;
  vessel_type?: string;
  length?: number;
  width?: number;
}

interface OpenSeaMapResponse {
  vessels: OpenSeaMapVessel[];
  timestamp: string;
}

/**
 * OpenSeaMap 配置
 */
export interface OpenSeaMapConfig {
  baseUrl: string;
}

/**
 * OpenSeaMap API 适配器
 *
 * 用于从 OpenSeaMap 获取全球船舶位置数据
 * OpenSeaMap 是开源的海图项目，提供免费的 AIS 数据
 */
@Injectable()
export class OpenSeaMapAdapter {
  private readonly logger = new Logger(OpenSeaMapAdapter.name);
  private readonly config: OpenSeaMapConfig;

  constructor() {
    this.config = {
      baseUrl: 'https://api.openseamap.org/ais',
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
    const url = `${this.config.baseUrl}/vessels`;

    try {
      const response = await this.makeRequest(url);
      const data: OpenSeaMapResponse = response;

      const features = data.vessels
        .filter((vessel) => {
          const lon = vessel.longitude;
          const lat = vessel.latitude;
          // 验证坐标存在、为有限数且在合法范围内
          return lon !== null && lat !== null &&
                 Number.isFinite(lon) && Number.isFinite(lat) &&
                 lon >= -180 && lon <= 180 &&
                 lat >= -90 && lat <= 90;
        })
        .map((vessel) => ({
          id: `mmsi-${vessel.mmsi}`,
          properties: {
            mmsi: vessel.mmsi,
            name: vessel.shipname,
            speed: vessel.speed,
            course: vessel.course,
            heading: vessel.heading,
            timestamp: vessel.timestamp,
            vessel_type: vessel.vessel_type,
            length: vessel.length,
            width: vessel.width,
            source: 'OpenSeaMap',
          },
          geometry: {
            type: 'Point',
            coordinates: [vessel.longitude, vessel.latitude],
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
        timestamp: new Date(data.timestamp || Date.now()),
      };
    } catch (error) {
      this.logger.error(`OpenSeaMap API 请求失败：${error.message}`);
      throw error;
    }
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
