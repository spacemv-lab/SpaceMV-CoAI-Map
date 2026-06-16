/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 注册页面
 * 分屏布局：左侧 3D 地球可视化，右侧注册表单
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RegisterForm } from './RegisterForm';
import { useAuthLoading } from '../store/useAuthStore';
import { GlobeBackground } from '../components/GlobeBackground';

export default function RegisterPage() {
  const navigate = useNavigate();
  const isLoading = useAuthLoading();

  // 注册成功后跳转到登录页
  const handleRegisterSuccess = () => {
    navigate('/login', { replace: true });
  };

  return (
    <div
      className="register-page-wrapper min-h-screen flex relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0a1628 100%)' }}
    >
      {/* 左侧：3D 地球可视化 */}
      <div className="register-page-left hidden lg:flex lg:w-1/2 relative">
        <GlobeBackground />
        {/* 品牌叠加层 */}
        <div className="register-page-brand-overlay absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="text-center px-8">
            <h1 className="text-5xl font-bold text-white tracking-wide mb-4">
              SpaceMV
            </h1>
            <p className="text-xl text-cyan-400 font-medium mb-2">
              CoAI Map
            </p>
            <p className="text-slate-400 text-base max-w-md">
              产业地图智能管理平台 — 空间数据可视化与分析
            </p>
          </div>
        </div>
      </div>

      {/* 右侧：注册表单 */}
      <div className="register-page-right w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-8">
        <div className="w-full max-w-md p-6 sm:p-8 bg-[#0d2137]/60 rounded-xl border border-cyan-400/20 shadow-2xl backdrop-blur-sm">
          {/* Logo / Title（移动端显示） */}
          <div className="lg:hidden text-center mb-6">
            <h1 className="text-2xl font-bold text-white">SpaceMV CoAI Map</h1>
            <p className="text-sm text-slate-400 mt-2">用户注册</p>
          </div>

          {/* 表单区域 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
              <span className="ml-3 text-slate-400">正在加载...</span>
            </div>
          ) : (
            <RegisterForm onSuccess={handleRegisterSuccess} />
          )}

          {/* 底部链接 */}
          <div className="mt-6 text-center text-sm text-slate-400">
            <span>已有账号？</span>
            <a href="/login" className="text-cyan-400 hover:text-cyan-300 ml-1 font-medium">
              立即登录
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}