/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 注册表单
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { getCaptcha, checkHuman, checkUnique, checkWhitelist, sendVerifyCode } from '../lib/api/auth-api';
import { encryptPassword } from '../lib/auth/rsa';

interface RegisterFormProps {
  onSuccess: () => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [contact, setContact] = useState('');
  const [contactType, setContactType] = useState<'phone' | 'email'>('phone');
  const [verifyCode, setVerifyCode] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaUuid, setCaptchaUuid] = useState('');
  const [captchaImg, setCaptchaImg] = useState('');
  const [showCaptchaDialog, setShowCaptchaDialog] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [usernameExists, setUsernameExists] = useState(false);
  const [contactExists, setContactExists] = useState(false);
  const [whitelistAllowed, setWhitelistAllowed] = useState<boolean | null>(null); // null=未检查
  const [whitelistMessage, setWhitelistMessage] = useState<string>('');
  const [showBackupContact, setShowBackupContact] = useState(false);
  const [backupContact, setBackupContact] = useState('');

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

  useEffect(() => {
    fetchCaptcha();
  }, []);

  // 验证用户名
  const validateUsername = (value: string) => {
    if (!value.trim()) {
      return '请输入用户名';
    }
    if (value.length > 20) {
      return '用户名最长20字符';
    }
    if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(value)) {
      return '用户名只能包含中文、英文、数字、下划线';
    }
    const sensitiveWords = ['admin', 'root', 'system', 'test'];
    if (sensitiveWords.some((word) => value.toLowerCase().includes(word))) {
      return '用户名不能包含敏感词';
    }
    return '';
  };

  // 验证密码
  const validatePassword = (value: string) => {
    if (!value) {
      return '请输入密码';
    }
    if (value.length < 8 || value.length > 20) {
      return '密码长度8-20位';
    }
    if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
      return '密码必须包含字母和数字';
    }
    return '';
  };

  // 检查用户名是否存在
  const checkUsernameExists = async (value: string) => {
    if (!value.trim() || validateUsername(value)) {
      setUsernameExists(false);
      return;
    }
    try {
      const exists = await checkUnique({
        fieldType: 'username',
        fieldValue: value.trim(),
        productLine: 'spacemv-coai-map',
      });
      setUsernameExists(exists);
    } catch {
      setUsernameExists(false);
    }
  };

  // 检查联系方式是否存在
  const checkContactExists = async (value: string) => {
    if (!value.trim()) {
      setContactExists(false);
      return;
    }
    const isPhone = /^1[3-9]\d{9}$/.test(value);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (!isPhone && !isEmail) {
      setContactExists(false);
      return;
    }
    try {
      const exists = await checkUnique({
        fieldType: isPhone ? 'phone' : 'email',
        fieldValue: value.trim(),
        productLine: 'spacemv-coai-map',
      });
      setContactExists(exists);
    } catch {
      setContactExists(false);
    }
  };

  // 检查白名单
  const checkWhitelistStatus = async (value: string) => {
    if (!value.trim()) {
      setWhitelistAllowed(null);
      setWhitelistMessage('');
      return;
    }
    const isPhone = /^1[3-9]\d{9}$/.test(value);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (!isPhone && !isEmail) {
      setWhitelistAllowed(null);
      setWhitelistMessage('');
      return;
    }
    try {
      const result = await checkWhitelist({
        account: value.trim(),
        productLine: 'spacemv-coai-map',
      });
      setWhitelistAllowed(result.allowed);
      setWhitelistMessage(result.message || result.reason || '');
    } catch {
      // 白名单服务不可用时不阻止注册
      setWhitelistAllowed(null);
      setWhitelistMessage('');
    }
  };

  // 用户名变化
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    setErrors((prev) => ({ ...prev, username: validateUsername(value) }));
    checkUsernameExists(value);
  };

  // 密码变化
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    setErrors((prev) => ({ ...prev, password: validatePassword(value) }));
  };

  // 确认密码变化
  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);
    setErrors((prev) => ({
      ...prev,
      confirmPassword: value !== password ? '两次密码不一致' : '',
    }));
  };

  // 联系方式变化
  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setContact(value);
    const isPhone = /^1[3-9]\d{9}$/.test(value);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    setContactType(isPhone ? 'phone' : 'email');
    setErrors((prev) => ({
      ...prev,
      contact: !isPhone && !isEmail && value.trim() ? '请输入正确的手机号或邮箱' : '',
    }));
    checkContactExists(value);
    checkWhitelistStatus(value);
  };

  // 获取验证码
  const handleGetCodeClick = async () => {
    setErrors({});

    // 验证联系方式
    const isPhone = /^1[3-9]\d{9}$/.test(contact);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
    if (!contact.trim()) {
      toast.error('请输入手机号或邮箱');
      return;
    }
    if (!isPhone && !isEmail) {
      toast.error('请输入正确的手机号或邮箱');
      return;
    }

    if (contactExists) {
      toast.error('该联系方式已被注册');
      return;
    }

    if (countdown > 0) {
      return;
    }

    // 显示人机验证弹窗
    await fetchCaptcha();
    setShowCaptchaDialog(true);
    setCaptchaCode('');
  };

  // 人机验证通过后发送验证码
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

      // 发送验证码
      await sendVerifyCode({
        channelAccount: contact,
        channelType: contactType,
        verifyType: 'register',
      });

      toast.success('验证码已发送');
      setShowCaptchaDialog(false);

      // 开始 60 秒倒计时
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
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

  // 提交注册
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // 验证所有字段
    const newErrors: Record<string, string> = {
      username: validateUsername(username),
      password: validatePassword(password),
      confirmPassword: confirmPassword !== password ? '两次密码不一致' : '',
      contact:
        !/^1[3-9]\d{9}$/.test(contact) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)
          ? '请输入正确的手机号或邮箱'
          : '',
      verifyCode: !verifyCode.trim() || verifyCode.length !== 6 ? '请输入6位验证码' : '',
    };

    if (Object.values(newErrors).some((err) => err)) {
      setErrors(newErrors);
      return;
    }

    if (usernameExists) {
      toast.error('用户名已存在');
      return;
    }

    if (contactExists) {
      toast.error('该联系方式已被注册');
      return;
    }

    setIsSubmitting(true);

    try {
      // RSA 加密密码
      const encryptedPassword = encryptPassword(password);
      if (!encryptedPassword) {
        throw new Error('密码加密失败');
      }

      // 调用注册 API
      const response = await fetch('/auth/v1/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelType: contactType,
          channelAccount: contact,
          verifyCode,
          password: encryptedPassword,
          username: username.trim(),
          productLine: 'spacemv-coai-map',
          bakPhone: contactType === 'email' && /^1[3-9]\d{9}$/.test(backupContact) ? backupContact : undefined,
          bakEmail: contactType === 'phone' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(backupContact) ? backupContact : undefined,
        }),
      });

      const data = await response.json();

      if (data.code !== 200) {
        throw new Error(data.msg || '注册失败');
      }

      toast.success('注册成功，请登录');
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '注册失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 用户名 */}
      <div className="space-y-2">
        <Label htmlFor="username" className="text-slate-300">
          用户名
        </Label>
        <Input
          id="username"
          type="text"
          value={username}
          onChange={handleUsernameChange}
          placeholder="中文/英文/数字/下划线，最长20字符"
          className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
        />
        {errors.username && <p className="text-sm text-red-400">{errors.username}</p>}
        {usernameExists && (
          <p className="text-sm text-amber-400">
            用户名已存在，<a href="/login" className="text-cyan-400">去登录</a>
          </p>
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
          onChange={handlePasswordChange}
          placeholder="8-20位，必须包含字母和数字"
          className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
        />
        {errors.password && <p className="text-sm text-red-400">{errors.password}</p>}
      </div>

      {/* 确认密码 */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-slate-300">
          确认密码
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={handleConfirmPasswordChange}
          placeholder="请再次输入密码"
          className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
        />
        {errors.confirmPassword && <p className="text-sm text-red-400">{errors.confirmPassword}</p>}
      </div>

      {/* 联系方式 */}
      <div className="space-y-2">
        <Label htmlFor="contact" className="text-slate-300">
          手机号/邮箱
        </Label>
        <Input
          id="contact"
          type="text"
          value={contact}
          onChange={handleContactChange}
          placeholder="请输入手机号或邮箱"
          className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
        />
        {errors.contact && <p className="text-sm text-red-400">{errors.contact}</p>}
        {contactExists && <p className="text-sm text-amber-400">该联系方式已被注册</p>}
        {whitelistAllowed === false && (
          <p className="text-sm text-red-400">{whitelistMessage || '该账号不在注册白名单中'}</p>
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
            placeholder="请输入6位验证码"
            className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 flex-1"
            maxLength={6}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleGetCodeClick}
            disabled={countdown > 0 || whitelistAllowed === false}
            className="w-24 border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            {countdown > 0 ? `${countdown}秒` : '获取验证码'}
          </Button>
        </div>
        {errors.verifyCode && <p className="text-sm text-red-400">{errors.verifyCode}</p>}
      </div>

      {/* 备用联系方式 */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">补充备用联系方式，找回账号更方便</span>
        <button
          type="button"
          onClick={() => setShowBackupContact(!showBackupContact)}
          className="text-xs text-cyan-400 hover:text-cyan-300"
        >
          {showBackupContact ? '收起' : '展开'}
        </button>
      </div>
      {showBackupContact && (
        <div className="space-y-2">
          <Label htmlFor="backupContact" className="text-slate-300">
            备用联系方式
          </Label>
          <Input
            id="backupContact"
            type="text"
            value={backupContact}
            onChange={(e) => setBackupContact(e.target.value)}
            placeholder={contactType === 'phone' ? '请输入备用邮箱' : '请输入备用手机号'}
            className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
          />
        </div>
      )}

      {/* 提交按钮 */}
      <Button
        type="submit"
        disabled={isSubmitting || whitelistAllowed === false}
        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
      >
        {isSubmitting ? '注册中...' : '注册'}
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