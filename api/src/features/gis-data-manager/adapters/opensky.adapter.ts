/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Injectable, Logger } from '@nestjs/common';
import httpx from 'httpx';
import * as http from 'http';
import * as https from 'https';

/**
 * OpenSky API 响应数据结构
 * API 格式：[0]icao24, [1]callsign, [2]country, [3]time_position, [4]last_contact,
 *           [5]longitude, [6]latitude, [7]baro_altitude, [8]on_ground,
 *           [9]velocity, [10]true_track, [11]vertical_rate, [12]sensors,
 *           [13]geo_altitude, [14]squawk, [15]spi, [16]position_source
 */
interface OpenSkyStateVector {
  0: string;  // ICAO24 address
  1: string;  // Callsign
  2: string;  // Country name
  3: number | null;  // time_position
  4: number | null;  // last_contact
  5: number | null;  // longitude
  6: number | null;  // latitude
  7: number | null;  // barometric altitude (meters)
  8: boolean;        // on ground
  9: number | null;  // velocity (m/s)
  10: number | null; // true track (degrees)
  11: number | null; // vertical rate (m/s)
  12: any[] | null;  // Sensors
  13: number | null; // Barometric pressure (hPa)
  14: any | null;    // Special position indicator
  15: any | null;    // Source
  16: number | null; // Geo altitude (meters)
}

interface OpenSkyResponse {
  states: OpenSkyStateVector[];
  time: number;
}

// 类型别名，用于 stateToFeature 方法
type OpenSkyVector = OpenSkyStateVector;

/**
 * OpenSky API 配置
 */
export interface OpenSkyConfig {
  username?: string;
  password?: string;
  baseUrl: string;
}

/**
 * OpenSky API 适配器
 *
 * 用于从 OpenSky Network 获取全球航空器位置数据
 * API 文档：https://opensky-network.org/apidoc/rest.html
 */
@Injectable()
export class OpenSkyAdapter {
  private readonly logger = new Logger(OpenSkyAdapter.name);
  private readonly config: OpenSkyConfig;

  constructor() {
    this.config = {
      baseUrl: 'https://opensky-network.org/api',
      username: process.env.OPENSKY_USERNAME,
      password: process.env.OPENSKY_PASSWORD,
    };
  }

  /**
   * 获取所有航空器状态
   */
  async getAllStates(): Promise<{
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
    const url = `${this.config.baseUrl}/states/all`;

    try {
      const response = await this.makeRequest(url);
      const data: OpenSkyResponse = response;

      // OpenSky API 格式: [0]icao24, [1]callsign, [2]country, [3]time_position, [4]last_contact,
    //                    [5]longitude, [6]latitude, [7]baro_altitude, [8]on_ground,
    //                    [9]velocity, [10]true_track, [11]vertical_rate, [12]sensors,
    //                    [13]geo_altitude, [14]squawk, [15]spi, [16]position_source
    const features = data.states
      .filter((state) => {
        const lon = state[5];
        const lat = state[6];
        // 验证坐标存在、为有限数且在合法范围内
        return lon !== null && lat !== null &&
               Number.isFinite(lon) && Number.isFinite(lat) &&
               lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
      })
      .map((state) => this.stateToFeature(state));

      // 计算边界框
      const bbox = this.calculateBbox(features);

      return {
        features,
        bbox,
        timestamp: new Date(data.time * 1000),
      };
    } catch (error) {
      this.logger.error(`OpenSky API 请求失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 发送 HTTP 请求到 OpenSky API
   */
  private async makeRequest(url: string): Promise<any> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    // 如果有认证信息，添加 Basic Auth
    if (this.config.username && this.config.password) {
      const credentials = Buffer.from(
        `${this.config.username}:${this.config.password}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    // Use Node.js native Agent with timeout
    const isHttps = url.startsWith('https://');
    const agent = new (isHttps ? https.Agent : http.Agent)({
      timeout: 60000, // 60 秒超时（全球数据量大）
      keepAlive: true,
    });

    const response = await httpx.request(url, {
      method: 'GET',
      headers,
      agent,
      timeout: 60000, // 60 秒超时
    });

    if (response.statusCode !== 200) {
      throw new Error(`OpenSky API 返回错误状态码：${response.statusCode}`);
    }

    // Use httpx.read() to consume response body
    const body = await httpx.read(response);
    return JSON.parse(body.toString());
  }

  /**
   * 将 OpenSky StateVector 转换为 GeoJSON Feature
   */
  private stateToFeature(state: OpenSkyVector): {
    id: string;
    properties: Record<string, any>;
    geometry: {
      type: string;
      coordinates: number[];
    };
  } {
    const icao24 = state[0];
    const callsign = state[1]?.trim() || 'N/A';
    const country = state[2];
    // OpenSky API 格式: [0]icao24, [1]callsign, [2]country, [3]time_position, [4]last_contact,
    //                    [5]longitude, [6]latitude, [7]baro_altitude, [8]on_ground,
    //                    [9]velocity, [10]true_track, [11]vertical_rate, [12]sensors,
    //                    [13]geo_altitude, [14]squawk, [15]spi, [16]position_source
    const longitude = state[5];
    const latitude = state[6];
    const baroAltitude = state[7];
    const onGround = state[8];
    const velocity = state[9];
    const track = state[10];
    const verticalRate = state[11];
    const geoAltitude = state[13];

    // 优先使用 geo_altitude，其次 baro_altitude
    const altitude = geoAltitude !== null ? geoAltitude : baroAltitude;

    return {
      id: icao24,
      properties: {
        icao24,
        callsign,
        country,
        altitude,
        velocity,
        track,
        verticalRate,
        onGround,
        timestamp: new Date().toISOString(),
      },
      geometry: {
        type: 'Point',
        coordinates: [longitude, latitude, altitude || 0],
      },
    };
  }

  /**
   * 计算边界框
   */
  private calculateBbox(
    features: Array<{ geometry: { coordinates: number[] } }>
  ): [number, number, number, number] | undefined {
    if (features.length === 0) {
      return undefined;
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const feature of features) {
      const [lon, lat] = feature.geometry.coordinates;
      minX = Math.min(minX, lon);
      minY = Math.min(minY, lat);
      maxX = Math.max(maxX, lon);
      maxY = Math.max(maxY, lat);
    }

    return [minX, minY, maxX, maxY];
  }
}
