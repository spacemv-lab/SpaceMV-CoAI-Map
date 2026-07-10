/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 属性值按字段类型渲染（image→缩略图 / url→链接 / date→格式化 / 其他→文本）。
 * 仅展示，不含编辑交互；image 的 objectKey 经下载代理 endpoint 取图。
 */
import { AttributeFieldType } from '../types/map-state';

/** 把 MinIO objectKey 拼成下载代理 URL（后端 GET /datasets/:id/images?key=） */
export function buildImageUrl(datasetId: string, objectKey: string): string {
  return `/api/datasets/${datasetId}/images?key=${encodeURIComponent(objectKey)}`;
}

interface PropertyValueRendererProps {
  value: unknown;
  type: AttributeFieldType;
  datasetId: string;
  /** 图片缩略图尺寸类，默认 h-6 w-6 */
  imgClassName?: string;
}

export function PropertyValueRenderer({
  value,
  type,
  datasetId,
  imgClassName,
}: PropertyValueRendererProps) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-300">-</span>;
  }

  if (type === 'image') {
    const src = buildImageUrl(datasetId, String(value));
    return (
      <a href={src} target="_blank" rel="noopener noreferrer">
        <img
          src={src}
          alt=""
          loading="lazy"
          className={imgClassName ?? 'h-6 w-6 object-cover rounded'}
        />
      </a>
    );
  }

  if (type === 'url') {
    const href = String(value);
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline truncate"
      >
        {href}
      </a>
    );
  }

  if (type === 'date') {
    const d = new Date(value as string);
    return <span>{isNaN(d.getTime()) ? String(value) : d.toLocaleDateString()}</span>;
  }

  if (typeof value === 'object') {
    return <span>{JSON.stringify(value)}</span>;
  }

  return <span>{String(value)}</span>;
}
