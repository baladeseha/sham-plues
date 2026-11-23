import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Eye,
  EyeOff,
  Lock,
  Phone,
  Upload,
  User,
  CreditCard,
  QrCode,
  ArrowLeft,
} from 'lucide-react';
import { api } from '../api/client';
import type { AppSettings, UserProfile } from '../types';
import { useToast } from './ToastContext';

export const DEFAULT_APP_LOGO = '/src/assets/images/sham_plus_logo_1795443088309.jpg';
const HERO_GOLD_IMAGE = '/src/assets/images/gold_market_hero_1795443087526.jpg';

interface AuthScreenProps {
  settings: AppSettings;
  onAuthenticated: (token: string, user: UserProfile) => void;
}

export function AuthScreen({ settings, onAuthenticated }: AuthScreenProps) {
  const { showToast } = useToast();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);

  // Login fields
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Register fields
  const [fullName, setFullName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [shamcashCode, setShamcashCode] = useState('');
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string>('');
  const [showRegPass, setShowRegPass] = useState(false);

  const handleQrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('يرجى اختيار صورة صالحة (JPG أو PNG أو WEBP).', 'error');
      return;
    }
    setQrFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setQrPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPhone.trim() || !loginPassword) {
      showToast('يرجى إدخال رقم الجوال وكلمة المرور.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await api.login(loginPhone.trim(), loginPassword);
      showToast(
        res.redirect === 'admin'
          ? 'مرحباً بك في لوحة تحكم Sham Plus.'
          : `أهلاً بك ${res.user.full_name}`,
        'success'
      );
      onAuthenticated(res.token, res.user);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'فشل تسجيل الدخول.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().split(/\s+/).length < 3) {
      showToast('يرجى إدخال الاسم الثلاثي الكامل (الاسم والأب والكنية).', 'error');
      return;
    }
    if (!nationalId.trim() || nationalId.trim().length < 5) {
      showToast('يرجى إدخال الرقم الوطني بشكل صحيح.', 'error');
      return;
    }
    if (!phone.trim() || phone.trim().length < 7) {
      showToast('يرجى إدخال رقم جوال صالح مرتبط بواتساب.', 'error');
      return;
    }
    if (password.length < 4) {
      showToast('يجب أن تكون كلمة المرور 4 أحرف على الأقل.', 'error');
      return;
    }
    if (password !== confirmPassword) {
      showToast('كلمتا المرور غير متطابقتين.', 'error');
      return;
    }
    if (!shamcashCode.trim()) {
      showToast('يرجى إدخال كود حساب شام كاش الخاص بك.', 'error');
      return;
    }
    if (!qrFile) {
      showToast('يرجى رفع صورة باركود حساب شام كاش الخاصة بك.', 'error');
      return;
    }

    const fd = new FormData();
    fd.append('full_name', fullName.trim());
    fd.append('national_id', nationalId.trim());
    fd.append('phone', phone.trim());
    fd.append('password', password);
    fd.append('shamcash_code', shamcashCode.trim());
    fd.append('shamcash_qr_file', qrFile);

    setLoading(true);
    try {
      const res = await api.register(fd);
      showToast(res.message, 'success');
      onAuthenticated(res.token, res.user);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر إنشاء الحساب.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const logoSrc = settings.app_logo_url || DEFAULT_APP_LOGO;

  return (
    <div className="min-h-screen bg-[#080C14] text-slate-100 flex items-center justify-center p-4 lg:p-8">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-slate-800/80 bg-[#0F1623] overflow-hidden shadow-2xl items-stretch">
        {/* Visual Editorial & Brand Column */}
        <div className="lg:col-span-5 relative flex flex-col justify-between p-6 sm:p-8 lg:p-10 bg-[#0B101B] border-b lg:border-b-0 lg:border-l border-slate-800/80 min-h-[260px]">
          <img
            src={HERO_GOLD_IMAGE}
            alt="أسواق الذهب العالمية"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080C14] via-[#080C14]/80 to-[#080C14]/65" />

          <div className="relative z-10 flex items-center gap-3.5">
            <img
              src={logoSrc}
              alt="شعار Sham Plus"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = DEFAULT_APP_LOGO;
              }}
              className="h-12 w-12 rounded-xl object-cover border border-[#C9A227]/40 bg-[#0F1623]"
            />
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white">
                Sham Plus
              </h1>
              <p className="text-xs text-[#C9A227] font-semibold">
                منصة التداول وإدارة المحافظ
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-8 lg:mt-0 space-y-5">
            <h2 className="text-2xl sm:text-3xl font-bold leading-snug text-white [text-wrap:balance]">
              تداول بثقة في أسواق الذهب العالمية
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-slate-300">
              بوابتك الذكية لأسواق المال، تداول الذهب، وإدارة المحافظ الاستثمارية
              بمرونة وأمان.
            </p>
            <div className="pt-4 border-t border-slate-800/90 grid grid-cols-2 gap-4 text-xs text-slate-300">
              <div>
                <span className="block font-bold text-[#C9A227]">أسعار لحظية</span>
                <span className="mt-0.5 block text-slate-400">
                  تحديثات مباشرة لأسواق XAU/USD
                </span>
              </div>
              <div>
                <span className="block font-bold text-[#0ECB81]">إيداع وسحب موثّق</span>
                <span className="mt-0.5 block text-slate-400">
                  ربط مباشر عبر شام كاش ومعرف SP موحد
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Form Column */}
        <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
          {/* Segmented Mode Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#080C14] border border-slate-800/90 mb-6">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 min-h-[44px] rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-[#C9A227] text-[#080C14]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 min-h-[44px] rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-[#C9A227] text-[#080C14]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              إنشاء حساب جديد
            </button>
          </div>

          {mode === 'login' ? (
            <motion.form
              key="login"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              onSubmit={handleLogin}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  رقم الجوال
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    dir="ltr"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    placeholder="09xxxxxxxx"
                    className="w-full min-h-[48px] rounded-xl border border-slate-700/80 bg-[#080C14] pr-10 pl-4 text-sm text-white font-mono-num text-right focus:border-[#C9A227] focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  كلمة المرور
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showLoginPass ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-h-[48px] rounded-xl border border-slate-700/80 bg-[#080C14] pr-10 pl-12 text-sm text-white focus:border-[#C9A227] focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPass((v) => !v)}
                    aria-label="إظهار أو إخفاء كلمة المرور"
                    className="absolute left-2 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-white"
                  >
                    {showLoginPass ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] rounded-xl bg-[#C9A227] text-sm font-bold text-[#080C14] hover:bg-[#DCB53B] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{loading ? 'جاري التحقق...' : 'دخول إلى المنصة'}</span>
                {!loading && <ArrowLeft className="w-4 h-4" />}
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="register"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              onSubmit={handleRegister}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    الاسم الثلاثي الكامل *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="مثال: أحمد محمد العلي"
                      className="w-full min-h-[44px] rounded-xl border border-slate-700/80 bg-[#080C14] pr-10 pl-3 text-sm text-white focus:border-[#C9A227] focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    الرقم الوطني *
                  </label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      dir="ltr"
                      value={nationalId}
                      onChange={(e) => setNationalId(e.target.value)}
                      placeholder="010xxxxxxxx"
                      className="w-full min-h-[44px] rounded-xl border border-slate-700/80 bg-[#080C14] pr-10 pl-3 text-sm text-white font-mono-num text-right focus:border-[#C9A227] focus:outline-none"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  رقم الجوال (يُفضّل وجود حساب واتساب للتواصل) *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="09xxxxxxxx"
                    className="w-full min-h-[44px] rounded-xl border border-slate-700/80 bg-[#080C14] pr-10 pl-3 text-sm text-white font-mono-num text-right focus:border-[#C9A227] focus:outline-none"
                    required
                  />
                </div>
                <p className="mt-1 text-[11px] text-[#0ECB81]">
                  تنويه: يرجى التأكد من توفر واتساب على هذا الرقم لتلقي إشعارات الحساب والتواصل المباشر.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    كلمة المرور *
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="4 أحرف على الأقل"
                      className="w-full min-h-[44px] rounded-xl border border-slate-700/80 bg-[#080C14] pr-3 pl-10 text-sm text-white focus:border-[#C9A227] focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPass((v) => !v)}
                      aria-label="إظهار كلمة المرور"
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-white"
                    >
                      {showRegPass ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    تأكيد كلمة المرور *
                  </label>
                  <input
                    type={showRegPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد كتابة كلمة المرور"
                    className="w-full min-h-[44px] rounded-xl border border-slate-700/80 bg-[#080C14] px-3 text-sm text-white focus:border-[#C9A227] focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  كود حساب شام كاش (لاستلام السحوبات) *
                </label>
                <div className="relative">
                  <QrCode className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    dir="ltr"
                    value={shamcashCode}
                    onChange={(e) => setShamcashCode(e.target.value)}
                    placeholder="SC-xxxxxx"
                    className="w-full min-h-[44px] rounded-xl border border-slate-700/80 bg-[#080C14] pr-10 pl-3 text-sm text-white font-mono-num text-right focus:border-[#C9A227] focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  صورة باركود حساب شام كاش الخاص بك *
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex-1 min-h-[54px] cursor-pointer rounded-xl border border-dashed border-slate-700 bg-[#080C14] px-4 py-2.5 flex items-center justify-center gap-2 text-xs font-semibold text-slate-300 hover:border-[#C9A227] hover:text-white transition-colors">
                    <Upload className="w-4 h-4 text-[#C9A227]" />
                    <span>{qrFile ? qrFile.name : 'رفع صورة الباركود (معاينة فورية)'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleQrChange}
                      className="hidden"
                    />
                  </label>
                  {qrPreview && (
                    <img
                      src={qrPreview}
                      alt="معاينة باركود شام كاش"
                      className="h-14 w-14 rounded-xl object-cover border border-[#C9A227]/50 bg-white shrink-0"
                    />
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] rounded-xl bg-[#C9A227] text-sm font-bold text-[#080C14] hover:bg-[#DCB53B] transition-colors disabled:opacity-50"
              >
                {loading ? 'جاري إنشاء الحساب وتوليد رقم SP...' : 'إنشاء الحساب والبدء'}
              </button>
            </motion.form>
          )}
        </div>
      </div>
    </div>
  );
}
