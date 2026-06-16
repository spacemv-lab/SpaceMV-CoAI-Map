/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 测试编排器
 *
 * 负责：
 * - 预热（消除 JIT 影响）
 * - 多次采样（统计显著性）
 * - 结果聚合（均值/P95）
 */

import { PerformanceCollector } from '../collectors/performance-api';
import { FPSCollector } from '../collectors/fps-collector';
import { MemoryCollector } from '../collectors/memory-collector';
import { consoleReporter } from '../reporters/console-reporter';

export interface BenchmarkConfig {
  datasetId: string;        // 测试数据集 ID
  iterations: number;       // 重复次数
  warmupRuns: number;       // 预热次数
  fpsDurationMs?: number;   // FPS 采集时长（默认 5000ms）
}

export interface BenchmarkResult {
  // 元数据
  datasetId: string;
  featureCount: number;
  renderer: 'cesium' | 'maplibre';
  deviceInfo: string;
  iterations: number;

  // 网络指标
  dataTransfer: number;     // bytes

  // 时间指标
  fetchDuration: number;    // ms
  parseDuration: number;    // ms
  firstRender: number;      // ms
  totalDuration: number;    // ms

  // 运行时指标
  memoryPeak: number;       // bytes
  fpsAverage: number;       // fps
  fpsP95: number;           // fps
  fpsMin: number;           // fps
}

/**
 * 测试运行器
 */
export class BenchmarkRunner {
  private perfCollector = new PerformanceCollector();
  private fpsCollector = new FPSCollector();
  private memoryCollector = new MemoryCollector();

  /**
   * 运行测试
   */
  async run(
    config: BenchmarkConfig,
    renderer: 'cesium' | 'maplibre',
  ): Promise<BenchmarkResult> {
    consoleReporter.start(renderer, config.datasetId);

    const results: BenchmarkResult[] = [];

    // 预热阶段
    consoleReporter.phase('预热');
    for (let i = 0; i < config.warmupRuns; i++) {
      await this.runSingle(config, renderer);
      await this.clearLayer(renderer);
    }

    // 正式测试
    consoleReporter.phase('正式测试');
    for (let i = 0; i < config.iterations; i++) {
      const result = await this.runSingle(config, renderer);
      results.push(result);
      consoleReporter.iteration(i + 1, config.iterations);
      await this.clearLayer(renderer);
    }

    consoleReporter.end(renderer);

    // 聚合结果
    return this.aggregateResults(results);
  }

  /**
   * 单次测试
   */
  private async runSingle(
    config: BenchmarkConfig,
    renderer: 'cesium' | 'maplibre',
  ): Promise<BenchmarkResult> {
    // 清理上次数据
    this.perfCollector.clear();
    this.fpsCollector.clear();

    // 开始内存采样
    this.memoryCollector.start(500);

    // 打点：开始
    this.perfCollector.mark('test-start');
    consoleReporter.phase('图层加载');

    // 加载图层（通过渲染器 API）
    const featureCount = await this.loadLayer(config.datasetId, renderer);

    // 打点：首帧渲染完成
    this.perfCollector.mark('first-render');

    const firstRender = this.perfCollector.measure(
      'first-render',
      'test-start',
      'first-render',
    );
    consoleReporter.layerLoaded(firstRender);

    // 采集 FPS（模拟用户交互）
    consoleReporter.fpsStart();
    await this.collectFPS(config.fpsDurationMs || 5000);
    const fpsStats = this.fpsCollector.stop();
    consoleReporter.fpsEnd(fpsStats);

    // 停止内存采样
    const memoryStats = this.memoryCollector.stop();
    consoleReporter.memory(memoryStats);

    // 获取网络统计
    const networkStats = this.perfCollector.getResourceTiming(
      `/api/datasets/${config.datasetId}`,
    );
    if (networkStats) {
      consoleReporter.network(networkStats.transferSize, networkStats.duration);
    }

    // 对于 MapLibre MVT，计算总传输量（多个瓦片）
    const totalTransfer =
      renderer === 'maplibre'
        ? this.perfCollector.getTotalTransferSize(`/api/datasets/${config.datasetId}/mvt`)
        : networkStats?.transferSize || 0;

    return {
      datasetId: config.datasetId,
      featureCount,
      renderer,
      deviceInfo: navigator.userAgent,
      iterations: config.iterations,

      dataTransfer: totalTransfer,
      fetchDuration: networkStats?.duration || 0,
      parseDuration: 0, // 需要从埋点计算
      firstRender,
      totalDuration: firstRender,

      memoryPeak: memoryStats.peak,
      fpsAverage: fpsStats.avg,
      fpsP95: fpsStats.p95,
      fpsMin: fpsStats.min,
    };
  }

  /**
   * 聚合多次测试结果
   */
  private aggregateResults(results: BenchmarkResult[]): BenchmarkResult {
    if (results.length === 0) {
      throw new Error('No results to aggregate');
    }

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const p95 = (arr: number[]) => {
      const sorted = [...arr].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length * 0.95)];
    };

    return {
      datasetId: results[0].datasetId,
      featureCount: results[0].featureCount,
      renderer: results[0].renderer,
      deviceInfo: results[0].deviceInfo,
      iterations: results.length,

      // 时间指标取均值
      dataTransfer: avg(results.map((r) => r.dataTransfer)),
      fetchDuration: avg(results.map((r) => r.fetchDuration)),
      parseDuration: avg(results.map((r) => r.parseDuration)),
      firstRender: avg(results.map((r) => r.firstRender)),
      totalDuration: avg(results.map((r) => r.totalDuration)),

      // 内存取峰值
      memoryPeak: Math.max(...results.map((r) => r.memoryPeak)),

      // FPS 取均值
      fpsAverage: avg(results.map((r) => r.fpsAverage)),
      fpsP95: p95(results.map((r) => r.fpsP95)),
      fpsMin: Math.min(...results.map((r) => r.fpsMin)),
    };
  }

  /**
   * 加载图层 - 需要由外部注入实现
   */
  private async loadLayer(
    datasetId: string,
    renderer: 'cesium' | 'maplibre',
  ): Promise<number> {
    // 这个方法需要由测试页面注入实现
    // 通过 window.BENCHMARK_LOAD_LAYER 回调

    const loadFn = (window as unknown as {
      BENCHMARK_LOAD_LAYER?: (
        datasetId: string,
        renderer: string,
      ) => Promise<number>;
    }).BENCHMARK_LOAD_LAYER;

    if (!loadFn) {
      console.warn('[BenchmarkRunner] BENCHMARK_LOAD_LAYER not defined');
      return 0;
    }

    return loadFn(datasetId, renderer);
  }

  /**
   * 清理图层 - 需要由外部注入实现
   */
  private async clearLayer(renderer: 'cesium' | 'maplibre'): Promise<void> {
    const clearFn = (window as unknown as {
      BENCHMARK_CLEAR_LAYER?: (renderer: string) => Promise<void>;
    }).BENCHMARK_CLEAR_LAYER;

    if (!clearFn) {
      console.warn('[BenchmarkRunner] BENCHMARK_CLEAR_LAYER not defined');
      return;
    }

    return clearFn(renderer);
  }

  /**
   * 采集 FPS - 模拟用户交互
   */
  private async collectFPS(durationMs: number): Promise<void> {
    this.fpsCollector.start();

    // 模拟缩放/漫游交互
    const interactFn = (window as unknown as {
      BENCHMARK_INTERACT?: (durationMs: number) => Promise<void>;
    }).BENCHMARK_INTERACT;

    if (interactFn) {
      await interactFn(durationMs);
    } else {
      // 简单等待
      await new Promise((resolve) => setTimeout(resolve, durationMs));
    }
  }

  /**
   * 运行对比测试
   */
  async runComparison(config: BenchmarkConfig): Promise<{
    cesium: BenchmarkResult;
    maplibre: BenchmarkResult;
  }> {
    const cesiumResult = await this.run(config, 'cesium');
    const maplibreResult = await this.run(config, 'maplibre');

    consoleReporter.comparison(cesiumResult, maplibreResult);

    return { cesium: cesiumResult, maplibre: maplibreResult };
  }
}