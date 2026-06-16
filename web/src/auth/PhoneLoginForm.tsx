/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 手机验证码登录表单
 */

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuthStore } from '../store/useAuthStore';
import { getCaptcha, checkHuman, checkUnique, sendVerifyCode } from '../lib/api/auth-api';

interface PhoneLoginFormProps {
  onSuccess: () => void;
}

export function PhoneLoginForm({ onSuccess }: PhoneLoginFormProps) {
  const [phone, setPhone] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaUuid, setCaptchaUuid] = useState('');
  const [captchaImg, setCaptchaImg] = useState('');
  const [showCaptchaDialog, setShowCaptchaDialog] = useState(false);
  const [userExists, setUserExists] = useState<boolean | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const countdownRef = useRef<number | null>(null);

  const { loginWithSms, error, setError } = useAuthStore();

  // 清理倒计时
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // 手机号格式验证
  const isValidPhone = (value: string) => {
    return /^1[3-9]\d{9}$/.test(value);
  };

  // 检查用户是否存在
  const checkUserExists = async (value: string) => {
    if (!value.trim() || !isValidPhone(value)) {
      setUserExists(null);
      return;
    }

    try {
      const exists = await checkUnique({
        fieldType: 'phone',
        fieldValue: value.trim(),
        productLine: 'spacemv-coai-map',
      });
      setUserExists(exists);
    } catch {
      setUserExists(null);
    }
  };

  // 手机号输入变化
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // 只保留数字
    setPhone(value);
    if (value.length === 11 && isValidPhone(value)) {
      checkUserExists(value);
    } else {
      setUserExists(null);
    }
  };

  // 获取图形验证码
  const fetchCaptcha = async () => {
    try {
      const res = await getCaptcha();
      setCaptchaImg(res.img);
      setCaptchaUuid(res.uuid);
    } catch {
      toast.error('获取验证码失败');
    }
  };

  // 打开人机验证弹窗
  const handleSendCodeClick = async () => {
    setError(null);

    if (!phone.trim()) {
      toast.error('请输入手机号');
      return;
    }

    if (!isValidPhone(phone)) {
      toast.error('请输入正确的手机号');
      return;
    }

    if (userExists === false) {
      toast.error('用户不存在，请先注册');
      return;
    }

    if (countdown > 0) {
      toast.info('请等待倒计时结束');
      return;
    }

    // 显示人机验证弹窗
    await fetchCaptcha();
    setShowCaptchaDialog(true);
    setCaptchaCode('');
  };

  // 人机验证通过后发送短信
  const handleCaptchaVerify = async () => {
    if (!captchaCode.trim()) {
      toast.error('请输入图形验证码');
      return;
    }

    try {
      const valid = await checkHuman({ uuid: captchaUuid, code: captchaCode });
      if (!valid) {
        toast.error('验证码错误');
        fetchCaptcha();
        return;
      }

      // 发送短信验证码
      await sendVerifyCode({
        channelAccount: phone,
        channelType: 'phone',
        verifyType: 'login',
      });

      toast.success('验证码已发送');
      setShowCaptchaDialog(false);

      // 开始 60 秒倒计时
      setCountdown(60);
      countdownRef.current = window.setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            countdownRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '发送验证码失败');
      fetchCaptcha();
    }
  };

  // 提交登录
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!phone.trim()) {
      toast.error('请输入手机号');
      return;
    }

    if (!isValidPhone(phone)) {
      toast.error('请输入正确的手机号');
      return;
    }

    if (!verifyCode.trim()) {
      toast.error('请输入验证码');
      return;
    }

    if (verifyCode.length !== 6) {
      toast.error('验证码为 6 位数字');
      return;
    }

    setIsSubmitting(true);

    try {
      await loginWithSms(phone, verifyCode);
      toast.success('登录成功');
      onSuccess();
    } catch {
      // 错误已在 store 中设置
    } finally {
      setIsSubmitting(false);
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

      {/* 手机号 */}
      <div className="space-y-2">
        <Label htmlFor="phone" className="text-slate-300">
          手机号
        </Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={handlePhoneChange}
          placeholder="请输入手机号"
          className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
          maxLength={11}
        />
        {userExists === false && (
          <p className="text-sm text-amber-400">用户不存在，请先注册</p>
        )}
      </div>

      {/* 验证码 */}
      <div className="space-y-2">
        <Label htmlFor="verifyCode" className="text-slate-300">
          验证码
        </Label>
        <div className="flex gap-2">
          <Input
            id="verifyCode"
            type="text"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="请输入 6 位验证码"
            className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 flex-1"
            maxLength={6}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleSendCodeClick}
            disabled={countdown > 0 || !isValidPhone(phone)}
            className="w-24 border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            {countdown > 0 ? `${countdown}秒` : '获取验证码'}
          </Button>
        </div>
      </div>

      {/* 提交按钮 */}
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
      >
        {isSubmitting ? '登录中...' : '登录'}
      </Button>

      {/* 人机验证弹窗 */}
      {showCaptchaDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-600 w-72">
            <h3 className="text-white font-medium mb-4">安全验证</h3>
            <div className="space-y-3">
              <div
                className="h-10 w-full rounded border border-slate-600 cursor-pointer flex items-center justify-center bg-slate-700/50"
                onClick={fetchCaptcha}
                title="点击刷新验证码"
              >
                {captchaImg ? (
                  <img src={`data:image/jpeg;base64,${captchaImg}`} alt="验证码" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-slate-400 text-xs">加载中...</span>
                )}
              </div>
              <Input
                type="text"
                value={captchaCode}
                onChange={(e) => setCaptchaCode(e.target.value)}
                placeholder="请输入验证码"
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                maxLength={4}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCaptchaDialog(false)}
                  className="flex-1 border-slate-600 text-slate-300"
                >
                  取消
                </Button>
                <Button
                  type="button"
                  onClick={handleCaptchaVerify}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  确认
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}