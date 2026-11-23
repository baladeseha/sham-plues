import { Copy, CreditCard, LogOut, Phone, QrCode, ShieldCheck, User } from 'lucide-react';
import type { UserProfile } from '../types';
import { QrFallback } from './QrFallback';
import { useToast } from './ToastContext';

interface ProfileTabProps {
  user: UserProfile;
  onPreviewImage: (src: string, title: string) => void;
  onLogout: () => void;
}

export function ProfileTab({ user, onPreviewImage, onLogout }: ProfileTabProps) {
  const { showToast } = useToast();

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(user.unique_id);
      showToast(`تم نسخ المعرف الموحد ${user.unique_id}`, 'success');
    } catch {
      showToast('تعذر النسخ التلقائي.', 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <section className="lg:col-span-7 rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">ملفي الشخصي</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              البيانات الرسمية الموثقة في منصة Sham Plus
            </p>
          </div>
          <span
            className={`text-xs font-bold ${
              user.status === 'active' ? 'text-[#0ECB81]' : 'text-[#F6465D]'
            }`}
          >
            {user.status === 'active' ? 'حساب نشط ومفعل' : 'الحساب موقوف'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-800/80 bg-[#080C14] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <User className="w-3.5 h-3.5 text-[#C9A227]" />
              <span>الاسم الثلاثي الكامل</span>
            </div>
            <p className="mt-1.5 text-sm font-bold text-white">{user.full_name}</p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#080C14] p-4 flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-[#C9A227]" />
                <span>رقم الـ ID الموحد</span>
              </div>
              <p className="mt-1.5 font-mono-num text-sm font-bold text-[#C9A227]">
                {user.unique_id}
              </p>
            </div>
            <button
              type="button"
              onClick={copyId}
              className="min-h-[38px] rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-[#C9A227]"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#080C14] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <CreditCard className="w-3.5 h-3.5 text-[#C9A227]" />
              <span>الرقم الوطني</span>
            </div>
            <p className="mt-1.5 font-mono-num text-sm font-bold text-white">
              {user.national_id}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#080C14] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Phone className="w-3.5 h-3.5 text-[#C9A227]" />
              <span>رقم الجوال (واتساب)</span>
            </div>
            <p className="mt-1.5 font-mono-num text-sm font-bold text-white">
              {user.phone}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#080C14] p-4">
            <span className="text-xs text-slate-400">الرصيد الحالي بالدولار</span>
            <p className="mt-1.5 font-mono-num text-xl font-extrabold text-[#0ECB81]">
              ${user.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#080C14] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <QrCode className="w-3.5 h-3.5 text-[#C9A227]" />
              <span>كود حساب شام كاش</span>
            </div>
            <p className="mt-1.5 font-mono-num text-sm font-bold text-white">
              {user.shamcash_code}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            يمكنك تسجيل الخروج الآمن من جلستك الحالية في أي وقت.
          </p>
          <button
            type="button"
            onClick={onLogout}
            className="min-h-[44px] shrink-0 rounded-xl border border-[#F6465D]/40 bg-[#F6465D]/10 px-5 py-2 text-xs sm:text-sm font-bold text-[#F6465D] hover:bg-[#F6465D] hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </section>

      <section className="lg:col-span-5 rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5 sm:p-6 flex flex-col items-center justify-center text-center">
        <h3 className="text-base font-bold text-white mb-1">
          باركود شام كاش الخاص بك
        </h3>
        <p className="text-xs text-slate-400 mb-5">
          تُستخدم هذه البطاقة لتحويل السحوبات المالية المعتمدة إلى حسابك
        </p>

        {user.shamcash_qr_url ? (
          <button
            type="button"
            onClick={() =>
              onPreviewImage(
                user.shamcash_qr_url,
                `باركود شام كاش - ${user.full_name}`
              )
            }
            className="rounded-2xl bg-white p-3 hover:ring-2 hover:ring-[#C9A227] transition-all"
          >
            <img
              src={user.shamcash_qr_url}
              alt="باركود شام كاش الخاص بالعميل"
              referrerPolicy="no-referrer"
              className="h-52 w-52 object-contain"
            />
            <span className="mt-2 block text-xs font-bold text-slate-700">
              اضغط لعرض الباركود بالحجم الكامل
            </span>
          </button>
        ) : (
          <QrFallback label={user.shamcash_code || 'باركود شام كاش'} />
        )}
      </section>
    </div>
  );
}
