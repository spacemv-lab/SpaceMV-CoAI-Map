/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 登录页面
 * 分屏布局：左侧 3D 地球可视化，右侧登录表单
 * 支持账号密码和手机验证码两种登录方式
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LoginForm } from './LoginForm';
import { PhoneLoginForm } from './PhoneLoginForm';
import { useAuthLoading } from '../store/useAuthStore';
import { GlobeBackground } from '../components/GlobeBackground';

export default function LoginPage() {
  const [loginType, setLoginType] = useState<'password' | 'phone'>('password');
  const navigate = useNavigate();
  const location = useLocation();
  const isLoading = useAuthLoading();

  // 获取重定向目标
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  // 登录成功后跳转
  const handleLoginSuccess = () => {
    navigate(from, { replace: true });
  };

  return (
    <div
      className="login-page-wrapper min-h-screen flex relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0a1628 100%)' }}
    >
      {/* 左侧：3D 地球可视化 */}
      <div className="login-page-left hidden lg:flex lg:w-1/2 relative">
        <GlobeBackground />
        {/* 品牌叠加层 */}
        <div className="login-page-brand-overlay absolute inset-0 flex flex-col items-center justify-center z-10">
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

      {/* 右侧：登录表单 */}
      <div className="login-page-right w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-8">
        <div className="login-form-card w-full max-w-md p-6 sm:p-8 bg-[#0d2137]/60 rounded-xl border border-cyan-400/20 shadow-2xl backdrop-blur-sm">
          {/* Logo / Title（移动端显示） */}
          <div className="lg:hidden text-center mb-6">
            <h1 className="text-2xl font-bold text-white">SpaceMV CoAI Map</h1>
            <p className="text-sm text-slate-400 mt-2">产业地图智能管理平台</p>
          </div>

          {/* 登录方式切换 */}
          <div className="flex mb-6 border-b border-slate-600">
            <button
              onClick={() => setLoginType('password')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                loginType === 'password'
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              账号密码
            </button>
            <button
              onClick={() => setLoginType('phone')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                loginType === 'phone'
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              手机验证码
            </button>
          </div>

          {/* 表单区域 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
              <span className="ml-3 text-slate-400">正在验证登录状态...</span>
            </div>
          ) : loginType === 'password' ? (
            <LoginForm onSuccess={handleLoginSuccess} />
          ) : (
            <PhoneLoginForm onSuccess={handleLoginSuccess} />
          )}

          {/* 底部链接 */}
          <div className="mt-6 text-center text-sm text-slate-400">
            <span>还没有账号？</span>
            <a href="/register" className="text-cyan-400 hover:text-cyan-300 ml-1 font-medium">
              立即注册
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}