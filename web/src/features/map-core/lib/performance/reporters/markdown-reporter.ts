/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * Markdown 报告生成器
 *
 * 输出格式化的 Cesium vs MapLibre 对比报告
 */

import type { BenchmarkResult } from '../benchmark/runner';

/**
 * 格式化字节为可读单位
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * 格式化毫秒
 */
function formatMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/**
 * 格式化帧率
 */
function formatFps(fps: number): string {
  return `${fps.toFixed(1)} fps`;
}

/**
 * 计算变化百分比
 * @param before 原始值
 * @param after 新值
 * @param inverse 是否是"越低越好"指标（如时间、内存）
 */
function calcImprovement(
  before: number,
  after: number,
  inverse: boolean = true,
): string {
  if (before === 0 || after === 0) return '-';

  const change = ((after - before) / before) * 100;
  const absChange = Math.abs(change);

  // inverse=true 表示越低越好（时间、内存）
  // inverse=false 表示越高越好（帧率）
  if (inverse) {
    if (change < 0) {
      return `↓ ${absChange.toFixed(0)}%`;
    } else {
      return `↑ ${absChange.toFixed(0)}%`;
    }
  } else {
    if (change > 0) {
      return `↑ ${absChange.toFixed(0)}%`;
    } else {
      return `↓ ${absChange.toFixed(0)}%`;
    }
  }
}

/**
 * 获取设备信息摘要
 */
function getDeviceInfoSummary(deviceInfo: string): string {
  // 截取关键信息
  if (deviceInfo.includes('Chrome')) {
    const chromeVersion = deviceInfo.match(/Chrome\/(\d+)/)?.[1] || '?';
    const os = deviceInfo.includes('Windows')
      ? 'Windows'
      : deviceInfo.includes('Mac')
        ? 'Mac'
        : deviceInfo.includes('Linux')
          ? 'Linux'
          : 'Unknown';
    return `${os}, Chrome ${chromeVersion}`;
  }
  return deviceInfo.slice(0, 50);
}

/**
 * 生成 Markdown 对比报告
 */
export function generateMarkdownReport(
  cesiumResult: BenchmarkResult,
  maplibreResult: BenchmarkResult,
): string {
  const date = new Date().toISOString().split('T')[0];

  const lines: string[] = [
    `# 地图渲染性能对比报告`,
    '',
    `## 测试环境`,
    '',
    `- **日期**: ${date}`,
    `- **数据集**: ${cesiumResult.datasetId}`,
    `- **数据规模**: ${cesiumResult.featureCount} 要素`,
    `- **设备**: ${getDeviceInfoSummary(cesiumResult.deviceInfo)}`,
    `- **测试次数**: ${cesiumResult.iterations} 次`,
    '',
    `## 核心指标对比`,
    '',
    `| 指标 | Cesium (GeoJSON) | MapLibre (MVT) | 变化 |`,
    `|------|------------------|----------------|------|`,
    `| 数据传输量 | ${formatBytes(cesiumResult.dataTransfer)} | ${formatBytes(maplibreResult.dataTransfer)} | ${calcImprovement(cesiumResult.dataTransfer, maplibreResult.dataTransfer)} |`,
    `| 数据请求耗时 | ${formatMs(cesiumResult.fetchDuration)} | ${formatMs(maplibreResult.fetchDuration)} | ${calcImprovement(cesiumResult.fetchDuration, maplibreResult.fetchDuration)} |`,
    `| 首帧渲染时间 | ${formatMs(cesiumResult.firstRender)} | ${formatMs(maplibreResult.firstRender)} | ${calcImprovement(cesiumResult.firstRender, maplibreResult.firstRender)} |`,
    `| 内存峰值 | ${formatBytes(cesiumResult.memoryPeak)} | ${formatBytes(maplibreResult.memoryPeak)} | ${calcImprovement(cesiumResult.memoryPeak, maplibreResult.memoryPeak)} |`,
    `| 平均帧率 | ${formatFps(cesiumResult.fpsAverage)} | ${formatFps(maplibreResult.fpsAverage)} | ${calcImprovement(cesiumResult.fpsAverage, maplibreResult.fpsAverage, false)} |`,
    `| P95帧率 | ${formatFps(cesiumResult.fpsP95)} | ${formatFps(maplibreResult.fpsP95)} | ${calcImprovement(cesiumResult.fpsP95, maplibreResult.fpsP95, false)} |`,
    '',
    `## 技术说明`,
    '',
    `### Cesium GeoJSON 方案`,
    `- 全量数据一次性加载`,
    `- 内存中保留所有要素`,
    `- 适合编辑场景（要素可直接操作）`,
    '',
    `### MapLibre MVT 方案`,
    `- 数据按瓦片分块加载`,
    `- 仅当前视口数据在内存中`,
    `- 适合大屏展示场景（>1000要素）`,
    '',
    `## 结论`,
    '',
  ];

  // 自动生成结论
  const firstRenderImprovement =
    (cesiumResult.firstRender - maplibreResult.firstRender) /
    cesiumResult.firstRender;
  const memoryImprovement =
    (cesiumResult.memoryPeak - maplibreResult.memoryPeak) /
    cesiumResult.memoryPeak;

  if (firstRenderImprovement > 0.5 || memoryImprovement > 0.5) {
    lines.push(
      `MapLibre MVT 方案在大数据集场景下性能优势显著：`,
      `- 首帧时间降低 **${(firstRenderImprovement * 100).toFixed(0)}%**`,
      `- 内存占用降低 **${(memoryImprovement * 100).toFixed(0)}%**`,
      '',
      `建议：数据规模 >1000要素 时采用 MapLibre MVT 方案。`,
    );
  } else {
    lines.push(
      `两种方案性能差异不大，可根据功能需求选择：`,
      `- 编辑场景：推荐 Cesium GeoJSON`,
      `- 展示场景：推荐 MapLibre MVT`,
    );
  }

  return lines.join('\n');
}