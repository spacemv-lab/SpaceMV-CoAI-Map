/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { FeaturePopup } from './feature-popup';
import maplibregl from 'maplibre-gl';

// Mock maplibregl.Popup as a constructor
const mockPopupMethods = {
  setLngLat: vi.fn().mockReturnThis(),
  setDOMContent: vi.fn().mockReturnThis(),
  addTo: vi.fn().mockReturnThis(),
  remove: vi.fn(),
  on: vi.fn(),
};

vi.mock('maplibre-gl', () => ({
  default: {
    Popup: vi.fn().mockImplementation(function (this: any) {
      this.setLngLat = mockPopupMethods.setLngLat.mockReturnThis();
      this.setDOMContent = mockPopupMethods.setDOMContent.mockReturnThis();
      this.addTo = mockPopupMethods.addTo.mockReturnThis();
      this.remove = mockPopupMethods.remove;
      this.on = mockPopupMethods.on;
      return this;
    }),
  },
}));

// Mock fetchFeatureDetail
vi.mock('@/features/gis-data-manager/feature-api', () => ({
  fetchFeatureDetail: vi.fn(),
}));

const { fetchFeatureDetail } = await import(
  '@/features/gis-data-manager/feature-api'
);

describe('FeaturePopup', () => {
  const mockMap = {
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as maplibregl.Map;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (fetchFeatureDetail as ReturnType<typeof vi.fn>).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not render popup when selection is null', () => {
    render(
      <FeaturePopup
        selection={{
          layerId: null,
          featureId: null,
          properties: null,
          datasetId: null,
        }}
        map={mockMap}
      />,
    );
    expect(maplibregl.Popup).not.toHaveBeenCalled();
  });

  it('should show loading state on initial render', async () => {
    (fetchFeatureDetail as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );

    render(
      <FeaturePopup
        selection={{
          layerId: 'layer-uuid-1',
          featureId: '123',
          properties: null,
          datasetId: 'ds-abc',
          lngLat: [104.06, 30.67],
        }}
        map={mockMap}
      />,
    );

    expect(maplibregl.Popup).toHaveBeenCalled();
    const popup = (maplibregl.Popup as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(popup.setDOMContent).toHaveBeenCalled();
    const content = popup.setDOMContent.mock.calls[0][0];
    expect(content.textContent).toContain('加载中');
  });

  it('should use datasetId (not layerId) for API call', async () => {
    (fetchFeatureDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      featureId: '123',
      datasetId: 'ds-abc',
      properties: { name: 'Test' },
    });

    render(
      <FeaturePopup
        selection={{
          layerId: 'layer-uuid-1',
          featureId: '123',
          properties: null,
          datasetId: 'ds-abc',
          lngLat: [104.06, 30.67],
        }}
        map={mockMap}
      />,
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(fetchFeatureDetail).toHaveBeenCalledWith('ds-abc', '123');
  });

  it('should show properties on successful fetch', async () => {
    (fetchFeatureDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      featureId: '123',
      datasetId: 'ds-abc',
      properties: { name: 'Test', area: 1000 },
    });

    render(
      <FeaturePopup
        selection={{
          layerId: 'layer-uuid-1',
          featureId: '123',
          properties: null,
          datasetId: 'ds-abc',
          lngLat: [104.06, 30.67],
        }}
        map={mockMap}
      />,
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const popup = (maplibregl.Popup as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(popup.setDOMContent).toHaveBeenCalledTimes(2);
    const lastContent = popup.setDOMContent.mock.calls.pop()[0];
    expect(lastContent.textContent).toContain('Test');
  });

  it('should show error on failed fetch', async () => {
    (fetchFeatureDetail as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('要素未找到'),
    );

    render(
      <FeaturePopup
        selection={{
          layerId: 'layer-uuid-1',
          featureId: '123',
          properties: null,
          datasetId: 'ds-abc',
          lngLat: [104.06, 30.67],
        }}
        map={mockMap}
      />,
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const popup = (maplibregl.Popup as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    const lastContent = popup.setDOMContent.mock.calls.pop()[0];
    expect(lastContent.textContent).toContain('要素未找到');
  });

  it('should show expand button when properties exceed 15 items', async () => {
    const manyProps: Record<string, unknown> = {};
    for (let i = 0; i < 20; i++) {
      manyProps[`key_${i}`] = `value_${i}`;
    }
    (fetchFeatureDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      featureId: '123',
      datasetId: 'ds-abc',
      properties: manyProps,
    });

    render(
      <FeaturePopup
        selection={{
          layerId: 'layer-uuid-1',
          featureId: '123',
          properties: null,
          datasetId: 'ds-abc',
          lngLat: [104.06, 30.67],
        }}
        map={mockMap}
      />,
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const popup = (maplibregl.Popup as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    const lastContent = popup.setDOMContent.mock.calls.pop()[0];
    expect(lastContent.textContent).toContain('仅显示前 15 项');
    expect(lastContent.textContent).toContain('点击展开全部');
  });

  it('should expand all properties when expand button is clicked', async () => {
    const manyProps: Record<string, unknown> = {};
    for (let i = 0; i < 20; i++) {
      manyProps[`key_${i}`] = `value_${i}`;
    }
    (fetchFeatureDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      featureId: '123',
      datasetId: 'ds-abc',
      properties: manyProps,
    });

    render(
      <FeaturePopup
        selection={{
          layerId: 'layer-uuid-1',
          featureId: '123',
          properties: null,
          datasetId: 'ds-abc',
          lngLat: [104.06, 30.67],
        }}
        map={mockMap}
      />,
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Find and click the expand button
    const popup = (maplibregl.Popup as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    const contentAfterLoad = popup.setDOMContent.mock.calls.pop()[0];
    const expandBtn = contentAfterLoad.querySelector('button');
    expect(expandBtn).toBeTruthy();

    // Click expand button
    await act(async () => {
      expandBtn!.click();
      await vi.runAllTimersAsync();
    });

    const contentAfterExpand = popup.setDOMContent.mock.calls.pop()[0];
    expect(contentAfterExpand.textContent).toContain('value_19');
    expect(contentAfterExpand.querySelector('button')).toBeFalsy();
  });
});
