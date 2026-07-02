/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { FieldSelector } from './field-selector';
import { LayerState } from '../../../types/map-state';

const baseLayer = (fields: LayerState['fields']): LayerState =>
  ({
    id: 'layer-1',
    name: 'Point Layer',
    type: 'GeoJSON',
    visible: true,
    opacity: 1,
    style: {},
    fields,
  }) as LayerState;

describe('FieldSelector', () => {
  it('auto-selects the first numeric field when value is empty (regression: a single numeric field used to never commit)', async () => {
    // 手绘点图层通常只有一个数值字段：旧实现 select 用 `value || numericFields[0]`
    // 回退显示该项，但 state 的 field 仍为 ''，且重选这一项不触发 onChange → 面板永远空白。
    const onChange = vi.fn();
    const layer = baseLayer([{ name: 'value', alias: '数值', type: 'number' }]);

    render(<FieldSelector layer={layer} value="" onChange={onChange} />);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('value');
    });
  });

  it('does not call onChange when a field is already selected', () => {
    const onChange = vi.fn();
    const layer = baseLayer([{ name: 'value', alias: '数值', type: 'number' }]);

    render(<FieldSelector layer={layer} value="value" onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders an actionable empty-state when there are no numeric fields', () => {
    const onChange = vi.fn();
    // 只有 string 字段 → 数值字段为空，应给出可操作的提示而非静默空白
    const layer = baseLayer([{ name: 'name', alias: '名称', type: 'string' }]);

    const { getByText } = render(
      <FieldSelector layer={layer} value="" onChange={onChange} />,
    );

    expect(getByText(/无可用数值字段/)).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
});
