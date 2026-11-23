import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Home,
  ArrowLeftRight,
  Bell,
  User as UserIcon,
  MessageCircle,
} from 'lucide-react';
import { api, setAuthToken } from './api/client';
import type {
  AppSettings,
  NotificationItem,
  TransactionRecord,
  UserProfile,
  UserTab,
} from './types';
import { ToastProvider, useToast } from './components/ToastContext';
import { AuthScreen } from './components/AuthScreen';
import { Header } from './components/Header';
import { HomeTab } from './components/HomeTab';
import { WalletTab } from './components/WalletTab';
import { NotificationsTab } from './components/NotificationsTab';
import { ProfileTab } from './components/ProfileTab';
import { SupportTab } from './components/SupportTab';
import { AdminDashboard } from './components/AdminDashboard';
import { ImageLightbox } from './components/ConfirmModal';

const INITIAL_SETTINGS: AppSettings = {
  app_logo_url: '',
  admin_deposit_qr_url: '',
  telegram_support: 'ShamPlusSupport',
  youtube_video_url: '',
  withdrawals_enabled: true,
};

function ShamPlusApp() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<UserTab>('home');
  const [lightbox, setLightbox] = useState<{ src: string; title: string } | null>(
    null
  );
  const latestNotifIdRef = useRef<number>(0);

  const loadSettings = useCallback(async () => {
    try {
      const res = await api.getSettings();
      setSettings(res.settings);
    } catch {
      // Keep default settings if offline
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const loadNotifications = useCallback(
    async (notifyOnNew = false) => {
      setNotifLoading(true);
      try {
        const res = await api.getNotifications();
        setNotifications(res.notifications);
        setUnreadCount(res.unread_count);
        const topItem = res.notifications[0];
        if (topItem) {
          if (
            notifyOnNew &&
            latestNotifIdRef.current > 0 &&
            topItem.id > latestNotifIdRef.current &&
            !topItem.is_read
          ) {
            showToast(`إشعار جديد من الإدارة: ${topItem.title}`, 'info');
          }
          latestNotifIdRef.current = Math.max(
            latestNotifIdRef.current,
            topItem.id
          );
        }
      } catch {
        // Ignore transient notification fetch error
      } finally {
        setNotifLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (!user || user.role === 'admin') return;
    const timer = window.setInterval(() => {
      loadNotifications(true);
    }, 20000);
    return () => window.clearInterval(timer);
  }, [user, loadNotifications]);

  const refreshUserProfile = useCallback(
    async (userId: number) => {
      setProfileLoading(true);
      try {
        const res = await api.getUserProfile(userId);
        setUser(res.user);
        setTransactions(res.transactions);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'تعذر تحديث بيانات المحفظة.',
          'error'
        );
      } finally {
        setProfileLoading(false);
      }
    },
    [showToast]
  );

  const handleAuthenticated = async (token: string, loggedUser: UserProfile) => {
    setAuthToken(token);
    setUser(loggedUser);
    setActiveTab('home');
    latestNotifIdRef.current = 0;
    await loadSettings();
    if (loggedUser.role !== 'admin') {
      await Promise.all([
        refreshUserProfile(loggedUser.id),
        loadNotifications(false),
      ]);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    setTransactions([]);
    setNotifications([]);
    setUnreadCount(0);
    latestNotifIdRef.current = 0;
    setActiveTab('home');
    showToast('تم تسجيل الخروج بنجاح.', 'info');
  };

  const handleTabChange = (tab: UserTab) => {
    setActiveTab(tab);
    loadSettings();
    if (user && user.role !== 'admin') {
      if (tab === 'wallet' || tab === 'profile') {
        refreshUserProfile(user.id);
      }
      if (tab === 'notifications') {
        loadNotifications(false);
      }
    }
  };

  const handleMarkNotificationsRead = async (notificationId?: number) => {
    try {
      await api.markNotificationsRead(
        notificationId ? { notification_id: notificationId } : { mark_all: true }
      );
      await loadNotifications(false);
    } catch {
      showToast('تعذر تحديث حالة الإشعار.', 'error');
    }
  };

  if (!user) {
    return (
      <AuthScreen
        settings={settings}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#080C14] text-slate-100 flex flex-col">
      <Header
        user={user}
        settings={settings}
        unreadCount={unreadCount}
        onOpenNotifications={() => handleTabChange('notifications')}
        onLogout={handleLogout}
      />

      <main
        className={`flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 ${
          user.role === 'admin' ? 'pb-10' : 'pb-24'
        }`}
      >
        {user.role === 'admin' ? (
          <AdminDashboard
            settings={settings}
            onSettingsUpdated={setSettings}
            onPreviewImage={(src, title) => setLightbox({ src, title })}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'home' && (
                <HomeTab
                  settings={settings}
                  onGoToWallet={() => handleTabChange('wallet')}
                />
              )}
              {activeTab === 'wallet' && (
                <WalletTab
                  user={user}
                  settings={settings}
                  transactions={transactions}
                  loading={profileLoading}
                  onTransactionCreated={() => refreshUserProfile(user.id)}
                  onPreviewImage={(src, title) => setLightbox({ src, title })}
                />
              )}
              {activeTab === 'notifications' && (
                <NotificationsTab
                  notifications={notifications}
                  unreadCount={unreadCount}
                  loading={notifLoading}
                  onRefresh={() => loadNotifications(false)}
                  onMarkRead={handleMarkNotificationsRead}
                />
              )}
              {activeTab === 'profile' && (
                <ProfileTab
                  user={user}
                  onPreviewImage={(src, title) => setLightbox({ src, title })}
                  onLogout={handleLogout}
                />
              )}
              {activeTab === 'support' && (
                <SupportTab settings={settings} user={user} />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Fixed Bottom Navigation Bar for Customers */}
      {user.role !== 'admin' && (
        <nav
          aria-label="التنقل الرئيسي"
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800/90 bg-[#0B101B]/95 backdrop-blur-md"
        >
          <div className="mx-auto grid max-w-2xl grid-cols-5 h-16">
            {[
              { id: 'home' as const, label: 'الرئيسية', icon: Home, badge: 0 },
              {
                id: 'wallet' as const,
                label: 'الإيداع والسحب',
                icon: ArrowLeftRight,
                badge: 0,
              },
              {
                id: 'notifications' as const,
                label: 'الإشعارات',
                icon: Bell,
                badge: unreadCount,
              },
              {
                id: 'profile' as const,
                label: 'ملفي',
                icon: UserIcon,
                badge: 0,
              },
              {
                id: 'support' as const,
                label: 'تواصل معنا',
                icon: MessageCircle,
                badge: 0,
              },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabChange(item.id)}
                  className={`relative flex flex-col items-center justify-center gap-1 min-h-[44px] transition-colors ${
                    isActive
                      ? 'text-[#C9A227]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" />
                    {item.badge > 0 && (
                      <span className="absolute -top-1.5 -left-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[#F6465D] text-white font-mono-num text-[9px] font-bold flex items-center justify-center">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-bold whitespace-nowrap">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <ImageLightbox
        src={lightbox?.src || null}
        title={lightbox?.title || ''}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ShamPlusApp />
    </ToastProvider>
  );
}
