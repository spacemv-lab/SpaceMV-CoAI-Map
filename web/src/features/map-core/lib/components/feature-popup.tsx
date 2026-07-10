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
import { SelectionState, LayerFieldDefinition } from '../types/map-state';
import { useMapStore } from '../store/use-map-store';
import {
  fetchFeatureDetail,
  FeatureDetailResponse,
} from '@/features/gis-data-manager/feature-api';
import { buildImageUrl } from './property-value-renderer';

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
  fields?: LayerFieldDefinition[],
  datasetId?: string,
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'max-h-60 overflow-y-auto min-w-[280px]';

  // 优先按字段 schema 渲染（空值字段也显示）；schema 缺失时退回裸 properties
  const fieldEntries: Array<{ key: string; type?: string }> =
    fields && fields.length > 0
      ? fields.map((f) => ({ key: f.name, type: f.type }))
      : Object.keys(properties).map((key) => ({ key }));

  const totalKeys = fieldEntries.length;
  const entries = expanded ? fieldEntries : fieldEntries.slice(0, 15);

  if (entries.length === 0) {
    container.innerHTML =
      '<div class="text-gray-400 text-sm p-2">无属性数据</div>';
    return container;
  }

  const table = document.createElement('table');
  table.className = 'w-full text-xs border-collapse';

  for (const { key, type } of entries) {
    const value = properties[key];
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-100';

    const tdKey = document.createElement('td');
    tdKey.className =
      'font-medium text-gray-600 py-1.5 px-2 whitespace-nowrap align-top w-1/3';
    tdKey.textContent = key;

    const tdValue = document.createElement('td');
    tdValue.className = `text-gray-800 py-1.5 px-2 break-all align-top${editable ? ' cursor-text hover:bg-blue-50' : ''}`;

    if (editable && onPropertyChange) {
      // 编辑模式：input text（image 字段在 edit-panel 上传，弹窗此处显示 key 文本）
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
      // 只读：按字段类型分发（image→缩略图 / url→链接 / date→格式化）
      appendReadOnlyValue(tdValue, value, type, datasetId);
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

/** 只读属性值按类型渲染进 td（image 走下载代理 endpoint 取图） */
function appendReadOnlyValue(
  td: HTMLTableCellElement,
  value: unknown,
  type: string | undefined,
  datasetId?: string,
): void {
  if (value === null || value === undefined || value === '') {
    td.textContent = '-';
    return;
  }

  if (type === 'image' && datasetId) {
    const src = buildImageUrl(datasetId, String(value));
    const a = document.createElement('a');
    a.href = src;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.className = 'h-12 w-12 object-cover rounded inline-block';
    a.appendChild(img);
    td.appendChild(a);
    return;
  }

  if (type === 'url') {
    const href = String(value);
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = href;
    a.className = 'text-blue-600 hover:underline break-all';
    td.appendChild(a);
    return;
  }

  if (type === 'date') {
    const d = new Date(String(value));
    td.textContent = isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
    return;
  }

  td.textContent =
    typeof value === 'object' ? JSON.stringify(value) : String(value);
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
  const layers = useMapStore((state) => state.layers);
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

    // 取图层字段 schema + datasetId（用于按类型渲染，如 image 缩略图）
    const layer = selection?.layerId
      ? layers.find((l) => l.id === selection.layerId)
      : undefined;
    const fields = layer?.fields;
    const datasetId = selection?.datasetId;

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
          fields,
          datasetId,
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
        renderPropertiesTable(
          data.properties,
          expanded,
          () => setExpanded(true),
          false,
          undefined,
          fields,
          datasetId,
        ),
      );
      popupRef.current.setDOMContent(contentEl);
    }
  }, [loading, error, data, selection?.featureId, selection?.layerId, selection?.datasetId, layers, expanded, isEditMode, editFeature, setEditFeature, setHasUnsavedChanges]);

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
