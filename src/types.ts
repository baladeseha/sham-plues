export type UserRole = 'user' | 'admin';
export type AccountStatus = 'active' | 'suspended';
export type TransactionType = 'deposit' | 'withdraw';
export type TransactionStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  id: number;
  unique_id: string;
  full_name: string;
  national_id: string;
  phone: string;
  shamcash_code: string;
  shamcash_qr_url: string;
  balance: number;
  role: UserRole;
  status: AccountStatus;
  created_at: string;
}

export interface TransactionRecord {
  id: number;
  user_id: number;
  type: TransactionType;
  amount: number;
  receipt_url: string;
  status: TransactionStatus;
  admin_note: string;
  created_at: string;
  updated_at: string;
}

export interface AdminTransactionRecord extends TransactionRecord {
  user_unique_id: string;
  user_full_name: string;
  user_phone: string;
  user_shamcash_code: string;
  user_balance: number;
}

export interface AppSettings {
  app_logo_url: string;
  admin_deposit_qr_url: string;
  telegram_support: string;
  youtube_video_url: string;
  withdrawals_enabled: boolean;
}

export interface AdminStats {
  total_users: number;
  total_balances: number;
  pending_count: number;
}

export interface MarketNewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  category: string;
  published_at: string;
  url: string;
}

export interface NotificationItem {
  id: number;
  user_id: number | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface AdminNotificationItem {
  id: number;
  user_id: number | null;
  target_label: string;
  title: string;
  message: string;
  created_at: string;
}

export type UserTab = 'home' | 'wallet' | 'notifications' | 'profile' | 'support';
export type AdminTab = 'transactions' | 'users' | 'notifications' | 'settings';
