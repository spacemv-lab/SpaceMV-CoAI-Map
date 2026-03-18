/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { useMemo, useState } from 'react';
import { useMapStore } from '../../store/use-map-store';
import { AttributeFieldType, LayerFieldDefinition } from '../../types/map-state';
import { Plus, Trash2 } from 'lucide-react';

const FIELD_TYPES: AttributeFieldType[] = [
  'string',
  'number',
  'boolean',
  'date',
  'unknown',
];

const EMPTY_FIELD: LayerFieldDefinition = {
  name: '',
  alias: '',
  type: 'string',
  length: 255,
  nullable: true,
  indexed: false,
  remark: '',
};

interface FieldsTableProps {
  layerId: string;
}

export function FieldsTable({ layerId }: FieldsTableProps) {
  const layers = useMapStore((state) => state.layers);
  const addLayerField = useMapStore((state) => state.addLayerField);
  const updateLayerField = useMapStore((state) => state.updateLayerField);
  const removeLayerField = useMapStore((state) => state.removeLayerField);

  const [draftField, setDraftField] = useState<LayerFieldDefinition>({
    ...EMPTY_FIELD,
  });
  const layer = layers.find((item) => item.id === layerId);
  const fields = useMemo(() => layer?.fields || [], [layer?.fields]);

  if (!layer) {
    return null;
  }

  const validateRename = (originalName: string, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed) {
      return originalName;
    }
    if (trimmed !== originalName && fields.some((field) => field.name === trimmed)) {
      return originalName;
    }
    return trimmed;
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-slate-50 px-3 py-3">
        <div className="grid grid-cols-8 gap-2">
          <input
            value={draftField.name}
            onChange={(event) =>
              setDraftField({ ...draftField, name: event.target.value })
            }
            placeholder="名称"
            className="rounded border border-slate-200 px-2 py-1.5 text-sm"
          />
          <input
            value={draftField.alias || ''}
            onChange={(event) =>
              setDraftField({ ...draftField, alias: event.target.value })
            }
            placeholder="别名"
            className="rounded border border-slate-200 px-2 py-1.5 text-sm"
          />
          <select
            value={draftField.type}
            onChange={(event) =>
              setDraftField({
                ...draftField,
                type: event.target.value as AttributeFieldType,
                length:
                  event.target.value === 'string'
                    ? (draftField.length ?? 255)
                    : null,
              })
            }
            className="rounded border border-slate-200 px-2 py-1.5 text-sm"
          >
            {FIELD_TYPES.map((fieldType) => (
              <option key={fieldType} value={fieldType}>
                {fieldType}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={draftField.length ?? ''}
            disabled={draftField.type !== 'string'}
            onChange={(event) =>
              setDraftField({
                ...draftField,
                length: event.target.value ? Number(event.target.value) : null,
              })
            }
            placeholder="长度"
            className="rounded border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-100"
          />
          <label className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1.5 text-sm">
            <input
              type="checkbox"
              checked={!draftField.nullable}
              onChange={(event) =>
                setDraftField({
                  ...draftField,
                  nullable: !event.target.checked,
                })
              }
            />
            非空
          </label>
          <label className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1.5 text-sm">
            <input
              type="checkbox"
              checked={Boolean(draftField.indexed)}
              onChange={(event) =>
                setDraftField({
                  ...draftField,
                  indexed: event.target.checked,
                })
              }
            />
            索引
          </label>
          <input
            value={draftField.remark || ''}
            onChange={(event) =>
              setDraftField({ ...draftField, remark: event.target.value })
            }
            placeholder="备注"
            className="rounded border border-slate-200 px-2 py-1.5 text-sm"
          />
          <button
            className="inline-flex items-center justify-center gap-1 rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
            onClick={() => {
              const name = draftField.name.trim();
              if (!name || fields.some((field) => field.name === name)) {
                return;
              }
              addLayerField(layerId, {
                ...draftField,
                name,
                alias: draftField.alias?.trim() || name,
              });
              setDraftField({ ...EMPTY_FIELD });
            }}
          >
            <Plus className="h-4 w-4" />
            新增字段
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">名称</th>
              <th className="px-3 py-2">别名</th>
              <th className="px-3 py-2">类型</th>
              <th className="px-3 py-2">长度</th>
              <th className="px-3 py-2">非空</th>
              <th className="px-3 py-2">索引</th>
              <th className="px-3 py-2">备注</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {fields.map((field) => (
              <tr key={field.name}>
                <td className="px-3 py-2">
                  <input
                    defaultValue={field.name}
                    onBlur={(event) =>
                      updateLayerField(layerId, field.name, {
                        name: validateRename(field.name, event.target.value),
                      })
                    }
                    className="w-full rounded border border-transparent px-2 py-1 hover:border-slate-200 focus:border-slate-300"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    defaultValue={field.alias || ''}
                    onBlur={(event) =>
                      updateLayerField(layerId, field.name, {
                        alias: event.target.value,
                      })
                    }
                    className="w-full rounded border border-transparent px-2 py-1 hover:border-slate-200 focus:border-slate-300"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={field.type}
                    onChange={(event) =>
                      updateLayerField(layerId, field.name, {
                        type: event.target.value as AttributeFieldType,
                      })
                    }
                    className="rounded border border-slate-200 px-2 py-1"
                  >
                    {FIELD_TYPES.map((fieldType) => (
                      <option key={fieldType} value={fieldType}>
                        {fieldType}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    disabled={field.type !== 'string'}
                    defaultValue={field.length ?? ''}
                    onBlur={(event) =>
                      updateLayerField(layerId, field.name, {
                        length: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                    className="w-24 rounded border border-slate-200 px-2 py-1 disabled:bg-slate-100"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={!field.nullable}
                    onChange={(event) =>
                      updateLayerField(layerId, field.name, {
                        nullable: !event.target.checked,
                      })
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={Boolean(field.indexed)}
                    onChange={(event) =>
                      updateLayerField(layerId, field.name, {
                        indexed: event.target.checked,
                      })
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    defaultValue={field.remark || ''}
                    onBlur={(event) =>
                      updateLayerField(layerId, field.name, {
                        remark: event.target.value,
                      })
                    }
                    className="w-full rounded border border-transparent px-2 py-1 hover:border-slate-200 focus:border-slate-300"
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    className="rounded p-1 text-rose-500 hover:bg-rose-50"
                    onClick={() => {
                      if (window.confirm(`确认删除字段 "${field.name}" 吗？`)) {
                        removeLayerField(layerId, field.name);
                      }
                    }}
                    title="删除字段"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {fields.length === 0 && (
          <div className="flex h-full min-h-40 items-center justify-center text-sm text-slate-400">
            当前图层还没有字段，先新增一个字段。
          </div>
        )}
      </div>
    </div>
  );
}
