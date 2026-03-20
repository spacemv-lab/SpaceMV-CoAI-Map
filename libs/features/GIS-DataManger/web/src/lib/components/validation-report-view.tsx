/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { ValidationReport } from '../types';

interface ValidationReportViewProps {
  report: ValidationReport | null;
}

export function ValidationReportView({ report }: ValidationReportViewProps) {
  if (!report) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>暂无校验报告</p>
      </div>
    );
  }

  const {
    isValid,
    errorCount,
    warningCount,
    geometryErrors = [],
    attributeErrors = [],
    summary,
  } = report;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div
        className={`p-4 rounded-lg ${
          isValid
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}
      >
        <div className="flex items-center gap-2">
          {isValid ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-500" />
          )}
          <h3 className="font-medium">
            {isValid ? '校验通过' : '校验失败'}
          </h3>
        </div>
        {summary && <p className="text-sm mt-2 text-gray-600">{summary}</p>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-50 rounded p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{errorCount}</div>
          <div className="text-sm text-gray-600">错误</div>
        </div>
        <div className="bg-yellow-50 rounded p-3 text-center">
          <div className="text-2xl font-bold text-yellow-600">{warningCount}</div>
          <div className="text-sm text-gray-600">警告</div>
        </div>
      </div>

      {/* Geometry Errors */}
      {geometryErrors.length > 0 && (
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            几何错误
          </h4>
          <div className="space-y-2 max-h-48 overflow-auto">
            {geometryErrors.map((error, index) => (
              <div
                key={index}
                className="bg-red-50 rounded p-2 text-sm flex items-start gap-2"
              >
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-800">{error.errorType}</p>
                  <p className="text-red-600">{error.message}</p>
                  {error.featureId && (
                    <p className="text-xs text-red-500 mt-1">
                      要素 ID: {error.featureId}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attribute Errors */}
      {attributeErrors.length > 0 && (
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            属性错误
          </h4>
          <div className="space-y-2 max-h-48 overflow-auto">
            {attributeErrors.map((error, index) => (
              <div
                key={index}
                className="bg-yellow-50 rounded p-2 text-sm flex items-start gap-2"
              >
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-yellow-800">{error.errorType}</p>
                  <p className="text-yellow-600">{error.message}</p>
                  {error.field && (
                    <p className="text-xs text-yellow-500 mt-1">
                      字段：{error.field}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Issues */}
      {errorCount === 0 && warningCount === 0 && (
        <div className="text-center py-8 text-gray-400">
          <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
          <p>数据校验通过，未发现任何问题</p>
        </div>
      )}
    </div>
  );
}
