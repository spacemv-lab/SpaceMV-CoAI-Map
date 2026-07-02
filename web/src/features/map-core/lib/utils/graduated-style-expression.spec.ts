/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { describe, it, expect } from 'vitest';
import {
  generateGraduatedColorExpression,
  generateGraduatedSizeExpression,
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
  it('wraps the field accessor in coalesce(null) so null properties do not throw', () => {
    // 回归：['get', field] 遇 null 会抛 "Expected number, found null"，并使要素回退最大色。
    // 必须用 coalesce 兜底为 0。
    const expr = generateGraduatedColorExpression(config()) as unknown[];

    // ['interpolate', ['linear'], <input>, ...stops]
    const input = expr[2];
    expect(input).toEqual(['coalesce', ['get', 'value'], 0]);
  });

  it('returns null when breakpoints are missing or too few', () => {
    expect(generateGraduatedColorExpression(config({ breakpoints: undefined }))).toBeNull();
    expect(generateGraduatedColorExpression(config({ breakpoints: [5] }))).toBeNull();
    expect(generateGraduatedColorExpression(config({ field: '' }))).toBeNull();
  });
});

describe('generateGraduatedSizeExpression', () => {
  it('wraps the field accessor in coalesce(null) too', () => {
    const expr = generateGraduatedSizeExpression(config()) as unknown[];
    const input = expr[2];
    expect(input).toEqual(['coalesce', ['get', 'value'], 0]);
  });
});
