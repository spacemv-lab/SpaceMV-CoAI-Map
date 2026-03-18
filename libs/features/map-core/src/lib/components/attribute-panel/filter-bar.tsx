/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


/**
 * 过滤栏组件
 * 支持属性查询和过滤
 */

import { useMapStore } from '../../store/use-map-store';
import { Filter, X, Plus, Trash2 } from 'lucide-react';
import { useState, useMemo } from 'react';

interface FilterCondition {
  id: string;
  field: string;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'in';
  value: string;
}

interface FilterBarProps {
  layerId: string;
  onFilterChange?: (filter: (feature: any) => boolean) => void;
}

export function FilterBar({ layerId, onFilterChange }: FilterBarProps) {
  const layers = useMapStore((state) => state.layers);
  const layer = layers.find((l) => l.id === layerId);

  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [logicOperator, setLogicOperator] = useState<'and' | 'or'>('and');

  // 获取所有字段名
  const allFields = useMemo(() => {
    if (!layer?.data?.features?.length) return [];
    const firstFeature = layer.data.features[0];
    return Object.keys(firstFeature.properties || {});
  }, [layer]);

  // 添加条件
  const handleAddCondition = () => {
    const newCondition: FilterCondition = {
      id: crypto.randomUUID(),
      field: allFields[0] || '',
      operator: 'equals',
      value: '',
    };
    setConditions([...conditions, newCondition]);
  };

  // 删除条件
  const handleRemoveCondition = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id));
  };

  // 更新条件
  const handleUpdateCondition = (id: string, updates: Partial<FilterCondition>) => {
    setConditions(
      conditions.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  // 应用过滤
  const applyFilter = () => {
    if (conditions.length === 0) {
      onFilterChange?.(() => true);
      return;
    }

    const filterFn = (feature: any) => {
      const props = feature.properties || {};

      const results = conditions.map((condition) => {
        const propValue = props[condition.field];
        const compareValue = condition.value;

        switch (condition.operator) {
          case 'equals':
            return String(propValue) === compareValue;
          case 'contains':
            return String(propValue).includes(compareValue);
          case 'greater':
            return Number(propValue) > Number(compareValue);
          case 'less':
            return Number(propValue) < Number(compareValue);
          case 'in':
            return compareValue.split(',').map((v) => v.trim()).includes(String(propValue));
          default:
            return true;
        }
      });

      if (logicOperator === 'and') {
        return results.every((r) => r);
      } else {
        return results.some((r) => r);
      }
    };

    onFilterChange?.(filterFn);
  };

  // 清除过滤
  const handleClearFilter = () => {
    setConditions([]);
    onFilterChange?.(() => true);
  };

  return (
    <div className="p-3 border-b bg-gray-50 space-y-2">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Filter className="w-4 h-4" />
          <span>要素过滤</span>
        </div>
        {conditions.length > 0 && (
          <button
            onClick={handleClearFilter}
            className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
          >
            <X className="w-3 h-3" /> 清除过滤
          </button>
        )}
      </div>

      {/* 条件列表 */}
      <div className="space-y-2">
        {conditions.map((condition, index) => (
          <div key={condition.id} className="flex items-center gap-2">
            {/* 逻辑运算符 */}
            {index > 0 && (
              <select
                value={logicOperator}
                onChange={(e) => setLogicOperator(e.target.value as 'and' | 'or')}
                className="px-1 py-1 border rounded text-xs bg-white focus:outline-none"
              >
                <option value="and">且</option>
                <option value="or">或</option>
              </select>
            )}

            {/* 字段选择 */}
            <select
              value={condition.field}
              onChange={(e) => handleUpdateCondition(condition.id, { field: e.target.value })}
              className="flex-1 px-2 py-1 border rounded text-xs bg-white focus:outline-none max-w-[150px]"
            >
              {allFields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>

            {/* 运算符选择 */}
            <select
              value={condition.operator}
              onChange={(e) =>
                handleUpdateCondition(condition.id, { operator: e.target.value as FilterCondition['operator'] })
              }
              className="px-2 py-1 border rounded text-xs bg-white focus:outline-none"
            >
              <option value="equals">等于</option>
              <option value="contains">包含</option>
              <option value="greater">大于</option>
              <option value="less">小于</option>
              <option value="in">属于</option>
            </select>

            {/* 值输入 */}
            <input
              type="text"
              value={condition.value}
              onChange={(e) => handleUpdateCondition(condition.id, { value: e.target.value })}
              placeholder="输入值"
              className="flex-1 px-2 py-1 border rounded text-xs focus:border-blue-500 focus:outline-none min-w-[100px]"
            />

            {/* 删除按钮 */}
            <button
              onClick={() => handleRemoveCondition(condition.id)}
              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* 添加条件按钮 */}
      <button
        onClick={handleAddCondition}
        className="flex items-center gap-1 px-3 py-1.5 text-xs border-2 border-dashed border-gray-300 rounded text-gray-500 hover:border-blue-400 hover:text-blue-600 w-full justify-center"
      >
        <Plus className="w-3 h-3" /> 添加条件
      </button>

      {/* 应用按钮 */}
      {conditions.length > 0 && (
        <button
          onClick={applyFilter}
          className="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          应用过滤
        </button>
      )}
    </div>
  );
}
