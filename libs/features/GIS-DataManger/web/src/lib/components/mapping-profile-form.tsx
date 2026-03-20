/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Plus, Trash2, Save } from 'lucide-react';

interface MappingItem {
  sourceColumn: string;
  targetField: string;
  mappingType: 'DIRECT' | 'EXPRESSION' | 'LOOKUP' | 'CUSTOM';
  expression?: string;
  defaultValue?: string;
}

interface MappingProfileFormProps {
  datasetId: string;
  sourceColumns?: string[];
  onSave: (profile: MappingProfileData) => void;
  onCancel: () => void;
  initialData?: MappingProfileData;
}

export interface MappingProfileData {
  name: string;
  description?: string;
  sourceType: string;
  crs?: string;
  geometryColumn?: string;
  mappings: MappingItem[];
}

export function MappingProfileForm({
  datasetId,
  sourceColumns = [],
  onSave,
  onCancel,
  initialData,
}: MappingProfileFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [sourceType, setSourceType] = useState(initialData?.sourceType || 'CSV');
  const [crs, setCrs] = useState(initialData?.crs || 'EPSG:4326');
  const [geometryColumn, setGeometryColumn] = useState(initialData?.geometryColumn || '');
  const [mappings, setMappings] = useState<MappingItem[]>(
    initialData?.mappings || []
  );

  const targetFields = ['name', 'type', 'value', 'category', 'geometry'];

  const addMapping = () => {
    setMappings([
      ...mappings,
      {
        sourceColumn: '',
        targetField: '',
        mappingType: 'DIRECT',
      },
    ]);
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, field: keyof MappingItem, value: any) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setMappings(newMappings);
  };

  const handleSave = () => {
    onSave({
      name,
      description,
      sourceType,
      crs,
      geometryColumn,
      mappings,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <h3 className="text-lg font-semibold">映射配置</h3>

      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">配置名称</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入配置名称"
          />
        </div>
        <div>
          <Label htmlFor="sourceType">源数据类型</Label>
          <select
            id="sourceType"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="CSV">CSV</option>
            <option value="XLSX">Excel (.xlsx)</option>
            <option value="XLS">Excel (.xls)</option>
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="description">描述</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="输入描述信息"
        />
      </div>

      {/* CRS Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="crs">坐标系</Label>
          <select
            id="crs"
            value={crs}
            onChange={(e) => setCrs(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="EPSG:4326">WGS 84 (EPSG:4326)</option>
            <option value="EPSG:3857">Web Mercator (EPSG:3857)</option>
            <option value="EPSG:4490">CGCS2000 (EPSG:4490)</option>
          </select>
        </div>
        <div>
          <Label htmlFor="geometryColumn">几何列</Label>
          <Input
            id="geometryColumn"
            value={geometryColumn}
            onChange={(e) => setGeometryColumn(e.target.value)}
            placeholder="WKT 或 GeoJSON 列名"
          />
        </div>
      </div>

      {/* Column Mappings */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>列映射</Label>
          <Button variant="outline" size="sm" onClick={addMapping}>
            <Plus className="h-4 w-4 mr-1" />
            添加映射
          </Button>
        </div>

        <div className="space-y-2 max-h-64 overflow-auto">
          {mappings.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              暂无映射配置，点击"添加映射"开始配置
            </p>
          ) : (
            mappings.map((mapping, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <select
                  value={mapping.sourceColumn}
                  onChange={(e) =>
                    updateMapping(index, 'sourceColumn', e.target.value)
                  }
                  className="flex-1 border rounded px-2 py-1 text-sm"
                  title="源列"
                >
                  <option value="">选择源列</option>
                  {sourceColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>

                <span className="text-gray-400">→</span>

                <select
                  value={mapping.targetField}
                  onChange={(e) =>
                    updateMapping(index, 'targetField', e.target.value)
                  }
                  className="flex-1 border rounded px-2 py-1 text-sm"
                  title="目标字段"
                >
                  <option value="">选择目标字段</option>
                  {targetFields.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </select>

                <select
                  value={mapping.mappingType}
                  onChange={(e) =>
                    updateMapping(
                      index,
                      'mappingType',
                      e.target.value as MappingItem['mappingType']
                    )
                  }
                  className="w-24 border rounded px-2 py-1 text-sm"
                  title="映射类型"
                >
                  <option value="DIRECT">直接</option>
                  <option value="EXPRESSION">表达式</option>
                  <option value="LOOKUP">查找</option>
                  <option value="CUSTOM">自定义</option>
                </select>

                <button
                  onClick={() => removeMapping(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          保存配置
        </Button>
      </div>
    </div>
  );
}
