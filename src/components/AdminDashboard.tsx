import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  Wallet,
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  QrCode,
  Settings as SettingsIcon,
  ArrowLeftRight,
  Upload,
  Save,
  RefreshCw,
  ShieldCheck,
  Lock,
  TrendingUp,
  Bell,
  Send,
} from 'lucide-react';
import { api } from '../api/client';
import type {
  AdminNotificationItem,
  AdminStats,
  AdminTab,
  AdminTransactionRecord,
  AppSettings,
  UserProfile,
} from '../types';
import { ConfirmModal } from './ConfirmModal';
import { DEFAULT_APP_LOGO } from './AuthScreen';
import { useToast } from './ToastContext';

interface AdminDashboardProps {
  settings: AppSettings;
  onSettingsUpdated: (next: AppSettings) => void;
  onPreviewImage: (src: string, title: string) => void;
}

export function AdminDashboard({
  settings,
  onSettingsUpdated,
  onPreviewImage,
}: AdminDashboardProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>('transactions');
  const [stats, setStats] = useState<AdminStats>({
    total_users: 0,
    total_balances: 0,
    pending_count: 0,
  });

  // Transactions state
  const [txList, setTxList] = useState<AdminTransactionRecord[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txSearch, setTxSearch] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState('all');
  const [txStatusFilter, setTxStatusFilter] = useState('all');
  const [editedAmounts, setEditedAmounts] = useState<Record<number, string>>({});
  const [adminNotes, setAdminNotes] = useState<Record<number, string>>({});

  // Users state
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [editedBalances, setEditedBalances] = useState<Record<number, string>>({});
  const [bulkProfitAmount, setBulkProfitAmount] = useState('');

  // Settings state
  const [telegramInput, setTelegramInput] = useState(settings.telegram_support);
  const [youtubeInput, setYoutubeInput] = useState(settings.youtube_video_url);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState('');
  const [withdrawalsEnabled, setWithdrawalsEnabled] = useState<boolean>(
    settings.withdrawals_enabled ?? true
  );
  const [savingSettings, setSavingSettings] = useState(false);

  // Notifications state
  const [sentNotifications, setSentNotifications] = useState<AdminNotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifTarget, setNotifTarget] = useState<string>('all');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);

  // Confirm modal state
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    tone: 'approve' | 'reject' | 'gold';
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    setTelegramInput(settings.telegram_support);
    setYoutubeInput(settings.youtube_video_url);
    setWithdrawalsEnabled(settings.withdrawals_enabled ?? true);
  }, [settings]);

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const res = await api.getAdminTransactions({
        search: txSearch,
        type: txTypeFilter,
        status: txStatusFilter,
      });
      setTxList(res.transactions);
      setStats(res.stats);
      const amountsMap: Record<number, string> = {};
      res.transactions.forEach((t) => {
        amountsMap[t.id] = String(t.amount);
      });
      setEditedAmounts(amountsMap);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر تحميل العمليات المالية.',
        'error'
      );
    } finally {
      setTxLoading(false);
    }
  }, [txSearch, txTypeFilter, txStatusFilter, showToast]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await api.getAdminUsers(userSearch);
      setUsersList(res.users);
      setStats(res.stats);
      const balMap: Record<number, string> = {};
      res.users.forEach((u) => {
        balMap[u.id] = String(u.balance);
      });
      setEditedBalances(balMap);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر تحميل المستخدمين.',
        'error'
      );
    } finally {
      setUsersLoading(false);
    }
  }, [userSearch, showToast]);

  const loadAdminNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const [notifRes, usersRes] = await Promise.all([
        api.getAdminNotifications(),
        api.getAdminUsers(),
      ]);
      setSentNotifications(notifRes.notifications);
      setUsersList(usersRes.users);
      setStats(usersRes.stats);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر تحميل سجل الإشعارات.',
        'error'
      );
    } finally {
      setNotifLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (activeTab === 'transactions') {
      loadTransactions();
    } else if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'notifications') {
      loadAdminNotifications();
    }
  }, [activeTab, loadTransactions, loadUsers, loadAdminNotifications]);

  const requestTxDecision = (
    tx: AdminTransactionRecord,
    action: 'approve' | 'reject'
  ) => {
    const rawAmount = Number(editedAmounts[tx.id] ?? tx.amount);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      showToast('يرجى إدخال مبلغ صحيح أكبر من صفر.', 'error');
      return;
    }
    const note = adminNotes[tx.id] || '';
    const opLabel = tx.type === 'deposit' ? 'الإيداع' : 'السحب';

    setConfirmState({
      open: true,
      title:
        action === 'approve'
          ? `تأكيد الموافقة على طلب ${opLabel}`
          : `تأكيد رفض طلب ${opLabel}`,
      description:
        action === 'approve'
          ? tx.type === 'deposit'
            ? `سيتم اعتماد مبلغ $${rawAmount.toFixed(2)} وإضافته تلقائياً إلى رصيد العميل ${tx.user_full_name} (${tx.user_unique_id}).`
            : `سيتم اعتماد سحب مبلغ $${rawAmount.toFixed(2)} وخصمه تلقائياً من رصيد العميل ${tx.user_full_name} (${tx.user_unique_id}).`
          : `سيتم رفض طلب ${opLabel} الخاص بالعميل ${tx.user_full_name} (${tx.user_unique_id}) ولن يطرأ أي تغيير على رصيده.`,
      confirmLabel: action === 'approve' ? 'تأكيد الموافقة' : 'تأكيد الرفض',
      tone: action === 'approve' ? 'approve' : 'reject',
      onConfirm: async () => {
        setActionBusy(true);
        try {
          const res = await api.processAdminTxAction({
            transaction_id: tx.id,
            action,
            amount: rawAmount,
            admin_note: note,
          });
          showToast(res.message, 'success');
          setConfirmState(null);
          await loadTransactions();
        } catch (err) {
          showToast(
            err instanceof Error ? err.message : 'تعذر تنفيذ الإجراء.',
            'error'
          );
        } finally {
          setActionBusy(false);
        }
      },
    });
  };

  const requestUserBalanceSave = (u: UserProfile) => {
    const val = Number(editedBalances[u.id] ?? u.balance);
    if (!Number.isFinite(val) || val < 0) {
      showToast('الرصيد يجب أن يكون رقماً صحيحاً غير سالب.', 'error');
      return;
    }
    setConfirmState({
      open: true,
      title: 'تأكيد تعديل رصيد العميل',
      description: `هل تريد تعديل رصيد ${u.full_name} (${u.unique_id}) ليصبح $${val.toFixed(2)}؟`,
      confirmLabel: 'حفظ الرصيد',
      tone: 'gold',
      onConfirm: async () => {
        setActionBusy(true);
        try {
          const res = await api.updateAdminUser({ user_id: u.id, balance: val });
          showToast(res.message, 'success');
          setConfirmState(null);
          await loadUsers();
        } catch (err) {
          showToast(
            err instanceof Error ? err.message : 'تعذر تعديل الرصيد.',
            'error'
          );
        } finally {
          setActionBusy(false);
        }
      },
    });
  };

  const requestUserStatusToggle = (u: UserProfile) => {
    const nextStatus = u.status === 'active' ? 'suspended' : 'active';
    setConfirmState({
      open: true,
      title:
        nextStatus === 'suspended'
          ? 'تأكيد إيقاف حساب العميل'
          : 'تأكيد إعادة تفعيل الحساب',
      description:
        nextStatus === 'suspended'
          ? `سيتم إيقاف حساب ${u.full_name} (${u.unique_id}) ومنعه من تسجيل الدخول أو إجراء عمليات.`
          : `سيتم إعادة تفعيل حساب ${u.full_name} (${u.unique_id}) بالكامل.`,
      confirmLabel: nextStatus === 'suspended' ? 'إيقاف الحساب' : 'تفعيل الحساب',
      tone: nextStatus === 'suspended' ? 'reject' : 'approve',
      onConfirm: async () => {
        setActionBusy(true);
        try {
          const res = await api.updateAdminUser({
            user_id: u.id,
            status: nextStatus,
          });
          showToast(res.message, 'success');
          setConfirmState(null);
          await loadUsers();
        } catch (err) {
          showToast(
            err instanceof Error ? err.message : 'تعذر تغيير حالة الحساب.',
            'error'
          );
        } finally {
          setActionBusy(false);
        }
      },
    });
  };

  const requestBulkProfit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(bulkProfitAmount);
    if (!Number.isFinite(val) || val <= 0) {
      showToast('يرجى إدخال مبلغ ربح صحيح أكبر من صفر.', 'error');
      return;
    }
    setConfirmState({
      open: true,
      title: 'تأكيد زيادة أرباح جميع المستخدمين',
      description: `سيتم إضافة مبلغ $${val.toFixed(2)} تلقائياً إلى رصيد كل عميل مسجل في المنصة (${stats.total_users} مستخدم). هل تريد المتابعة؟`,
      confirmLabel: 'توزيع الأرباح الآن',
      tone: 'approve',
      onConfirm: async () => {
        setActionBusy(true);
        try {
          const res = await api.addBulkProfit(val);
          showToast(res.message, 'success');
          setBulkProfitAmount('');
          setConfirmState(null);
          await loadUsers();
        } catch (err) {
          showToast(
            err instanceof Error ? err.message : 'تعذر تنفيذ زيادة الأرباح.',
            'error'
          );
        } finally {
          setActionBusy(false);
        }
      },
    });
  };

  const handleFilePreview = (
    file: File | undefined,
    setFile: (f: File | null) => void,
    setPreview: (p: string) => void
  ) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('يرجى اختيار صورة بصيغة JPG أو PNG أو WEBP.', 'error');
      return;
    }
    setFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('telegram_support', telegramInput.trim());
    fd.append('youtube_video_url', youtubeInput.trim());
    fd.append('withdrawals_enabled', withdrawalsEnabled ? '1' : '0');
    if (logoFile) fd.append('app_logo_file', logoFile);
    if (qrFile) fd.append('admin_deposit_qr_file', qrFile);

    setSavingSettings(true);
    try {
      const res = await api.updateSettings(fd);
      showToast(res.message, 'success');
      onSettingsUpdated(res.settings);
      setLogoFile(null);
      setLogoPreview('');
      setQrFile(null);
      setQrPreview('');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر حفظ الإعدادات.',
        'error'
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim()) {
      showToast('يرجى إدخال عنوان الإشعار ونص الرسالة.', 'error');
      return;
    }
    setSendingNotif(true);
    try {
      const res = await api.sendAdminNotification({
        title: notifTitle.trim(),
        message: notifMessage.trim(),
        target_user_id: notifTarget,
      });
      showToast(res.message, 'success');
      setNotifTitle('');
      setNotifMessage('');
      await loadAdminNotifications();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر إرسال الإشعار.',
        'error'
      );
    } finally {
      setSendingNotif(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Global Admin KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400">
              إجمالي المستخدمين
            </span>
            <p className="mt-1 font-mono-num text-2xl font-extrabold text-white">
              {stats.total_users}
            </p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-[#C9A227]/15 text-[#C9A227] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400">
              مجموع أرصدة العملاء
            </span>
            <p className="mt-1 font-mono-num text-2xl font-extrabold text-[#0ECB81]">
              ${stats.total_balances.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-[#0ECB81]/15 text-[#0ECB81] flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400">
              العمليات المعلقة للمراجعة
            </span>
            <p className="mt-1 font-mono-num text-2xl font-extrabold text-[#E0BE53]">
              {stats.pending_count}
            </p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-[#E0BE53]/15 text-[#E0BE53] flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#0F1623] border border-slate-800/90">
        <button
          type="button"
          onClick={() => setActiveTab('transactions')}
          className={`flex-1 min-w-[140px] min-h-[44px] rounded-lg px-4 text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'transactions'
              ? 'bg-[#C9A227] text-[#080C14]'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          <span>إدارة العمليات المالية</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex-1 min-w-[140px] min-h-[44px] rounded-lg px-4 text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-[#C9A227] text-[#080C14]'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>إدارة المستخدمين</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`flex-1 min-w-[140px] min-h-[44px] rounded-lg px-4 text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'notifications'
              ? 'bg-[#C9A227] text-[#080C14]'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>إرسال إشعارات</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex-1 min-w-[140px] min-h-[44px] rounded-lg px-4 text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'settings'
              ? 'bg-[#C9A227] text-[#080C14]'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>إعدادات التطبيق</span>
        </button>
      </div>

      {/* Tab 1: Transactions Management */}
      {activeTab === 'transactions' && (
        <section className="rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5 sm:p-6 space-y-5">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                placeholder="بحث بالاسم، رقم الـ ID (مثل SP-1001)، أو الجوال..."
                className="w-full min-h-[44px] rounded-xl border border-slate-700/80 bg-[#080C14] pr-10 pl-4 text-sm text-white focus:border-[#C9A227] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={txTypeFilter}
                onChange={(e) => setTxTypeFilter(e.target.value)}
                className="min-h-[44px] rounded-xl border border-slate-700/80 bg-[#080C14] px-3 text-xs font-semibold text-slate-200 focus:border-[#C9A227] focus:outline-none"
              >
                <option value="all">كل الأنواع</option>
                <option value="deposit">إيداع فقط</option>
                <option value="withdraw">سحب فقط</option>
              </select>

              <select
                value={txStatusFilter}
                onChange={(e) => setTxStatusFilter(e.target.value)}
                className="min-h-[44px] rounded-xl border border-slate-700/80 bg-[#080C14] px-3 text-xs font-semibold text-slate-200 focus:border-[#C9A227] focus:outline-none"
              >
                <option value="all">كل الحالات</option>
                <option value="pending">معلق</option>
                <option value="approved">مقبول</option>
                <option value="rejected">مرفوض</option>
              </select>

              <button
                type="button"
                onClick={loadTransactions}
                className="min-h-[44px] rounded-xl border border-slate-700/80 bg-[#080C14] px-3.5 text-xs font-semibold text-slate-200 hover:border-[#C9A227] flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#C9A227]" />
                <span>تحديث</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {txLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-xl bg-[#080C14] border border-slate-800 animate-pulse"
                />
              ))
            ) : txList.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-[#080C14] p-10 text-center text-sm text-slate-400">
                لا توجد عمليات مالية مطابقة لمعايير البحث الحالية.
              </div>
            ) : (
              txList.map((tx) => (
                <div
                  key={tx.id}
                  className="rounded-xl border border-slate-800/90 bg-[#080C14]/80 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-bold text-white">
                          {tx.user_full_name}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="font-mono-num text-xs font-bold text-[#C9A227]">
                          {tx.user_unique_id}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="font-mono-num text-xs text-slate-400">
                          {tx.user_phone}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span
                          className={`font-bold ${
                            tx.type === 'deposit'
                              ? 'text-[#0ECB81]'
                              : 'text-[#E0BE53]'
                          }`}
                        >
                          {tx.type === 'deposit' ? 'طلب إيداع' : 'طلب سحب'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          الرصيد الحالي:{' '}
                          <strong className="font-mono-num text-slate-200">
                            ${tx.user_balance.toFixed(2)}
                          </strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">
                          كود شام كاش: {tx.user_shamcash_code}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">
                          {new Date(tx.created_at).toLocaleString('ar-EG')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {tx.receipt_url && (
                        <button
                          type="button"
                          onClick={() =>
                            onPreviewImage(
                              tx.receipt_url,
                              `إشعار إيداع ${tx.user_unique_id} (#${tx.id})`
                            )
                          }
                          className="min-h-[38px] rounded-lg border border-slate-700 bg-[#0F1623] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-[#C9A227] flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#C9A227]" />
                          <span>عرض الإشعار</span>
                        </button>
                      )}

                      {tx.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0ECB81]">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>معتمد (${tx.amount.toFixed(2)})</span>
                        </span>
                      ) : tx.status === 'rejected' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#F6465D]">
                          <XCircle className="w-4 h-4" />
                          <span>مرفوض (${tx.amount.toFixed(2)})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#E0BE53]">
                          <Clock className="w-4 h-4" />
                          <span>بانتظار القرار</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {tx.status === 'pending' && (
                    <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          تعديل المبلغ ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          dir="ltr"
                          value={editedAmounts[tx.id] ?? String(tx.amount)}
                          onChange={(e) =>
                            setEditedAmounts((prev) => ({
                              ...prev,
                              [tx.id]: e.target.value,
                            }))
                          }
                          className="w-full min-h-[40px] rounded-lg border border-slate-700 bg-[#0F1623] px-3 text-sm font-mono-num text-white text-right focus:border-[#C9A227] focus:outline-none"
                        />
                      </div>

                      <div className="md:col-span-5">
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          ملاحظة الإدارة (اختياري)
                        </label>
                        <input
                          type="text"
                          value={adminNotes[tx.id] || ''}
                          onChange={(e) =>
                            setAdminNotes((prev) => ({
                              ...prev,
                              [tx.id]: e.target.value,
                            }))
                          }
                          placeholder="مثال: تم التحقق من إشعار شام كاش"
                          className="w-full min-h-[40px] rounded-lg border border-slate-700 bg-[#0F1623] px-3 text-xs text-white focus:border-[#C9A227] focus:outline-none"
                        />
                      </div>

                      <div className="md:col-span-4 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => requestTxDecision(tx, 'approve')}
                          className="flex-1 min-h-[40px] rounded-lg bg-[#0ECB81] px-3 text-xs font-bold text-[#05130D] hover:bg-[#14DF8F] transition-colors flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>موافقة</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => requestTxDecision(tx, 'reject')}
                          className="flex-1 min-h-[40px] rounded-lg bg-[#F6465D] px-3 text-xs font-bold text-white hover:bg-[#FF596E] transition-colors flex items-center justify-center gap-1.5"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>رفض</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* Tab 2: Users Management */}
      {activeTab === 'users' && (
        <section className="rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5 sm:p-6 space-y-5">
          {/* Bulk Profit Distribution Card */}
          <form
            onSubmit={requestBulkProfit}
            className="rounded-xl border border-[#C9A227]/35 bg-[#080C14] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-end justify-between gap-4"
          >
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2 text-sm font-bold text-[#E0BE53]">
                <TrendingUp className="w-4 h-4" />
                <span>زيادة أرباح جميع المستخدمين</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                أدخل المبلغ بالدولار ($) ليتم إضافته وزيادته تلقائياً على رصيد كل عميل مسجل في المنصة.
              </p>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
              <input
                type="number"
                step="0.01"
                min="0.01"
                dir="ltr"
                value={bulkProfitAmount}
                onChange={(e) => setBulkProfitAmount(e.target.value)}
                placeholder="مثال: 25.00"
                className="w-full sm:w-40 min-h-[44px] rounded-xl border border-slate-700 bg-[#0F1623] px-3.5 text-sm font-mono-num text-white text-right focus:border-[#C9A227] focus:outline-none"
                required
              />
              <button
                type="submit"
                className="w-full sm:w-auto min-h-[44px] rounded-xl bg-[#0ECB81] px-5 text-xs sm:text-sm font-bold text-[#05130D] hover:bg-[#14DF8F] transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
              >
                <TrendingUp className="w-4 h-4" />
                <span>زيادة رصيد الجميع</span>
              </button>
            </div>
          </form>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="البحث باسم العميل، رقم الـ ID (SP-1001)، أو الجوال..."
                className="w-full min-h-[44px] rounded-xl border border-slate-700/80 bg-[#080C14] pr-10 pl-4 text-sm text-white focus:border-[#C9A227] focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={loadUsers}
              className="min-h-[44px] rounded-xl border border-slate-700/80 bg-[#080C14] px-4 text-xs font-semibold text-slate-200 hover:border-[#C9A227] flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#C9A227]" />
              <span>تحديث القائمة</span>
            </button>
          </div>

          <div className="space-y-3">
            {usersLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-xl bg-[#080C14] border border-slate-800 animate-pulse"
                />
              ))
            ) : usersList.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-[#080C14] p-10 text-center text-sm text-slate-400">
                لا يوجد عملاء مسجلون مطابقون للبحث.
              </div>
            ) : (
              usersList.map((u) => (
                <div
                  key={u.id}
                  className="rounded-xl border border-slate-800/90 bg-[#080C14]/80 p-4 space-y-3"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-bold text-white">{u.full_name}</span>
                        <span className="text-slate-600">·</span>
                        <span className="font-mono-num text-xs font-bold text-[#C9A227]">
                          {u.unique_id}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span
                          className={`text-xs font-bold ${
                            u.status === 'active'
                              ? 'text-[#0ECB81]'
                              : 'text-[#F6465D]'
                          }`}
                        >
                          {u.status === 'active' ? 'نشط' : 'موقوف'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span>
                          الجوال:{' '}
                          <span className="font-mono-num text-slate-200">
                            {u.phone}
                          </span>
                        </span>
                        <span>
                          الرقم الوطني:{' '}
                          <span className="font-mono-num text-slate-200">
                            {u.national_id}
                          </span>
                        </span>
                        <span>
                          كود شام كاش:{' '}
                          <span className="font-mono-num text-slate-200">
                            {u.shamcash_code}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {u.shamcash_qr_url ? (
                        <button
                          type="button"
                          onClick={() =>
                            onPreviewImage(
                              u.shamcash_qr_url,
                              `باركود شام كاش - ${u.full_name} (${u.unique_id})`
                            )
                          }
                          className="min-h-[40px] rounded-lg border border-slate-700 bg-[#0F1623] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-[#C9A227] flex items-center gap-1.5"
                        >
                          <QrCode className="w-4 h-4 text-[#C9A227]" />
                          <span>عرض باركود شام كاش</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">
                          لا يوجد باركود مرفق
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => requestUserStatusToggle(u)}
                        className={`min-h-[40px] rounded-lg px-3.5 text-xs font-bold transition-colors ${
                          u.status === 'active'
                            ? 'border border-[#F6465D]/40 text-[#F6465D] hover:bg-[#F6465D]/10'
                            : 'border border-[#0ECB81]/40 text-[#0ECB81] hover:bg-[#0ECB81]/10'
                        }`}
                      >
                        {u.status === 'active' ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-3">
                    <label className="text-xs font-semibold text-slate-300">
                      تعديل الرصيد ($):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      dir="ltr"
                      value={editedBalances[u.id] ?? String(u.balance)}
                      onChange={(e) =>
                        setEditedBalances((prev) => ({
                          ...prev,
                          [u.id]: e.target.value,
                        }))
                      }
                      className="w-36 min-h-[38px] rounded-lg border border-slate-700 bg-[#0F1623] px-3 text-sm font-mono-num text-white text-right focus:border-[#C9A227] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => requestUserBalanceSave(u)}
                      className="min-h-[38px] rounded-lg bg-[#C9A227] px-4 text-xs font-bold text-[#080C14] hover:bg-[#DCB53B] transition-colors flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>حفظ الرصيد</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* Tab 3: Send Notifications to Customers */}
      {activeTab === 'notifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-5 rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5 sm:p-6 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                إرسال رسالة وإشعار للعملاء
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                تصل الرسالة فوراً كإشعار داخل قسم الإشعارات لدى العملاء.
              </p>
            </div>

            <form onSubmit={handleSendNotification} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  المستلم
                </label>
                <select
                  value={notifTarget}
                  onChange={(e) => setNotifTarget(e.target.value)}
                  className="w-full min-h-[46px] rounded-xl border border-slate-700/80 bg-[#080C14] px-3.5 text-sm text-white focus:border-[#C9A227] focus:outline-none"
                >
                  <option value="all">جميع العملاء ({usersList.length})</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.full_name} ({u.unique_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  عنوان الإشعار *
                </label>
                <input
                  type="text"
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  placeholder="مثال: تحديث هام حول السوق والأرباح"
                  className="w-full min-h-[46px] rounded-xl border border-slate-700/80 bg-[#080C14] px-4 text-sm text-white focus:border-[#C9A227] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  نص الرسالة *
                </label>
                <textarea
                  rows={5}
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  placeholder="اكتب الرسالة التي ستصل إلى قسم الإشعارات عند العميل..."
                  className="w-full rounded-xl border border-slate-700/80 bg-[#080C14] p-3.5 text-sm text-white leading-relaxed focus:border-[#C9A227] focus:outline-none resize-y"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={sendingNotif}
                className="w-full min-h-[48px] rounded-xl bg-[#C9A227] text-sm font-bold text-[#080C14] hover:bg-[#DCB53B] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{sendingNotif ? 'جاري الإرسال...' : 'إرسال الإشعار للعملاء'}</span>
              </button>
            </form>
          </section>

          <section className="lg:col-span-7 rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  سجل الرسائل المرسلة
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  كافة الإشعارات الصادرة من الإدارة
                </p>
              </div>
              <button
                type="button"
                onClick={loadAdminNotifications}
                className="min-h-[38px] rounded-xl border border-slate-700/80 bg-[#080C14] px-3 text-xs font-semibold text-slate-200 hover:border-[#C9A227] flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#C9A227]" />
                <span>تحديث</span>
              </button>
            </div>

            <div className="space-y-3 max-h-[520px] overflow-y-auto pl-1">
              {notifLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 rounded-xl bg-[#080C14] border border-slate-800 animate-pulse"
                  />
                ))
              ) : sentNotifications.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-[#080C14] p-10 text-center text-sm text-slate-400">
                  لم تقم بإرسال أي إشعارات للعملاء بعد.
                </div>
              ) : (
                sentNotifications.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-800/90 bg-[#080C14]/80 p-4 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-[#C9A227]">
                        إلى: {item.target_label}
                      </span>
                      <span className="font-mono-num text-[11px] text-slate-400">
                        {new Date(item.created_at).toLocaleString('ar-EG')}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white">{item.title}</h4>
                    <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-line">
                      {item.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* Tab 4: App Settings */}
      {activeTab === 'settings' && (
        <section className="rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5 sm:p-6">
          <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3">
            إعدادات التطبيق والهوية والروابط
          </h3>

          <form onSubmit={handleSaveSettings} className="mt-5 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* App Logo Upload */}
              <div className="rounded-xl border border-slate-800 bg-[#080C14] p-4 space-y-3">
                <span className="block text-xs font-bold text-slate-200">
                  شعار التطبيق (Logo)
                </span>
                <p className="text-[11px] text-slate-400">
                  يظهر تلقائياً في شاشة الدخول والشريط العلوي للعملاء.
                </p>
                <div className="flex items-center gap-4">
                  <img
                    src={logoPreview || settings.app_logo_url || DEFAULT_APP_LOGO}
                    alt="معاينة شعار التطبيق"
                    referrerPolicy="no-referrer"
                    className="h-16 w-16 rounded-xl object-cover border border-[#C9A227]/40 bg-[#0F1623]"
                  />
                  <label className="flex-1 min-h-[46px] cursor-pointer rounded-xl border border-dashed border-slate-700 px-3 flex items-center justify-center gap-2 text-xs font-semibold text-slate-300 hover:border-[#C9A227] hover:text-white transition-colors">
                    <Upload className="w-4 h-4 text-[#C9A227]" />
                    <span>{logoFile ? logoFile.name : 'رفع شعار جديد'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) =>
                        handleFilePreview(
                          e.target.files?.[0],
                          setLogoFile,
                          setLogoPreview
                        )
                      }
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Admin Deposit QR Upload */}
              <div className="rounded-xl border border-slate-800 bg-[#080C14] p-4 space-y-3">
                <span className="block text-xs font-bold text-slate-200">
                  باركود الإيداع الخاص بالإدارة (شام كاش)
                </span>
                <p className="text-[11px] text-slate-400">
                  يظهر للعملاء في صفحة الإيداع لإرسال الحوالات المالية.
                </p>
                <div className="flex items-center gap-4">
                  {qrPreview || settings.admin_deposit_qr_url ? (
                    <img
                      src={qrPreview || settings.admin_deposit_qr_url}
                      alt="معاينة باركود الإيداع"
                      referrerPolicy="no-referrer"
                      className="h-16 w-16 rounded-xl object-contain border border-slate-700 bg-white p-1"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl border border-slate-700 bg-[#0F1623] flex items-center justify-center text-slate-500">
                      <QrCode className="w-6 h-6" />
                    </div>
                  )}
                  <label className="flex-1 min-h-[46px] cursor-pointer rounded-xl border border-dashed border-slate-700 px-3 flex items-center justify-center gap-2 text-xs font-semibold text-slate-300 hover:border-[#C9A227] hover:text-white transition-colors">
                    <Upload className="w-4 h-4 text-[#C9A227]" />
                    <span>{qrFile ? qrFile.name : 'تغيير باركود الإيداع'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) =>
                        handleFilePreview(
                          e.target.files?.[0],
                          setQrFile,
                          setQrPreview
                        )
                      }
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  معرف حساب تليجرام للدعم والشكاوى
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={telegramInput}
                  onChange={(e) => setTelegramInput(e.target.value)}
                  placeholder="ShamPlusSupport أو https://t.me/ShamPlusSupport"
                  className="w-full min-h-[46px] rounded-xl border border-slate-700/80 bg-[#080C14] px-4 text-sm text-white font-mono-num text-right focus:border-[#C9A227] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  رابط فيديو اليوتيوب في الواجهة الرئيسية
                </label>
                <input
                  type="url"
                  dir="ltr"
                  value={youtubeInput}
                  onChange={(e) => setYoutubeInput(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full min-h-[46px] rounded-xl border border-slate-700/80 bg-[#080C14] px-4 text-sm text-white font-mono-num text-right focus:border-[#C9A227] focus:outline-none"
                />
              </div>
            </div>

            {/* Withdrawal Enable / Suspend Control */}
            <div className="rounded-xl border border-slate-800 bg-[#080C14] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="block text-sm font-bold text-white">
                  التحكم في السحب للعملاء
                </span>
                <p className="text-xs leading-relaxed text-slate-400">
                  {withdrawalsEnabled
                    ? 'السحب مفعّل حالياً: يُسمح للعملاء بتقديم طلبات السحب ضمن الحد المسموح (50%).'
                    : 'السحب معلّق حالياً: يُمنع العملاء من السحب وتظهر لهم رسالة (الرجاء الانتظار 30 يوم للسماح بالسحب).'}
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0F1623] border border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setWithdrawalsEnabled(true)}
                  className={`min-h-[42px] px-4 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    withdrawalsEnabled
                      ? 'bg-[#0ECB81] text-[#05130D]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>تفعيل السحب</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawalsEnabled(false)}
                  className={`min-h-[42px] px-4 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    !withdrawalsEnabled
                      ? 'bg-[#F6465D] text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  <span>تعليق السحب</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="min-h-[48px] rounded-xl bg-[#C9A227] px-7 py-2.5 text-sm font-bold text-[#080C14] hover:bg-[#DCB53B] transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingSettings ? 'جاري الحفظ...' : 'حفظ الإعدادات وتطبيقها'}</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {confirmState && (
        <ConfirmModal
          open={confirmState.open}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          tone={confirmState.tone}
          loading={actionBusy}
          onConfirm={confirmState.onConfirm}
          onCancel={() => !actionBusy && setConfirmState(null)}
        />
      )}
    </div>
  );
}
