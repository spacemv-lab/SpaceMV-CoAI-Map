/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * TableColumnPicker — 上传表格（csv/xls/xlsx）时的列指认面板。
 * 客户端解析文件头 → 让用户选 sheet / 表头行 / 经纬度列 / wkt 列。
 * 输出字段对齐后端 TableAdapter.parse 的 options（→ /datasets/upload FormData）。
 */
import { useEffect, useRef, useState } from 'react';
import Papa from 'papaparse';

export interface TableConfig {
  sheet?: string;
  headerRow?: number;
  latColumn?: string;
  lonColumn?: string;
  geometryColumn?: string;
  wktColumn?: string;
}

interface TableColumnPickerProps {
  file: File;
  onChange: (config: TableConfig) => void;
}

const LAT_CANDIDATES = ['lat', 'latitude', 'y', '纬度', '维度', 'latitud'];
const LON_CANDIDATES = ['lon', 'lng', 'longitude', 'x', '经度', 'longitud'];

function detectColumn(columns: string[], candidates: string[]): string | undefined {
  for (const c of candidates) {
    const m = columns.find((col) => col.toLowerCase() === c.toLowerCase());
    if (m) return m;
  }
  return undefined;
}

function isExcel(file: File): boolean {
  const n = file.name.toLowerCase();
  return n.endsWith('.xls') || n.endsWith('.xlsx');
}

/**
 * 乱码特征检测（GBK 被当 UTF-8 解的典型）：U+FFFD 替换字符 / C1 控制区(0x80-0x9F) /
 * 孤立的 ï(0xEF) / Â(0xC2)。用 charCodeAt 纯数字判断，避免源码里写 unicode 字面。
 */
function looksLikeGarbledUtf8(text: string): boolean {
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (
      code === 0xfffd ||
      (code >= 0x80 && code <= 0x9f) ||
      code === 0xef ||
      code === 0xc2
    ) {
      return true;
    }
  }
  return false;
}

export function TableColumnPicker({ file, onChange }: TableColumnPickerProps) {
  const [sheets, setSheets] = useState<string[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [sheet, setSheet] = useState<string>('');
  const [headerRow, setHeaderRow] = useState<number>(1);
  const [latColumn, setLatColumn] = useState<string>('');
  const [lonColumn, setLonColumn] = useState<string>('');
  const [wktColumn, setWktColumn] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // 用 ref 持有 onChange，避免父组件函数引用不稳定导致 effect 循环
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // 解析文件头（响应 file / headerRow / sheet 变化）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        if (isExcel(file)) {
          const XLSX = await import('xlsx');
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf, { type: 'array' });
          if (cancelled) return;
          const names = (wb.SheetNames as string[]) || [];
          setSheets(names);
          const current = sheet && names.includes(sheet) ? sheet : names[0] ?? '';
          if (current !== sheet) setSheet(current);
          const ws = wb.Sheets[current];
          // 取全部行（header:1 → 数组的数组，0-based）；按 headerRow 取对应行作表头。
          // 不用 range 数字（SheetJS range 起始行语义易混淆），rows[headerRow-1] 与 CSV 统一。
          const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
          const cols = ((rows[headerRow - 1] as any[]) || []).map((c) =>
            String(c ?? '').trim(),
          );
          setColumns(cols);
        } else {
          setSheets([]);
          // CSV：只读头部 64KB（够前几十行；大文件避免全量入内存）
          const bytes = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
          let text: string;
          if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
            text = new TextDecoder('utf-8').decode(bytes);
          } else {
            text = new TextDecoder('utf-8').decode(bytes);
            if (looksLikeGarbledUtf8(text)) {
              text = new TextDecoder('gbk').decode(bytes);
            }
          }
          const result = Papa.parse<any[]>(text, {
            header: false,
            skipEmptyLines: true,
            preview: Math.max(20, headerRow + 5),
          });
          if (cancelled) return;
          const rows = result.data || [];
          const idx = headerRow - 1;
          const cols = (rows[idx] || []).map((c: any) => String(c ?? '').trim());
          setColumns(cols);
        }
      } catch (e: any) {
        setError(e?.message ?? '解析表头失败');
        setColumns([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, headerRow, sheet]);

  // 列名变化时自动嗅探 lat/lon（用户未手选则用嗅探结果）
  useEffect(() => {
    const detectedLat = detectColumn(columns, LAT_CANDIDATES);
    const detectedLon = detectColumn(columns, LON_CANDIDATES);
    setLatColumn((prev) => (prev && columns.includes(prev) ? prev : detectedLat ?? ''));
    setLonColumn((prev) => (prev && columns.includes(prev) ? prev : detectedLon ?? ''));
  }, [columns]);

  // 通知父组件
  useEffect(() => {
    onChangeRef.current({
      sheet: sheets.length > 0 ? sheet || undefined : undefined,
      headerRow,
      latColumn: latColumn || undefined,
      lonColumn: lonColumn || undefined,
      wktColumn: wktColumn || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, headerRow, latColumn, lonColumn, wktColumn, sheets]);

  const renderColumnOptions = () => (
    <>
      <option value="">（不指定）</option>
      {columns.map((c, i) => (
        <option key={`${c}-${i}`} value={c}>
          {c || `（空列名 ${i}）`}
        </option>
      ))}
    </>
  );

  return (
    <div className="mt-2 rounded border border-blue-200 bg-blue-50/40 p-3 space-y-2 text-xs">
      <div className="font-medium text-blue-900">
        表格列指认（识别为 {isExcel(file) ? 'Excel' : 'CSV'}）
      </div>
      {error && <div className="text-red-500">{error}</div>}
      <div className="grid grid-cols-2 gap-2">
        {sheets.length > 1 && (
          <label className="flex flex-col gap-1">
            <span className="text-gray-500">工作表</span>
            <select
              value={sheet}
              onChange={(e) => setSheet(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1"
            >
              {sheets.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-gray-500">表头行（第几行是列名）</span>
          <input
            type="number"
            min={1}
            value={headerRow}
            onChange={(e) => setHeaderRow(Math.max(1, Number(e.target.value) || 1))}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-gray-500">纬度列（lat）</span>
          <select
            value={latColumn}
            onChange={(e) => setLatColumn(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          >
            {renderColumnOptions()}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-gray-500">经度列（lon）</span>
          <select
            value={lonColumn}
            onChange={(e) => setLonColumn(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          >
            {renderColumnOptions()}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-gray-500">WKT 列（可选）</span>
          <select
            value={wktColumn}
            onChange={(e) => setWktColumn(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          >
            {renderColumnOptions()}
          </select>
        </label>
      </div>
      <p className="text-gray-400">
        解析到 {columns.length} 列
        {columns.filter(Boolean).length > 0
          ? `：${columns.filter(Boolean).slice(0, 6).join('、')}${columns.filter(Boolean).length > 6 ? ' …' : ''}`
          : ''}
        。列名不规范时手动选纬度/经度列。
      </p>
    </div>
  );
}
