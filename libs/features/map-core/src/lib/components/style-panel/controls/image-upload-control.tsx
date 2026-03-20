/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Upload, X, Image } from 'lucide-react';
import { useRef, useState } from 'react';

interface ImageUploadControlProps {
  value?: string;
  onChange: (uri: string) => void;
}

export function ImageUploadControl({ value, onChange }: ImageUploadControlProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 检查文件大小（限制 5MB）
      if (file.size > 5 * 1024 * 1024) {
        alert('图片大小不能超过 5MB');
        return;
      }

      // 检查文件类型
      if (!file.type.startsWith('image/')) {
        alert('请上传图片文件');
        return;
      }

      setIsUploading(true);

      const reader = new FileReader();
      reader.onload = (event) => {
        onChange(event.target?.result as string);
        setIsUploading(false);
      };
      reader.onerror = () => {
        alert('图片读取失败');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
    // 重置 input 值，允许重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClear = () => {
    onChange('');
  };

  return (
    <div>
      <label className="text-sm text-gray-600 block mb-2">自定义图标</label>
      <div className="flex items-center gap-3">
        {/* 预览 */}
        {value && (
          <div className="w-10 h-10 rounded border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
            <img src={value} alt="Preview" className="w-full h-full object-contain" />
          </div>
        )}

        {/* 上传按钮 */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 border rounded text-sm transition-all ${
            isUploading
              ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300'
          }`}
        >
          <Upload className="w-4 h-4" />
          {isUploading ? '上传中...' : value ? '更换图片' : '上传图片'}
        </button>

        {/* 清除按钮 */}
        {value && (
          <button
            onClick={handleClear}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            title="移除图片"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={isUploading}
        className="hidden"
      />

      {/* 提示信息 */}
      {!value && (
        <p className="text-xs text-gray-400 mt-2">
          <Image className="w-3 h-3 inline mr-1" />
          支持 PNG、JPG、SVG 格式，最大 5MB
        </p>
      )}
    </div>
  );
}
