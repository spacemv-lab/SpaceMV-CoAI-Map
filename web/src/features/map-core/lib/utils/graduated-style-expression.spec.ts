/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { describe, it, expect } from 'vitest';
import {
  generateGraduatedColorExpression,
  generateGraduatedSizeExpression,
  NO_DATA_COLOR,
} from './graduated-style-expression';
import { GraduatedConfig } from '../types/graduated-style';

const config = (overrides: Partial<GraduatedConfig> = {}): GraduatedConfig => ({
  field: 'value',
  method: 'equal-interval',
  classes: 5,
  colorRamp: 'blues',
  breakpoints: [0, 20, 40, 60, 80, 100],
  ...overrides,
});

describe('generateGraduatedColorExpression', () => {
  it('routes no-data (missing/null/"") to a gray color, valid numbers to interpolate', () => {
    // 回归：空值不能再被 coalesce 兜底成 0（会把“无数据”误读成“最低值”）。
    // 现在用 case：无数据条件 → 灰；其余 → interpolate(get(field))。
    const expr = generateGraduatedColorExpression(config()) as unknown[];

    expect(expr[0]).toBe('case');
    // 无数据分支输出灰色
    expect(expr).toContain(NO_DATA_COLOR);
    // default（最后一项）是 interpolate，且直接吃 ['get', field]（不再 coalesce）
    const def = expr[expr.length - 1] as unknown[];
    expect(def[0]).toBe('interpolate');
    expect(def[2]).toEqual(['get', 'value']);
    // 无数据判定含「缺字段 / null / 空串」三种
    const cond = expr[1] as unknown[];
    expect(cond[0]).toBe('any');
  });

  it('returns null when breakpoints are missing or too few', () => {
    expect(generateGraduatedColorExpression(config({ breakpoints: undefined }))).toBeNull();
    expect(generateGraduatedColorExpression(config({ breakpoints: [5] }))).toBeNull();
    expect(generateGraduatedColorExpression(config({ field: '' }))).toBeNull();
  });
});

describe('generateGraduatedSizeExpression', () => {
  it('routes no-data to minSize, valid numbers to interpolate', () => {
    const expr = generateGraduatedSizeExpression(config(), 4, 20) as unknown[];
    expect(expr[0]).toBe('case');
    // 无数据分支取最小尺寸
    expect(expr[2]).toBe(4);
    // default 是 interpolate
    const def = expr[expr.length - 1] as unknown[];
    expect(def[0]).toBe('interpolate');
  });
});
