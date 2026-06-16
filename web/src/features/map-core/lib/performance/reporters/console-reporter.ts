/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * Console 报告器
 *
 * 实时输出开发调试信息
 */

import type { BenchmarkResult } from '../benchmark/runner';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatMs(ms: number): string {
  return `${ms.toFixed(0)} ms`;
}

function formatFps(fps: number): string {
  return `${fps.toFixed(1)} fps`;
}

/**
 * Console 报告器
 */
export const consoleReporter = {
  /**
   * 输出测试开始信息
   */
  start(renderer: string, datasetId: string): void {
    console.log(`\n[Benchmark] ========== ${renderer.toUpperCase()} 测试开始 ==========`);
    console.log(`[Benchmark] 数据集: ${datasetId}`);
  },

  /**
   * 输出阶段信息
   */
  phase(phase: string): void {
    console.log(`[Benchmark] 阶段: ${phase}`);
  },

  /**
   * 输出单次测试完成
   */
  iteration(iteration: number, total: number): void {
    console.log(`[Benchmark] 完成 ${iteration}/${total} 次测试`);
  },

  /**
   * 输出图层加载完成
   */
  layerLoaded(duration: number): void {
    console.log(`[Benchmark] 图层加载完成: ${formatMs(duration)}`);
  },

  /**
   * 输出 FPS 采集开始
   */
  fpsStart(): void {
    console.log(`[Benchmark] 开始采集 FPS...`);
  },

  /**
   * 输出 FPS 采集完成
   */
  fpsEnd(stats: { avg: number; min: number; max: number; p95: number }): void {
    console.log(
      `[Benchmark] FPS 统计: avg=${formatFps(stats.avg)}, min=${formatFps(stats.min)}, max=${formatFps(stats.max)}, p95=${formatFps(stats.p95)}`,
    );
  },

  /**
   * 输出内存统计
   */
  memory(stats: { peak: number; avg: number; supported: boolean }): void {
    if (!stats.supported) {
      console.log(`[Benchmark] 内存: Chrome API 不支持`);
    } else {
      console.log(
        `[Benchmark] 内存: peak=${formatBytes(stats.peak)}, avg=${formatBytes(stats.avg)}`,
      );
    }
  },

  /**
   * 输出网络统计
   */
  network(transferSize: number, duration: number): void {
    console.log(
      `[Benchmark] 网络: transfer=${formatBytes(transferSize)}, duration=${formatMs(duration)}`,
    );
  },

  /**
   * 输出测试结束
   */
  end(renderer: string): void {
    console.log(`[Benchmark] ========== ${renderer.toUpperCase()} 测试结束 ==========`);
  },

  /**
   * 输出对比结果摘要
   */
  comparison(cesium: BenchmarkResult, maplibre: BenchmarkResult): void {
    console.log(`\n[Benchmark] ========== 对比结果 ==========`);
    console.log(`[Benchmark] 首帧渲染: Cesium=${formatMs(cesium.firstRender)}, MapLibre=${formatMs(maplibre.firstRender)}`);
    console.log(`[Benchmark] 内存峰值: Cesium=${formatBytes(cesium.memoryPeak)}, MapLibre=${formatBytes(maplibre.memoryPeak)}`);
    console.log(`[Benchmark] 平均帧率: Cesium=${formatFps(cesium.fpsAverage)}, MapLibre=${formatFps(maplibre.fpsAverage)}`);
    console.log(`[Benchmark] ==================================\n`);
  },
};