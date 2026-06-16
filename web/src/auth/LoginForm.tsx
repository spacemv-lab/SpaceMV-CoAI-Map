/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 账号密码登录表单
 */

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuthStore } from '../store/useAuthStore';
import { getCaptcha, checkUnique } from '../lib/api/auth-api';

interface LoginFormProps {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaUuid, setCaptchaUuid] = useState('');
  const [captchaImg, setCaptchaImg] = useState('');
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [userExists, setUserExists] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 使用 ref 防止 StrictMode 下的重复提交
  const submittingRef = useRef(false);

  const { loginWithPassword, error, setError } = useAuthStore();

  // 获取图形验证码
  const fetchCaptcha = async () => {
    try {
      const res = await getCaptcha();
      setCaptchaImg(res.img);
      setCaptchaUuid(res.uuid);
      setCaptchaEnabled(res.captchaEnabled);
    } catch {
      // 验证码获取失败，可能不需要验证码
      setCaptchaEnabled(false);
    }
  };

  // 初始化获取验证码
  useEffect(() => {
    fetchCaptcha();
  }, []);

  // 检查用户是否存在
  const checkUserExists = async (value: string) => {
    if (!value.trim()) {
      setUserExists(null);
      return;
    }

    try {
      const exists = await checkUnique({
        fieldType: 'username',
        fieldValue: value.trim(),
        productLine: 'spacemv-coai-map',
      });
      setUserExists(exists);
    } catch {
      setUserExists(null);
    }
  };

  // 用户名输入变化
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    // 延迟检查用户是否存在
    setTimeout(() => checkUserExists(value), 300);
  };

  // 提交登录
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 防止重复提交
    if (submittingRef.current) {
      return;
    }
    submittingRef.current = true;

    setError(null);

    // 验证输入
    if (!username.trim()) {
      toast.error('请输入账号');
      submittingRef.current = false;
      return;
    }
    if (!password.trim()) {
      toast.error('请输入密码');
      submittingRef.current = false;
      return;
    }
    if (captchaEnabled && !captchaCode.trim()) {
      toast.error('请输入验证码');
      submittingRef.current = false;
      return;
    }

    // 检查用户是否存在
    if (userExists === false) {
      toast.error('用户不存在，请先注册');
      submittingRef.current = false;
      return;
    }

    setIsSubmitting(true);

    try {
      // login 接口已集成人机验证，无需单独调用 checkHuman
      await loginWithPassword(
        username.trim(),
        password,
        captchaEnabled ? captchaCode : undefined,
        captchaEnabled ? captchaUuid : undefined
      );
      toast.success('登录成功');
      onSuccess();
    } catch {
      if (captchaEnabled) {
        fetchCaptcha();
      }
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 错误提示 */}
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* 用户名 */}
      <div className="space-y-2">
        <Label htmlFor="username" className="text-slate-300">
          账号
        </Label>
        <Input
          id="username"
          type="text"
          value={username}
          onChange={handleUsernameChange}
          placeholder="手机号/邮箱/用户名"
          className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
        />
        {userExists === false && (
          <p className="text-sm text-amber-400">用户不存在，请先注册</p>
        )}
      </div>

      {/* 密码 */}
      <div className="space-y-2">
        <Label htmlFor="password" className="text-slate-300">
          密码
        </Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="请输入密码"
          className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
        />
      </div>

      {/* 图形验证码 */}
      {captchaEnabled && (
        <div className="space-y-2">
          <Label htmlFor="captcha" className="text-slate-300">
            验证码
          </Label>
          <div className="flex gap-2">
            <Input
              id="captcha"
              type="text"
              value={captchaCode}
              onChange={(e) => setCaptchaCode(e.target.value)}
              placeholder="请输入验证码"
              className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 flex-1"
              maxLength={4}
            />
            <div
              className="h-10 w-24 rounded border border-slate-600 cursor-pointer flex items-center justify-center bg-slate-700/50"
              onClick={fetchCaptcha}
              title="点击刷新验证码"
            >
              {captchaImg ? (
                <img src={`data:image/jpeg;base64,${captchaImg}`} alt="验证码" className="h-full w-full object-contain" />
              ) : (
                <span className="text-slate-400 text-xs">加载中...</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 提交按钮 */}
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
      >
        {isSubmitting ? '登录中...' : '登录'}
      </Button>

      {/* 忘记密码链接 */}
      <div className="text-center text-sm">
        <a href="/forgetPassword" className="text-slate-400 hover:text-cyan-400">
          忘记密码？
        </a>
      </div>
    </form>
  );
}