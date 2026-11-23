import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  Lock,
} from 'lucide-react';
import { api } from '../api/client';
import type { AppSettings, TransactionRecord, UserProfile } from '../types';
import { QrFallback } from './QrFallback';
import { useToast } from './ToastContext';

interface WalletTabProps {
  user: UserProfile;
  settings: AppSettings;
  transactions: TransactionRecord[];
  loading: boolean;
  onTransactionCreated: () => Promise<void>;
  onPreviewImage: (src: string, title: string) => void;
}

export function WalletTab({
  user,
  settings,
  transactions,
  loading,
  onTransactionCreated,
  onPreviewImage,
}: WalletTabProps) {
  const { showToast } = useToast();
  const [subTab, setSubTab] = useState<'deposit' | 'withdraw'>('deposit');

  // Deposit state
  const [depositAmount, setDepositAmount] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [submittingDeposit, setSubmittingDeposit] = useState(false);

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

  const maxWithdraw = Number((user.balance * 0.5).toFixed(2));
  const parsedWithdraw = Number(withdrawAmount || 0);
  const withdrawExceedsLimit =
    parsedWithdraw > 0 && (user.balance <= 0 || parsedWithdraw > maxWithdraw);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(user.unique_id);
      showToast(`تم نسخ رقم الـ ID الموحد: ${user.unique_id}`, 'success');
    } catch {
      showToast('تعذر النسخ التلقائي.', 'error');
    }
  };

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('يرجى اختيار صورة صالحة (JPG أو PNG أو WEBP).', 'error');
      return;
    }
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setReceiptPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const submitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(depositAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('يرجى إدخال مبلغ إيداع صحيح أكبر من صفر.', 'error');
      return;
    }
    if (!receiptFile) {
      showToast('يرجى رفع صورة إشعار التحويل قبل الإرسال.', 'error');
      return;
    }

    const fd = new FormData();
    fd.append('user_id', String(user.id));
    fd.append('type', 'deposit');
    fd.append('amount', amt.toFixed(2));
    fd.append('receipt_file', receiptFile);

    setSubmittingDeposit(true);
    try {
      const res = await api.createTransaction(fd);
      showToast(res.message, 'success');
      setDepositAmount('');
      setReceiptFile(null);
      setReceiptPreview('');
      await onTransactionCreated();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر إرسال طلب الإيداع.',
        'error'
      );
    } finally {
      setSubmittingDeposit(false);
    }
  };

  const submitWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(withdrawAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('يرجى إدخال مبلغ سحب صحيح أكبر من صفر.', 'error');
      return;
    }
    if (user.balance <= 0 || amt > maxWithdraw) {
      showToast(
        `عذراً، الحد الأقصى المسموح به للسحب هو 50% من رصيدك الحالي ($${maxWithdraw.toFixed(2)}).`,
        'error'
      );
      return;
    }

    const fd = new FormData();
    fd.append('user_id', String(user.id));
    fd.append('type', 'withdraw');
    fd.append('amount', amt.toFixed(2));

    setSubmittingWithdraw(true);
    try {
      const res = await api.createTransaction(fd);
      showToast(res.message, 'success');
      setWithdrawAmount('');
      await onTransactionCreated();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر إرسال طلب السحب.',
        'error'
      );
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  const deposits = transactions.filter((t) => t.type === 'deposit');
  const withdrawals = transactions.filter((t) => t.type === 'withdraw');

  const renderDepositStatus = (status: TransactionRecord['status']) => {
    if (status === 'approved') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0ECB81]">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>عملية إيداع ناجحة</span>
        </span>
      );
    }
    if (status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#F6465D]">
          <XCircle className="w-3.5 h-3.5" />
          <span>تم رفض عملية الدفع</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#E0BE53]">
        <Clock className="w-3.5 h-3.5" />
        <span>معلق</span>
      </span>
    );
  };

  const renderWithdrawStatus = (status: TransactionRecord['status']) => {
    if (status === 'approved') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0ECB81]">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>سحب محقق</span>
        </span>
      );
    }
    if (status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#F6465D]">
          <XCircle className="w-3.5 h-3.5" />
          <span>عملية سحب مرفوضة</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#E0BE53]">
        <Clock className="w-3.5 h-3.5" />
        <span>سحب معلق</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Wallet Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5">
          <span className="text-xs font-semibold text-slate-400">
            الرصيد الحالي بالدولار
          </span>
          <p className="mt-1.5 font-mono-num text-2xl sm:text-3xl font-extrabold text-[#0ECB81]">
            ${user.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5 flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-slate-400">
              رقم المعرف الموحد (ID)
            </span>
            <p className="mt-1.5 font-mono-num text-xl font-bold text-[#C9A227]">
              {user.unique_id}
            </p>
          </div>
          <button
            type="button"
            onClick={copyId}
            className="min-h-[42px] rounded-xl border border-slate-700 bg-[#080C14] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-[#C9A227] transition-colors flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5 text-[#C9A227]" />
            <span>نسخ</span>
          </button>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5">
          <span className="text-xs font-semibold text-slate-400">
            الحد الأقصى للسحب (50%)
          </span>
          <p className="mt-1.5 font-mono-num text-2xl font-bold text-slate-100">
            ${maxWithdraw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Segmented Switcher */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0F1623] border border-slate-800/90 max-w-md">
        <button
          type="button"
          onClick={() => setSubTab('deposit')}
          className={`flex-1 min-h-[44px] rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
            subTab === 'deposit'
              ? 'bg-[#C9A227] text-[#080C14]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>الإيداع</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('withdraw')}
          className={`flex-1 min-h-[44px] rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
            subTab === 'withdraw'
              ? 'bg-[#C9A227] text-[#080C14]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>السحب</span>
        </button>
      </div>

      {subTab === 'deposit' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Deposit QR + Form */}
          <section className="lg:col-span-6 rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5 sm:p-6 space-y-5">
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3">
              إيداع رصيد عبر شام كاش
            </h3>

            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-[#080C14] p-5">
              {settings.admin_deposit_qr_url ? (
                <button
                  type="button"
                  onClick={() =>
                    onPreviewImage(
                      settings.admin_deposit_qr_url,
                      'باركود الإيداع الرسمي - Sham Plus'
                    )
                  }
                  className="group relative overflow-hidden rounded-xl bg-white p-2"
                >
                  <img
                    src={settings.admin_deposit_qr_url}
                    alt="باركود الإيداع الخاص بالإدارة"
                    referrerPolicy="no-referrer"
                    className="h-44 w-44 object-contain"
                  />
                  <span className="mt-1.5 block text-[11px] font-bold text-slate-700">
                    اضغط للتكبير
                  </span>
                </button>
              ) : (
                <QrFallback label="باركود الإيداع - Sham Plus" />
              )}

              <ol className="mt-5 w-full space-y-2 text-xs leading-relaxed text-slate-300 border-t border-slate-800 pt-4 list-decimal list-inside">
                <li>قم بتصوير أو مسح الباركود أعلاه داخل تطبيق شام كاش.</li>
                <li>أدخل المبلغ المراد تحويله بالدولار الأمريكي ($).</li>
                <li className="font-bold text-[#E0BE53]">
                  هام: اكتب رقم الـ ID الموحد الخاص بك ({user.unique_id}) في خانة
                  الملاحظات داخل شام كاش.
                </li>
                <li>
                  ارفع صورة إشعار التحويل أدناه من الكاميرا أو المعرض ليتم اعتماد المبلغ وإضافته لرصيدك.
                </li>
              </ol>
            </div>

            <form onSubmit={submitDeposit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  مبلغ الإيداع بالدولار ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  dir="ltr"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="100.00"
                  className="w-full min-h-[46px] rounded-xl border border-slate-700/80 bg-[#080C14] px-4 text-sm text-white font-mono-num text-right focus:border-[#C9A227] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  صورة إشعار التحويل (من الكاميرا أو المعرض) *
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 min-h-[54px] cursor-pointer rounded-xl border border-dashed border-slate-700 bg-[#080C14] px-4 py-2.5 flex items-center justify-center gap-2 text-xs font-semibold text-slate-300 hover:border-[#C9A227] hover:text-white transition-colors">
                    <Upload className="w-4 h-4 text-[#C9A227]" />
                    <span>
                      {receiptFile ? receiptFile.name : 'اختيار / تصوير إشعار التحويل'}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleReceiptChange}
                      className="hidden"
                    />
                  </label>
                  {receiptPreview && (
                    <img
                      src={receiptPreview}
                      alt="معاينة الإشعار"
                      className="h-14 w-14 rounded-xl object-cover border border-[#C9A227]/50 shrink-0"
                    />
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingDeposit}
                className="w-full min-h-[48px] rounded-xl bg-[#C9A227] text-sm font-bold text-[#080C14] hover:bg-[#DCB53B] transition-colors disabled:opacity-50"
              >
                {submittingDeposit ? 'جاري إرسال الطلب...' : 'تأكيد وإرسال طلب الإيداع'}
              </button>
            </form>
          </section>

          {/* Deposit History */}
          <section className="lg:col-span-6 rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5 sm:p-6">
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3">
              سجل عمليات الإيداع
            </h3>

            <div className="mt-4 space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 rounded-xl bg-[#080C14] border border-slate-800 animate-pulse"
                  />
                ))
              ) : deposits.length === 0 ? (
                <div className="rounded-xl border border-slate-800/80 bg-[#080C14]/70 p-8 text-center text-sm text-slate-400">
                  لا توجد عمليات إيداع مسجلة حتى الآن.
                </div>
              ) : (
                deposits.map((tx) => (
                  <div
                    key={tx.id}
                    className="rounded-xl border border-slate-800/80 bg-[#080C14]/70 p-4 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono-num text-base font-bold text-white">
                          +${tx.amount.toFixed(2)}
                        </span>
                        <span className="text-slate-600">·</span>
                        {renderDepositStatus(tx.status)}
                      </div>
                      <p className="font-mono-num text-[11px] text-slate-400">
                        {new Date(tx.created_at).toLocaleString('ar-EG')}
                      </p>
                      {tx.admin_note && (
                        <p className="text-xs text-slate-300">
                          ملاحظة الإدارة: {tx.admin_note}
                        </p>
                      )}
                    </div>
                    {tx.receipt_url && (
                      <button
                        type="button"
                        onClick={() =>
                          onPreviewImage(tx.receipt_url, `إشعار الإيداع #${tx.id}`)
                        }
                        className="min-h-[38px] rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-[#C9A227] flex items-center gap-1.5 shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#C9A227]" />
                        <span>الإشعار</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Withdraw Form */}
          <section className="lg:col-span-6 rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5 sm:p-6 space-y-5">
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3">
              طلب سحب رصيد إلى شام كاش
            </h3>

            <div className="rounded-xl border border-slate-800 bg-[#080C14] p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">رقم المعرف الموحد:</span>
                <span className="font-mono-num font-bold text-[#C9A227]">
                  {user.unique_id}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">كود شام كاش المستلم:</span>
                <span className="font-mono-num font-bold text-slate-200">
                  {user.shamcash_code}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                <span className="text-slate-400">الحد الأقصى للسحب (50%):</span>
                <span className="font-mono-num font-bold text-[#0ECB81]">
                  ${maxWithdraw.toFixed(2)}
                </span>
              </div>
            </div>

            {!settings.withdrawals_enabled ? (
              <div className="rounded-xl border border-[#F6465D]/40 bg-[#F6465D]/10 p-5 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#F6465D]/15 text-[#F6465D]">
                  <Lock className="w-6 h-6" />
                </div>
                <h4 className="text-base font-extrabold text-white">
                  الرجاء الانتظار 30 يوم للسماح بالسحب
                </h4>
                <p className="text-xs leading-relaxed text-slate-300">
                  تم تعليق خيار السحب مؤقتاً من قِبل إدارة المنصة. سيتم تفعيل السحب مجدداً وإتاحة تقديم الطلبات فور انقضاء المدة المحددة.
                </p>
              </div>
            ) : (
              <form onSubmit={submitWithdraw} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    مبلغ السحب المطلوب بالدولار ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    dir="ltr"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder={`الحد الأقصى ${maxWithdraw.toFixed(2)}`}
                    className="w-full min-h-[46px] rounded-xl border border-slate-700/80 bg-[#080C14] px-4 text-sm text-white font-mono-num text-right focus:border-[#C9A227] focus:outline-none"
                    required
                  />
                </div>

                {(withdrawExceedsLimit || user.balance <= 0) && (
                  <div className="rounded-xl border border-[#F6465D]/40 bg-[#F6465D]/10 p-3.5 flex items-start gap-2.5 text-xs text-[#FDE8EB]">
                    <AlertTriangle className="w-4 h-4 text-[#F6465D] shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      {user.balance <= 0
                        ? 'لا يوجد رصيد متاح للسحب حالياً. يرجى إتمام عملية إيداع أولاً.'
                        : `لا يمكن سحب مبلغ يتجاوز 50% من الرصيد الحالي. الحد الأقصى المتاح الآن هو $${maxWithdraw.toFixed(2)}.`}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingWithdraw || withdrawExceedsLimit || user.balance <= 0}
                  className="w-full min-h-[48px] rounded-xl bg-[#C9A227] text-sm font-bold text-[#080C14] hover:bg-[#DCB53B] transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  {submittingWithdraw ? 'جاري إرسال طلب السحب...' : 'تقديم طلب السحب'}
                </button>
              </form>
            )}
          </section>

          {/* Withdraw History */}
          <section className="lg:col-span-6 rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5 sm:p-6">
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3">
              سجل عمليات السحب
            </h3>

            <div className="mt-4 space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 rounded-xl bg-[#080C14] border border-slate-800 animate-pulse"
                  />
                ))
              ) : withdrawals.length === 0 ? (
                <div className="rounded-xl border border-slate-800/80 bg-[#080C14]/70 p-8 text-center text-sm text-slate-400">
                  لا توجد عمليات سحب مسجلة حتى الآن.
                </div>
              ) : (
                withdrawals.map((tx) => (
                  <div
                    key={tx.id}
                    className="rounded-xl border border-slate-800/80 bg-[#080C14]/70 p-4 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-num text-base font-bold text-white">
                        -${tx.amount.toFixed(2)}
                      </span>
                      {renderWithdrawStatus(tx.status)}
                    </div>
                    <p className="font-mono-num text-[11px] text-slate-400">
                      {new Date(tx.created_at).toLocaleString('ar-EG')}
                    </p>
                    {tx.admin_note && (
                      <p className="text-xs text-slate-300">
                        ملاحظة الإدارة: {tx.admin_note}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
