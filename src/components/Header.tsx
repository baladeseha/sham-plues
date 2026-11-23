import { Bell, Copy, LogOut } from 'lucide-react';
import type { AppSettings, UserProfile } from '../types';
import { DEFAULT_APP_LOGO } from './AuthScreen';
import { useToast } from './ToastContext';

interface HeaderProps {
  user: UserProfile;
  settings: AppSettings;
  unreadCount?: number;
  onOpenNotifications?: () => void;
  onLogout: () => void;
}

export function Header({
  user,
  settings,
  unreadCount = 0,
  onOpenNotifications,
  onLogout,
}: HeaderProps) {
  const { showToast } = useToast();
  const logoSrc = settings.app_logo_url || DEFAULT_APP_LOGO;

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(user.unique_id);
      showToast(`تم نسخ المعرف الموحد ${user.unique_id}`, 'success');
    } catch {
      showToast('تعذر النسخ التلقائي، يرجى النسخ يدوياً.', 'error');
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#080C14]/92 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        {/* Brand & User Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={logoSrc}
            alt="شعار Sham Plus"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = DEFAULT_APP_LOGO;
            }}
            className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-xl object-cover border border-[#C9A227]/40 bg-[#0F1623]"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-extrabold text-white whitespace-nowrap">
                Sham Plus
              </span>
              {user.role === 'admin' && (
                <span className="text-[11px] font-bold text-[#C9A227] whitespace-nowrap">
                  · لوحة الإدارة
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 truncate">
              <span className="truncate font-medium text-slate-200 max-w-[130px] sm:max-w-[220px]">
                {user.full_name}
              </span>
              {user.role !== 'admin' && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={copyId}
                    title="نسخ المعرف الموحد"
                    className="inline-flex items-center gap-1 font-mono-num text-[11px] font-semibold text-[#C9A227] hover:text-[#E0BE53] transition-colors shrink-0"
                  >
                    <span>{user.unique_id}</span>
                    <Copy className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Balance + Notifications / Admin Logout */}
        <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
          {user.role !== 'admin' ? (
            <>
              <div className="text-left sm:text-right">
                <span className="block text-[10px] font-semibold text-slate-400">
                  الرصيد المتاح
                </span>
                <span className="block font-mono-num text-sm sm:text-base font-bold text-[#0ECB81]">
                  ${Number(user.balance).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              {onOpenNotifications && (
                <button
                  type="button"
                  onClick={onOpenNotifications}
                  aria-label="الإشعارات"
                  className="relative min-h-[40px] min-w-[40px] rounded-xl border border-slate-800 bg-[#0F1623] text-slate-300 hover:border-[#C9A227] hover:text-white transition-colors flex items-center justify-center"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F6465D] text-white font-mono-num text-[10px] font-bold flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={onLogout}
              aria-label="تسجيل الخروج"
              className="min-h-[40px] min-w-[40px] sm:px-3.5 rounded-xl border border-slate-800 bg-[#0F1623] text-xs font-semibold text-slate-300 hover:border-[#F6465D]/40 hover:text-[#F6465D] transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
