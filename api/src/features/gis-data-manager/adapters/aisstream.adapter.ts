/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Injectable, Logger } from '@nestjs/common';
import WebSocket from 'ws';

/**
 * AIS 消息类型
 */
enum MessageType {
  PositionReport = 'PositionReport',
  StandardClassBPositionReport = 'StandardClassBPositionReport',
  UnknownMessage = 'UnknownMessage',
}

/**
 * AISStream API 响应数据结构
 */
interface AISMessage {
  MessageType: string;
  Message: {
    PositionReport?: {
      UserID: number;        // MMSI
      Latitude: number;
      Longitude: number;
      Sog: number;           // Speed Over Ground
      Cog: number;           // Course Over Ground
      TrueHeading: number;
      PositionAccuracy: boolean;
      Raim: boolean;
      NavigationalStatus: number;
    };
    StandardClassBPositionReport?: {
      UserID: number;
      Latitude: number;
      Longitude: number;
      Sog: number;
      Cog: number;
      TrueHeading: number;
      PositionAccuracy: boolean;
      Raim: boolean;
    };
  };
  MetaData?: {
    MMSI: number;
    MMSI_String: number;
    ShipName?: string;
    latitude: number;
    longitude: number;
    time_utc: string;
  };
}

/**
 * AISStream API 配置
 */
export interface AISStreamConfig {
  apiKey: string;
  wsUrl: string;
}

/**
 * AISStream WebSocket 适配器
 *
 * 用于从 AISStream 获取全球船舶位置数据
 * API 文档：https://aisstream.io/api
 */
@Injectable()
export class AISStreamAdapter {
  private readonly logger = new Logger(AISStreamAdapter.name);
  private readonly config: AISStreamConfig;
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private messageBuffer: AISMessage[] = [];

  // 连接状态追踪
  private authSuccess: boolean = false;
  private connectionError: Error | null = null;

  constructor() {
    this.config = {
      apiKey: process.env.AISSTREAM_API_KEY || '',
      wsUrl: 'wss://stream.aisstream.io/v0/stream',
    };
  }

  /**
   * 抓取 AIS 数据（批处理模式）
   *
   * 由于 WebSocket 是长连接，我们采用批处理模式：
   * 1. 连接 WebSocket
   * 2. 接收 N 秒数据
   * 3. 返回批处理结果
   *
   * @throws 如果连接失败或认证失败，会正确抛出错误而非返回空数据
   */
  async fetchBatch(durationSeconds: number = 30): Promise<{
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
    this.messageBuffer = [];
    this.authSuccess = false;
    this.connectionError = null;

    return new Promise((resolve, reject) => {
      try {
        this.connect();

        // 监听消息
        const messageHandler = (data: Buffer) => {
          try {
            const message: AISMessage = JSON.parse(data.toString());

            // 检查是否为错误/控制消息
            if (this.isErrorMessage(message)) {
              this.connectionError = new Error(`AISStream 错误消息：${JSON.stringify(message)}`);
              this.logger.error(this.connectionError.message);
              this.disconnect();
              reject(this.connectionError);
              return;
            }

            this.messageBuffer.push(message);

            // 只有收到有效的位置消息才表示认证成功
            if (!this.authSuccess && this.hasValidPosition(message)) {
              this.authSuccess = true;
              this.logger.log('AISStream 认证成功，开始接收数据');
            }
          } catch (error) {
            this.logger.error(`解析 AIS 消息失败：${error.message}`);
          }
        };

        if (this.ws) {
          this.ws.on('message', messageHandler);

          // 连接错误处理 - reject promise
          this.ws.on('error', (error) => {
            this.connectionError = error;
            this.isConnected = false;
            this.logger.error(`AISStream WebSocket 错误：${error.message}`);
            this.disconnect();
            reject(new Error(`AISStream WebSocket 连接错误：${error.message}`));
          });

          // 连接关闭处理 - 检查是否为异常关闭
          this.ws.on('close', (code, reason) => {
            this.isConnected = false;
            const reasonStr = reason.toString() || `code=${code}`;
            this.logger.log(`AISStream WebSocket 已关闭，${reasonStr}`);

            // 如果还没认证成功就关闭了，视为连接失败
            if (!this.authSuccess && !this.connectionError) {
              this.disconnect();
              reject(new Error(`AISStream 连接在认证前关闭：${reasonStr}`));
            }
          });
        }

        // 达到指定时间后关闭连接并返回结果
        setTimeout(() => {
          this.disconnect();

          if (this.ws) {
            this.ws.removeListener('message', messageHandler);
          }

          // 检查是否有连接错误
          if (this.connectionError) {
            reject(this.connectionError);
            return;
          }

          // 检查是否认证成功
          if (!this.authSuccess) {
            reject(new Error('AISStream 连接超时：未收到认证确认'));
            return;
          }

          const features = this.messageBuffer
            .filter((msg) => this.hasValidPosition(msg))
            .map((msg) => this.messageToFeature(msg));

          this.logger.log(
            `AISStream 批处理完成: ${features.length} 条有效位置数据`
          );

          const bbox = this.calculateBbox(features);

          resolve({
            features,
            bbox,
            timestamp: new Date(),
          });
        }, durationSeconds * 1000);

      } catch (error) {
        this.disconnect();
        reject(error);
      }
    });
  }

  /**
   * 连接 WebSocket
   */
  private connect(): void {
    if (!this.config.apiKey) {
      this.logger.error('AISStream API Key 未配置');
      throw new Error('AISStream API Key 未配置');
    }

    this.logger.log(`正在连接 AISStream WebSocket: ${this.config.wsUrl}`);
    this.ws = new WebSocket(this.config.wsUrl);

    this.ws.on('open', () => {
      this.isConnected = true;
      this.logger.log('AISStream WebSocket 已连接');

      // 发送订阅消息
      // 格式：APIKey（大写K）+ BoundingBoxes（三重嵌套数组）
      const subscribeMessage = {
        APIKey: this.config.apiKey,
        BoundingBoxes: [[[-90, -180], [90, 180]]], // [[[minLat, minLon], [maxLat, maxLon]]]
      };
      this.ws?.send(JSON.stringify(subscribeMessage));
      this.logger.log('AISStream 订阅消息已发送');
    });

    // 注意：error 和 close 事件在 fetchBatch 中处理，以便正确 reject promise
  }

  /**
   * 断开 WebSocket 连接
   */
  private disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * 检查消息是否有有效位置
   * 验证坐标存在且在合法范围内
   */
  private hasValidPosition(message: AISMessage): boolean {
    let latitude: number | undefined;
    let longitude: number | undefined;

    // 使用 MetaData 中的位置信息
    if (message.MetaData?.latitude !== undefined && message.MetaData?.longitude !== undefined) {
      latitude = message.MetaData.latitude;
      longitude = message.MetaData.longitude;
    } else {
      const payload = this.extractPayload(message);
      if (!payload) return false;
      latitude = payload.Latitude;
      longitude = payload.Longitude;
    }

    // 验证坐标存在且为有限数
    if (latitude === null || latitude === undefined ||
        longitude === null || longitude === undefined) {
      return false;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return false;
    }

    // 验证坐标在合法范围内
    // 纬度: -90 到 90
    // 经度: -180 到 180
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return false;
    }

    return true;
  }

  /**
   * 检查是否为错误/控制消息
   * AISStream 可能返回错误消息，需要识别并处理
   * 注意：UnknownMessage 不一定是错误，如果包含 MetaData 位置数据则视为有效消息
   */
  private isErrorMessage(message: AISMessage): boolean {
    // UnknownMessage 如果包含 MetaData 位置数据，视为有效消息（非错误）
    if (message.MessageType === 'UnknownMessage') {
      // 检查是否有 MetaData 且包含有效坐标
      if (message.MetaData?.latitude !== undefined &&
          message.MetaData?.longitude !== undefined) {
        return false; // 有位置数据，不是错误
      }
      // 没有位置数据的 UnknownMessage 视为错误
      return true;
    }

    // 检查是否有错误字段（AISStream 可能返回的其他格式）
    const msgAny = message as any;
    if (msgAny.error || msgAny.Error || msgAny.errorMessage) {
      return true;
    }

    return false;
  }

  /**
   * 提取位置负载数据
   */
  private extractPayload(message: AISMessage): any {
    if (message.MessageType === 'PositionReport') {
      return message.Message.PositionReport;
    }
    if (message.MessageType === 'StandardClassBPositionReport') {
      return message.Message.StandardClassBPositionReport;
    }
    return null;
  }

  /**
   * 将 AIS 消息转换为 GeoJSON Feature
   */
  private messageToFeature(message: AISMessage): {
    id: string;
    properties: Record<string, any>;
    geometry: {
      type: string;
      coordinates: number[];
    };
  } {
    // 优先使用 MetaData 中的位置信息
    let latitude: number;
    let longitude: number;
    let mmsi: string;
    let sog: number = 0;
    let cog: number = 0;
    let trueHeading: number = 511;

    if (message.MetaData) {
      latitude = message.MetaData.latitude;
      longitude = message.MetaData.longitude;
      mmsi = message.MetaData.MMSI.toString();
    } else {
      const payload = this.extractPayload(message)!;
      latitude = payload.Latitude;
      longitude = payload.Longitude;
      mmsi = payload.UserID.toString();
      sog = payload.Sog || 0;
      cog = payload.Cog || 0;
      trueHeading = payload.TrueHeading || 511;
    }

    // 从 Message 中获取更多信息（如果有）
    const payload = this.extractPayload(message);
    if (payload) {
      sog = payload.Sog || sog;
      cog = payload.Cog || cog;
      trueHeading = payload.TrueHeading || trueHeading;
    }

    return {
      id: mmsi,
      properties: {
        mmsi,
        sog,
        cog,
        heading: trueHeading === 511 ? null : trueHeading, // 511 表示不可用
        shipName: message.MetaData?.ShipName || null,
        timestamp: message.MetaData?.time_utc || new Date().toISOString(),
      },
      geometry: {
        type: 'Point',
        coordinates: [longitude, latitude, 0],
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
