/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { GraduatedColorsPanel } from './graduated-colors-panel';
import { GraduatedConfig } from '../../../types/graduated-style';
import { LayerState } from '../../../types/map-state';

vi.mock('../../../api/field-stats-api', () => ({
  fetchFieldStats: vi.fn(),
}));

const { fetchFieldStats } = await import('../../../api/field-stats-api');

const layer = {
  id: 'layer-1',
  name: 'Point Layer',
  type: 'GeoJSON',
  visible: true,
  opacity: 1,
  style: {},
  sourceId: 'dataset-1',
  fields: [{ name: 'value', alias: '数值', type: 'number' }],
  data: { type: 'FeatureCollection', features: [] },
} as unknown as LayerState;

const config = (classes: number): GraduatedConfig => ({
  field: 'value',
  method: 'equal-interval',
  classes,
  colorRamp: 'blues',
});

describe('GraduatedColorsPanel', () => {
  it('ignores stale field-stats results when classes changes mid-flight (no oscillation)', async () => {
    // 拖动类数滑块会在途触发多次 fetchFieldStats。后 resolve 的旧请求若不丢弃，
    // 会把旧类数整体写回，使滑块在新旧值间反复横跳。
    let resolveFirst!: (v: unknown) => void;
    let resolveSecond!: (v: unknown) => void;
    const first = new Promise((r) => {
      resolveFirst = r;
    });
    const second = new Promise((r) => {
      resolveSecond = r;
    });
    (fetchFieldStats as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);

    const onChange = vi.fn();

    const { rerender } = render(
      <GraduatedColorsPanel layer={layer} config={config(5)} onChange={onChange} />,
    );

    // 类数在首个请求在途时改为 7 → 旧请求(类数5)应被取消
    rerender(
      <GraduatedColorsPanel layer={layer} config={config(7)} onChange={onChange} />,
    );

    // 先 resolve 已过期的旧请求：必须被忽略，不能触发任何 onChange
    await act(async () => {
      resolveFirst({
        min: 0,
        max: 100,
        mean: 50,
        breakpoints: [0, 20, 40, 60, 80, 100],
        computedAt: '',
      });
    });
    expect(onChange).not.toHaveBeenCalled();

    // 再 resolve 最新请求：写回的类数必须是 7（最新），而不是 5
    await act(async () => {
      resolveSecond({
        min: 0,
        max: 100,
        mean: 50,
        breakpoints: [0, 14, 28, 42, 57, 71, 85, 100],
        computedAt: '',
      });
    });
    await waitFor(() => expect(onChange).toHaveBeenCalled());

    const applied = onChange.mock.calls.at(-1)![0] as GraduatedConfig;
    expect(applied.classes).toBe(7);
    expect(applied.breakpoints).toHaveLength(8);
  });
});
