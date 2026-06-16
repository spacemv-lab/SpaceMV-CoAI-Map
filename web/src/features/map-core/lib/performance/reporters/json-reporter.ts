/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * JSON 报告器
 *
 * 输出结构化数据，供后续处理或 CI 集成
 */

import type { BenchmarkResult } from '../benchmark/runner';

export interface JsonReport {
  summary: {
    datasetId: string;
    featureCount: number;
    iterations: number;
    timestamp: string;
    deviceInfo: string;
  };
  cesium: BenchmarkResult;
  maplibre: BenchmarkResult;
  comparison: {
    firstRenderChange: number;  // 百分比
    memoryPeakChange: number;
    fpsAverageChange: number;
    dataTransferChange: number;
  };
  rawSamples?: {
    cesium: BenchmarkResult[];
    maplibre: BenchmarkResult[];
  };
}

/**
 * JSON 报告器
 */
export function jsonReporter(
  cesiumResult: BenchmarkResult,
  maplibreResult: BenchmarkResult,
  options?: {
    includeRawSamples?: boolean;
    rawCesiumSamples?: BenchmarkResult[];
    rawMaplibreSamples?: BenchmarkResult[];
  },
): JsonReport {
  // 计算变化百分比
  const calcChange = (before: number, after: number): number => {
    if (before === 0) return 0;
    return ((after - before) / before) * 100;
  };

  const report: JsonReport = {
    summary: {
      datasetId: cesiumResult.datasetId,
      featureCount: cesiumResult.featureCount,
      iterations: cesiumResult.iterations,
      timestamp: new Date().toISOString(),
      deviceInfo: cesiumResult.deviceInfo,
    },
    cesium: cesiumResult,
    maplibre: maplibreResult,
    comparison: {
      firstRenderChange: calcChange(
        cesiumResult.firstRender,
        maplibreResult.firstRender,
      ),
      memoryPeakChange: calcChange(
        cesiumResult.memoryPeak,
        maplibreResult.memoryPeak,
      ),
      fpsAverageChange: calcChange(
        cesiumResult.fpsAverage,
        maplibreResult.fpsAverage,
      ),
      dataTransferChange: calcChange(
        cesiumResult.dataTransfer,
        maplibreResult.dataTransfer,
      ),
    },
  };

  // 可选：包含原始采样数据
  if (options?.includeRawSamples) {
    report.rawSamples = {
      cesium: options.rawCesiumSamples || [],
      maplibre: options.rawMaplibreSamples || [],
    };
  }

  return report;
}

/**
 * 输出 JSON 字符串
 */
export function jsonStringify(
  report: JsonReport,
  pretty: boolean = true,
): string {
  return JSON.stringify(report, null, pretty ? 2 : 0);
}