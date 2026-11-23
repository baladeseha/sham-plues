import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import type { NotificationItem } from '../types';

interface NotificationsTabProps {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  onRefresh: () => void;
  onMarkRead: (notificationId?: number) => void;
}

export function NotificationsTab({
  notifications,
  unreadCount,
  loading,
  onRefresh,
  onMarkRead,
}: NotificationsTabProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <section className="rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#C9A227]/15 text-[#C9A227] flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">قسم الإشعارات</h2>
              <p className="text-xs text-slate-400">
                الرسائل والتنبيهات الصادرة مباشرة من إدارة Sham Plus · غير مقروء:{' '}
                <span className="font-mono-num font-bold text-[#C9A227]">
                  {unreadCount}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => onMarkRead()}
                className="min-h-[40px] rounded-xl border border-[#0ECB81]/40 bg-[#0ECB81]/10 px-3.5 py-2 text-xs font-bold text-[#0ECB81] hover:bg-[#0ECB81] hover:text-[#05130D] transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <CheckCheck className="w-4 h-4" />
                <span>تحديد الكل كمقروء</span>
              </button>
            )}

            <button
              type="button"
              onClick={onRefresh}
              className="min-h-[40px] rounded-xl border border-slate-700/80 bg-[#080C14] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-[#C9A227] transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#C9A227]" />
              <span>تحديث</span>
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-xl bg-[#080C14] border border-slate-800 animate-pulse"
              />
            ))
          ) : notifications.length === 0 ? (
            <div className="rounded-xl border border-slate-800/80 bg-[#080C14]/70 p-10 text-center space-y-2">
              <Bell className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">
                لا توجد إشعارات واردة حالياً
              </p>
              <p className="text-xs text-slate-500">
                ستصل جميع رسائل وتحديثات الإدارة إلى هذا القسم فور إرسالها.
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <article
                key={item.id}
                onClick={() => {
                  if (!item.is_read) onMarkRead(item.id);
                }}
                className={`rounded-xl border p-4 transition-colors ${
                  item.is_read
                    ? 'border-slate-800/80 bg-[#080C14]/65'
                    : 'border-[#C9A227]/50 bg-[#080C14] cursor-pointer hover:border-[#C9A227]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-[#C9A227]">
                      {item.user_id === null ? 'إشعار عام من الإدارة' : 'رسالة خاصة من الإدارة'}
                    </span>
                    {!item.is_read && (
                      <>
                        <span className="text-slate-600">·</span>
                        <span className="font-bold text-[#0ECB81]">جديد</span>
                      </>
                    )}
                  </div>
                  <span className="font-mono-num text-[11px] text-slate-400">
                    {new Date(item.created_at).toLocaleString('ar-EG')}
                  </span>
                </div>

                <h3 className="text-sm sm:text-base font-bold text-white">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-300 whitespace-pre-line">
                  {item.message}
                </p>

                {!item.is_read && (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkRead(item.id);
                      }}
                      className="text-xs font-bold text-[#0ECB81] hover:underline"
                    >
                      تحديد كمقروء
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
