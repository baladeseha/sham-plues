import type {
  AdminNotificationItem,
  AdminStats,
  AdminTransactionRecord,
  AppSettings,
  MarketNewsItem,
  NotificationItem,
  TransactionRecord,
  UserProfile,
} from '../types';

let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({
    success: false,
    message: 'استجابة غير متوقعة من الخادم.',
  }));

  if (!res.ok || data.success === false) {
    const err = new Error(data.message || 'تعذر إتمام الطلب.') as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  return data as T;
}

export const api = {
  login: (phone: string, password: string) =>
    requestJson<{
      success: boolean;
      redirect: 'admin' | 'user';
      token: string;
      user: UserProfile;
    }>('/api/login.php', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    }),

  register: (formData: FormData) =>
    requestJson<{
      success: boolean;
      message: string;
      token: string;
      user: UserProfile;
    }>('/api/register.php', {
      method: 'POST',
      body: formData,
    }),

  getUserProfile: (userId: number) =>
    requestJson<{
      success: boolean;
      user: UserProfile;
      transactions: TransactionRecord[];
    }>(`/api/user_profile.php?user_id=${encodeURIComponent(userId)}`),

  createTransaction: (formData: FormData) =>
    requestJson<{
      success: boolean;
      message: string;
      transaction: TransactionRecord;
    }>('/api/transactions_create.php', {
      method: 'POST',
      body: formData,
    }),

  getSettings: () =>
    requestJson<{
      success: boolean;
      settings: AppSettings;
    }>('/api/settings.php'),

  updateSettings: (formData: FormData) =>
    requestJson<{
      success: boolean;
      message: string;
      settings: AppSettings;
    }>('/api/settings.php', {
      method: 'POST',
      body: formData,
    }),

  getAdminTransactions: (params: {
    search?: string;
    type?: string;
    status?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.type) qs.set('type', params.type);
    if (params.status) qs.set('status', params.status);
    return requestJson<{
      success: boolean;
      transactions: AdminTransactionRecord[];
      stats: AdminStats;
    }>(`/api/admin_transactions.php?${qs.toString()}`);
  },

  processAdminTxAction: (payload: {
    transaction_id: number;
    action: 'approve' | 'reject';
    amount?: number;
    admin_note?: string;
  }) =>
    requestJson<{
      success: boolean;
      message: string;
      transaction: TransactionRecord;
      user_balance: number;
    }>('/api/admin_tx_action.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAdminUsers: (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return requestJson<{
      success: boolean;
      users: UserProfile[];
      stats: AdminStats;
    }>(`/api/admin_users.php${qs}`);
  },

  updateAdminUser: (payload: {
    user_id: number;
    balance?: number;
    status?: 'active' | 'suspended';
  }) =>
    requestJson<{
      success: boolean;
      message: string;
      user: UserProfile;
    }>('/api/admin_users.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  addBulkProfit: (amount: number) =>
    requestJson<{
      success: boolean;
      message: string;
      updated_count: number;
      total_added: number;
    }>('/api/admin_bulk_profit.php', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  getMarketNews: (refresh = false) =>
    requestJson<{
      success: boolean;
      items: MarketNewsItem[];
    }>(`/api/market_news.php${refresh ? '?refresh=1' : ''}`),

  getGoldChart: (interval = '60') =>
    requestJson<{
      success: boolean;
      symbol: string;
      price: number;
      previousClose: number;
      change: number;
      changePercent: number;
      high: number;
      low: number;
      candles: Array<{
        time: number;
        open: number;
        high: number;
        low: number;
        close: number;
      }>;
    }>(`/api/gold_chart.php?interval=${encodeURIComponent(interval)}`),

  getNotifications: () =>
    requestJson<{
      success: boolean;
      notifications: NotificationItem[];
      unread_count: number;
    }>('/api/notifications.php'),

  markNotificationsRead: (payload: {
    notification_id?: number;
    mark_all?: boolean;
  }) =>
    requestJson<{ success: boolean }>('/api/notifications_read.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAdminNotifications: () =>
    requestJson<{
      success: boolean;
      notifications: AdminNotificationItem[];
    }>('/api/admin_notifications.php'),

  sendAdminNotification: (payload: {
    title: string;
    message: string;
    target_user_id: string | number;
  }) =>
    requestJson<{
      success: boolean;
      message: string;
      notification: AdminNotificationItem;
    }>('/api/admin_notifications.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
