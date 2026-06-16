/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * FPS 帧率采集器
 *
 * 使用 requestAnimationFrame 计算 delta time
 * - 支持暂停/恢复
 * - 返回统计结果（avg, min, max, p95）
 */

export interface FPSStats {
  avg: number;
  min: number;
  max: number;
  p95: number;
  samples: number;
}

export class FPSCollector {
  private frames: number[] = [];
  private lastTime: number = 0;
  private collecting: boolean = false;
  private rafId: number | null = null;

  /**
   * 开始采集
   */
  start(): void {
    this.collecting = true;
    this.frames = [];
    this.lastTime = performance.now();
    this.tick();
  }

  private tick = (): void => {
    if (!this.collecting) return;

    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;

    // 计算当前帧的 FPS (1000ms / delta)
    if (delta > 0) {
      const fps = 1000 / delta;
      // 过滤异常高值（delta < 1ms 会导致 fps > 1000）
      if (fps < 200) {
        this.frames.push(fps);
      }
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  /**
   * 暂停采集
   */
  pause(): void {
    this.collecting = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * 恢复采集
   */
  resume(): void {
    if (!this.collecting) {
      this.collecting = true;
      this.lastTime = performance.now();
      this.tick();
    }
  }

  /**
   * 停止采集并返回统计结果
   */
  stop(): FPSStats {
    this.pause();

    if (this.frames.length === 0) {
      return { avg: 0, min: 0, max: 0, p95: 0, samples: 0 };
    }

    const sorted = [...this.frames].sort((a, b) => a - b);
    const sum = this.frames.reduce((a, b) => a + b, 0);

    return {
      avg: sum / this.frames.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      samples: this.frames.length,
    };
  }

  /**
   * 获取当前实时 FPS
   */
  getCurrentFPS(): number {
    if (this.frames.length === 0) return 0;
    return this.frames[this.frames.length - 1];
  }

  /**
   * 清理数据
   */
  clear(): void {
    this.frames = [];
  }

  /**
   * 是否正在采集
   */
  isCollecting(): boolean {
    return this.collecting;
  }
}