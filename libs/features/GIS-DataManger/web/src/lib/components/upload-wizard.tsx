/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React, { useState, useCallback } from 'react';
import { Button } from './ui/button';
import { X, Upload, File, CheckCircle, AlertCircle } from 'lucide-react';

interface UploadStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

interface UploadWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onUploadSuccess: () => void;
}

const initialSteps: UploadStep[] = [
  { id: 1, title: '选择文件', description: '支持 GeoJSON, Shapefile, KML, CSV, XLSX 格式', status: 'active' },
  { id: 2, title: '配置选项', description: '设置坐标系、列映射等', status: 'pending' },
  { id: 3, title: '校验数据', description: '检查数据有效性', status: 'pending' },
  { id: 4, title: '上传解析', description: '上传并解析数据', status: 'pending' },
];

export function UploadWizard({ open, onOpenChange, projectId, onUploadSuccess }: UploadWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [steps, setSteps] = useState<UploadStep[]>(initialSteps);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [crs, setCrs] = useState('EPSG:4326');
  const [validateGeometry, setValidateGeometry] = useState(true);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const allowedExtensions = ['geojson', 'json', 'zip', 'kml', 'kmz', 'csv', 'xls', 'xlsx'];
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext && allowedExtensions.includes(ext)) {
        setSelectedFile(file);
      } else {
        alert('不支持的文件格式');
      }
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
    }
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep < 4) {
      setSteps((prev) =>
        prev.map((step) => ({
          ...step,
          status:
            step.id === currentStep
              ? 'completed'
              : step.id === currentStep + 1
              ? 'active'
              : step.status,
        }))
      );
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setSteps((prev) =>
        prev.map((step) => ({
          ...step,
          status:
            step.id === currentStep
              ? 'pending'
              : step.id === currentStep - 1
              ? 'active'
              : step.status,
        }))
      );
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setUploading(true);
    setSteps((prev) =>
      prev.map((step) =>
        step.id === 4 ? { ...step, status: 'active' } : step
      )
    );

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('projectId', projectId);
      formData.append('targetCRS', crs);

      const response = await fetch('/api/datasets/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();

      // Simulate progress
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 10;
        });
      }, 200);

      setTimeout(() => {
        setSteps((prev) =>
          prev.map((step) =>
            step.id === 4 ? { ...step, status: 'completed' } : step
          )
        );
        setUploading(false);
        onUploadSuccess();
        onOpenChange(false);
      }, 2000);
    } catch (error) {
      setSteps((prev) =>
        prev.map((step) =>
          step.id === 4 ? { ...step, status: 'error' } : step
        )
      );
      setUploading(false);
    }
  }, [selectedFile, projectId, crs, onUploadSuccess, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">数据上传向导</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    step.status === 'completed'
                      ? 'bg-green-500 text-white'
                      : step.status === 'active'
                      ? 'bg-blue-500 text-white'
                      : step.status === 'error'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step.status === 'completed' ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : step.status === 'error' ? (
                    <AlertCircle className="h-5 w-5" />
                  ) : (
                    step.id
                  )}
                </div>
                <span className="text-xs mt-1 text-gray-600">{step.title}</span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    step.status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[300px]">
          {currentStep === 1 && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center ${
                dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-2">拖拽文件到此处，或点击选择文件</p>
              <p className="text-sm text-gray-400">
                支持格式：GeoJSON, Shapefile (.zip), KML, CSV, XLSX
              </p>
              <input
                type="file"
                id="file-select"
                className="hidden"
                accept=".geojson,.json,.zip,.kml,.kmz,.csv,.xls,.xlsx"
                onChange={handleFileSelect}
              />
              <Button
                onClick={() => document.getElementById('file-select')?.click()}
                className="mt-4"
              >
                选择文件
              </Button>
              {selectedFile && (
                <div className="mt-4 flex items-center justify-center text-sm text-gray-600">
                  <File className="h-4 w-4 mr-2" />
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                </div>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  目标坐标系 (CRS)
                </label>
                <select
                  value={crs}
                  onChange={(e) => setCrs(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="EPSG:4326">WGS 84 (EPSG:4326)</option>
                  <option value="EPSG:3857">Web Mercator (EPSG:3857)</option>
                  <option value="EPSG:4490">CGCS2000 (EPSG:4490)</option>
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="validate"
                  checked={validateGeometry}
                  onChange={(e) => setValidateGeometry(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="validate" className="text-sm text-gray-700">
                  上传时验证几何有效性
                </label>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="text-center py-8">
              <p className="text-gray-600">
                {selectedFile ? `将验证文件：${selectedFile.name}` : '请先选择文件'}
              </p>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg text-left">
                <h4 className="font-medium mb-2">校验项:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 几何有效性检查 (ST_IsValid)</li>
                  <li>• 坐标范围验证</li>
                  <li>• 属性完整性检查</li>
                </ul>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="text-center py-8">
              {uploading ? (
                <>
                  <p className="text-gray-600 mb-4">正在上传并解析数据...</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500">{uploadProgress}%</p>
                </>
              ) : (
                <p className="text-gray-600">准备上传</p>
              )}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-between mt-6">
          {currentStep > 1 ? (
            <Button variant="outline" onClick={handleBack} disabled={uploading}>
              上一步
            </Button>
          ) : (
            <div />
          )}

          {currentStep < 4 ? (
            <Button
              onClick={handleNext}
              disabled={currentStep === 1 && !selectedFile}
            >
              下一步
            </Button>
          ) : (
            <Button
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
            >
              {uploading ? '上传中...' : '开始上传'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
