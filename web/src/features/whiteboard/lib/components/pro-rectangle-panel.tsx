/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * pro-rectangle 编辑面板：选中 pro-rectangle 时出现。
 * 可调：圆角、填充(纯色/线性渐变/径向渐变)、描边色/宽。
 * 订阅 editor 选中态/变更以重渲染；改值经 editor.updateShape 写回（实时反映 + 自动保存）。
 */
import { useEffect, useState } from 'react';
import { useWhiteboardStore } from '../store/use-whiteboard-store';
import type {
  ProRectangleShape,
  ProRectangleProps,
  ProRectangleFillType,
} from '../shapes/pro-rectangle-util';

export function ProRectanglePanel() {
  // 这些叠加层是 <Tldraw> 的兄弟节点（不在其 context 内），不能用 useEditor；
  // 从 zustand store 读 editor（handleMount 写入）。
  const editor = useWhiteboardStore((s) => s.editor);
  const [selected, setSelected] = useState<ProRectangleShape | null>(null);

  useEffect(() => {
    if (!editor) return;
    const read = () => {
      const s = editor.getOnlySelectedShape();
      setSelected(s && s.type === ('pro-rectangle' as any)
        ? (s as unknown as ProRectangleShape)
        : null);
    };
    read();
    // 选中变化 / 任何编辑都重读（props 变化要反映到滑杆）
    return editor.store.listen(read, { source: 'user', scope: 'document' });
  }, [editor]);

  const shape = selected;
  if (!editor || !shape) return null;

  const props = shape.props;
  const update = (patch: Partial<ProRectangleProps>) => {
    // editor 类型不含自定义形状，整体断言写回
    editor.updateShape({ id: shape.id, props: patch } as any);
  };
  const maxRadius = Math.min(props.w, props.h) / 2;

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-[500] w-52 bg-white/95 backdrop-blur rounded-lg shadow-lg border p-3 flex flex-col gap-3 pointer-events-auto">
      <div className="text-sm font-medium text-gray-700">矩形样式</div>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">圆角 {Math.round(props.radius)}</span>
        <input
          type="range"
          min={0}
          max={maxRadius}
          step={1}
          value={Math.min(props.radius, maxRadius)}
          onChange={(e) => update({ radius: Number(e.target.value) })}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">填充</span>
        <select
          className="border rounded px-1 py-0.5 text-sm"
          value={props.fillType}
          onChange={(e) => update({ fillType: e.target.value as ProRectangleFillType })}
        >
          <option value="solid">纯色</option>
          <option value="linear">线性渐变</option>
          <option value="radial">径向渐变</option>
        </select>
      </label>

      {props.fillType === 'solid' ? (
        <ColorRow label="颜色" value={props.fillColor} onChange={(v) => update({ fillColor: v })} />
      ) : (
        <>
          <ColorRow label="渐变起点" value={props.gradientFrom} onChange={(v) => update({ gradientFrom: v })} />
          <ColorRow label="渐变终点" value={props.gradientTo} onChange={(v) => update({ gradientTo: v })} />
          {props.fillType === 'linear' && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">角度 {Math.round(props.gradientAngle)}°</span>
              <input
                type="range"
                min={0}
                max={360}
                value={props.gradientAngle}
                onChange={(e) => update({ gradientAngle: Number(e.target.value) })}
              />
            </label>
          )}
        </>
      )}

      <div className="h-px bg-gray-200" />

      <ColorRow label="描边色" value={props.strokeColor} onChange={(v) => update({ strokeColor: v })} />
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">描边宽 {props.strokeWidth}</span>
        <input
          type="range"
          min={0}
          max={20}
          value={props.strokeWidth}
          onChange={(e) => update({ strokeWidth: Number(e.target.value) })}
        />
      </label>
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-500">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded border cursor-pointer p-0"
      />
    </label>
  );
}
