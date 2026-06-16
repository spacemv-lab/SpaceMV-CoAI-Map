/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 性能基准测试框架
 *
 * 三层架构：
 * - 指标定义层 (metrics/) - 定义性能指标语义和预算
 * - 采集层 - 采集器实现
 * - 报告层 - 输出格式化
 */

// 指标定义
export { METRICS, MetricDefinition, MetricUnit } from './metrics';

// 采集器
export { PerformanceCollector } from './collectors/performance-api';
export { FPSCollector } from './collectors/fps-collector';
export { MemoryCollector } from './collectors/memory-collector';

// 报告器
export { generateMarkdownReport } from './reporters/markdown-reporter';
export { consoleReporter } from './reporters/console-reporter';
export { jsonReporter } from './reporters/json-reporter';

// 测试编排
export { BenchmarkRunner, BenchmarkResult, BenchmarkConfig } from './benchmark/runner';
export { runBenchmarkTest } from './benchmark/ui-tool';