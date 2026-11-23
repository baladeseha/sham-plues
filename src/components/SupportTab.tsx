import { MessageCircle, ShieldAlert, ExternalLink } from 'lucide-react';
import type { AppSettings, UserProfile } from '../types';

interface SupportTabProps {
  settings: AppSettings;
  user: UserProfile;
}

export function SupportTab({ settings, user }: SupportTabProps) {
  const rawHandle = (settings.telegram_support || 'ShamPlusSupport')
    .replace(/^@+/, '')
    .trim();
  const telegramUrl = `https://t.me/${encodeURIComponent(rawHandle)}`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <section className="rounded-2xl border border-slate-800/80 bg-[#0F1623] p-6 sm:p-8 text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C9A227]/15 text-[#C9A227]">
          <MessageCircle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-extrabold text-white">
            الدعم الفني وخدمة العملاء
          </h2>
          <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
            هل واجهت مشكلة تقنية في الإيداع أو السحب أو لديك استفسار حول محفظتك؟
            تواصل مباشرة مع فريق الدعم الرسمي عبر تليجرام.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#080C14] p-4 max-w-md mx-auto text-xs text-slate-300 space-y-1">
          <p>
            يرجى تزويد فريق الدعم برقم الـ ID الموحد الخاص بك لتسريع المتابعة:
          </p>
          <p className="font-mono-num text-sm font-bold text-[#C9A227]">
            {user.unique_id}
          </p>
        </div>

        <div>
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-xl bg-[#C9A227] px-7 py-3 text-sm font-bold text-[#080C14] hover:bg-[#DCB53B] transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>التواصل عبر تليجرام (@{rawHandle})</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5 sm:p-6 flex items-start gap-3.5">
        <ShieldAlert className="w-5 h-5 text-[#C9A227] shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs leading-relaxed text-slate-300">
          <h3 className="text-sm font-bold text-white">تنبيه أمني هام</h3>
          <p>
            لا تقم بمشاركة كلمة المرور الخاصة بك مع أي شخص. فريق دعم Sham Plus لا يطلب منك أبداً كلمة السر، ويكتفي برقم الـ ID الموحد فقط للتحقق من الطلبات المالية وحل الأعطال.
          </p>
        </div>
      </section>
    </div>
  );
}
