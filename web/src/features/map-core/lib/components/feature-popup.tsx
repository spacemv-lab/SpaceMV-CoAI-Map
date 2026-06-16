/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * FeaturePopup — MapLibre 要素详情弹窗
 *
 * 监听 selection 变化，调用后端 API 获取完整要素属性，
 * 用 maplibregl.Popup 渲染 key-value 表格。
 *
 * 编辑模式下：支持属性内联编辑，失焦后更新到 store
 *
 * 与 Cesium PopupState 共存，互不干扰。
 */

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { SelectionState } from '../types/map-state';
import { useMapStore } from '../store/use-map-store';
import {
  fetchFeatureDetail,
  FeatureDetailResponse,
} from '@/features/gis-data-manager/feature-api';

interface FeaturePopupProps {
  selection: SelectionState;
  map: maplibregl.Map;
}

/**
 * 渲染 key-value 属性表格
 * 编辑模式下支持内联编辑
 */
function renderPropertiesTable(
  properties: Record<string, unknown>,
  expanded: boolean,
  onExpand?: () => void,
  editable?: boolean,
  onPropertyChange?: (key: string, value: unknown) => void,
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'max-h-60 overflow-y-auto min-w-[280px]';

  const totalKeys = Object.keys(properties).length;
  const entries = expanded
    ? Object.entries(properties)
    : Object.entries(properties).slice(0, 15);

  if (entries.length === 0) {
    container.innerHTML =
      '<div class="text-gray-400 text-sm p-2">无属性数据</div>';
    return container;
  }

  const table = document.createElement('table');
  table.className = 'w-full text-xs border-collapse';

  for (const [key, value] of entries) {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-100';

    const tdKey = document.createElement('td');
    tdKey.className =
      'font-medium text-gray-600 py-1.5 px-2 whitespace-nowrap align-top w-1/3';
    tdKey.textContent = key;

    const tdValue = document.createElement('td');
    tdValue.className = `text-gray-800 py-1.5 px-2 break-all align-top${editable ? ' cursor-text hover:bg-blue-50' : ''}`;

    if (editable && onPropertyChange) {
      // 编辑模式：使用 input 元素
      const input = document.createElement('input');
      input.type = 'text';
      input.value = typeof value === 'object'
        ? JSON.stringify(value)
        : String(value ?? '-');
      input.className =
        'w-full bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none px-1 py-0.5 rounded text-xs';
      input.addEventListener('blur', () => {
        onPropertyChange(key, input.value);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
        }
      });
      tdValue.appendChild(input);
    } else {
      tdValue.textContent =
        typeof value === 'object'
          ? JSON.stringify(value)
          : String(value ?? '-');
    }

    tr.appendChild(tdKey);
    tr.appendChild(tdValue);
    table.appendChild(tr);
  }

  container.appendChild(table);

  if (!expanded && totalKeys > 15) {
    const expandBtn = document.createElement('button');
    expandBtn.className =
      'w-full text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 text-center cursor-pointer border-0 bg-transparent';
    expandBtn.textContent = `... 仅显示前 15 项，共 ${totalKeys} 项，点击展开全部`;
    if (onExpand) {
      expandBtn.onclick = onExpand;
    }
    container.appendChild(expandBtn);
  }

  return container;
}

export function FeaturePopup({ selection, map }: FeaturePopupProps) {
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FeatureDetailResponse | null>(null);
  const [expanded, setExpanded] = useState(false);

  // 编辑模式状态
  const editFeature = useMapStore((state) => state.edit.editFeature);
  const setEditFeature = useMapStore((state) => state.setEditFeature);
  const setHasUnsavedChanges = useMapStore((state) => state.setHasUnsavedChanges);
  const isEditMode = editFeature !== null;

  // 清理 Popup
  useEffect(() => {
    return () => {
      popupRef.current?.remove();
    };
  }, []);

  // 当 selection 变化时：发起请求
  // 编辑模式下跳过 API 请求，使用 editFeature
  useEffect(() => {
    if (!selection?.datasetId || !selection?.featureId) {
      popupRef.current?.remove();
      popupRef.current = null;
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    // 编辑模式下不请求 API
    if (isEditMode) {
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    setExpanded(false);

    fetchFeatureDetail(selection.datasetId!, selection.featureId)
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err.message ?? '加载失败，请重试');
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [selection?.datasetId, selection?.featureId, selection?.lngLat, isEditMode]);

  // 根据状态显示 Popup
  useEffect(() => {
    if (!selection?.lngLat) {
      popupRef.current?.remove();
      popupRef.current = null;
      return;
    }

    const lngLat: [number, number] = selection.lngLat!;

    // 先移除旧 popup，再创建新的
    if (popupRef.current) {
      const oldPopup = popupRef.current;
      popupRef.current = null;
      oldPopup.remove();
    }

    const popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: '360px',
    })
      .setLngLat(lngLat)
      .addTo(map);

    popup.on('close', () => {
      if (popupRef.current === popup) {
        popupRef.current = null;
      }
    });

    popupRef.current = popup;
  }, [selection?.lngLat, map]);

  // 更新 Popup 内容
  useEffect(() => {
    if (!popupRef.current) return;

    if (loading) {
      popupRef.current.setDOMContent(
        createPopupContent(
          '要素 ID: ' + (selection.featureId ?? ''),
          '加载中...',
        ),
      );
      return;
    }

    if (error) {
      popupRef.current.setDOMContent(
        createPopupContent(
          '要素 ID: ' + (selection.featureId ?? ''),
          error,
          'text-red-500',
        ),
      );
      return;
    }

    // 编辑模式：使用 editFeature 的属性
    if (isEditMode && editFeature) {
      const featureId = (editFeature.id as string) ?? selection.featureId ?? '';
      const title = `要素 ID: ${featureId}`;
      const properties = (editFeature.properties as Record<string, unknown>) ?? {};
      const contentEl = createPopupContent(title);
      contentEl.appendChild(
        renderPropertiesTable(
          properties,
          expanded,
          () => setExpanded(true),
          true,
          (key, value) => {
            // 属性修改
            const updated = {
              ...editFeature,
              properties: {
                ...(editFeature.properties as Record<string, unknown>),
                [key]: value,
              },
            };
            setEditFeature(updated);
            setHasUnsavedChanges(true);
          },
        ),
      );
      popupRef.current.setDOMContent(contentEl);
      return;
    }

    // 普通模式：使用 API 数据
    if (data) {
      const title = `要素 ID: ${data.featureId}`;
      const contentEl = createPopupContent(title);
      contentEl.appendChild(
        renderPropertiesTable(data.properties, expanded, () => setExpanded(true)),
      );
      popupRef.current.setDOMContent(contentEl);
    }
  }, [loading, error, data, selection.featureId, expanded, isEditMode, editFeature, setEditFeature, setHasUnsavedChanges]);

  return null;
}

function createPopupContent(
  title: string,
  body?: string,
  bodyClass?: string,
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'font-sans';

  const titleEl = document.createElement('div');
  titleEl.className =
    'text-sm font-semibold text-gray-800 pb-2 mb-2 border-b border-gray-200';
  titleEl.textContent = title;
  container.appendChild(titleEl);

  if (body) {
    const bodyEl = document.createElement('div');
    bodyEl.className = `text-sm ${bodyClass ?? 'text-gray-500'}`;
    bodyEl.textContent = body;
    container.appendChild(bodyEl);
  }

  return container;
}
