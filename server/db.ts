import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export interface DbUser {
  id: number;
  unique_id: string;
  full_name: string;
  national_id: string;
  phone: string;
  password_hash: string;
  shamcash_code: string;
  shamcash_qr_url: string;
  balance: number;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
  created_at: string;
}

export interface DbTransaction {
  id: number;
  user_id: number;
  type: 'deposit' | 'withdraw';
  amount: number;
  receipt_url: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string;
  created_at: string;
  updated_at: string;
}

export interface DbSettings {
  id: number;
  app_logo_url: string;
  admin_deposit_qr_url: string;
  telegram_support: string;
  youtube_video_url: string;
  admin_phone: string;
  admin_password_hash: string;
  withdrawals_enabled: boolean;
  updated_at: string;
}

export interface DbNotification {
  id: number;
  user_id: number | null;
  title: string;
  message: string;
  created_at: string;
}

export interface DbNotificationRead {
  notification_id: number;
  user_id: number;
  read_at: string;
}

interface LocalStoreData {
  nextUserId: number;
  nextTxId: number;
  nextNotificationId: number;
  users: DbUser[];
  transactions: DbTransaction[];
  notifications: DbNotification[];
  notificationReads: DbNotificationRead[];
  settings: DbSettings;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.resolve(DATA_DIR, 'sham_plus_store.json');

const DEFAULT_SETTINGS: DbSettings = {
  id: 1,
  app_logo_url: '',
  admin_deposit_qr_url: '',
  telegram_support: 'ShamPlusSupport',
  youtube_video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  admin_phone: process.env.ADMIN_PHONE || '0900000009',
  admin_password_hash: '',
  withdrawals_enabled: true,
  updated_at: new Date().toISOString(),
};

class DatabaseAdapter {
  private pool: Pool | null = null;
  private mode: 'mysql' | 'local' = 'local';
  private store: LocalStoreData = {
    nextUserId: 1,
    nextTxId: 1,
    nextNotificationId: 1,
    users: [],
    transactions: [],
    notifications: [],
    notificationReads: [],
    settings: { ...DEFAULT_SETTINGS },
  };
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._initialize();
    return this.initPromise;
  }

  private async _initialize(): Promise<void> {
    const host = process.env.MYSQL_HOST?.trim();
    const database = process.env.MYSQL_DATABASE?.trim();
    const user = process.env.MYSQL_USER?.trim();
    const password = process.env.MYSQL_PASSWORD;
    const port = Number(process.env.MYSQL_PORT || 3306);

    if (host && database && user && password !== undefined) {
      try {
        const pool = mysql.createPool({
          host,
          port,
          database,
          user,
          password,
          charset: process.env.MYSQL_CHARSET || 'utf8mb4',
          waitForConnections: true,
          connectionLimit: 5,
          connectTimeout: 4000,
        });
        await pool.query('SELECT 1');
        this.pool = pool;
        this.mode = 'mysql';
        await this.ensureMysqlSchema();
        console.log('[Sham Plus DB] Connected to MySQL:', host, database);
        return;
      } catch (err) {
        console.warn(
          '[Sham Plus DB] Remote MySQL unavailable, falling back to persistent local store:',
          err instanceof Error ? err.message : String(err)
        );
      }
    } else {
      console.log(
        '[Sham Plus DB] MySQL environment variables not set; using persistent local store.'
      );
    }

    this.mode = 'local';
    this.loadLocalStore();
  }

  getMode(): 'mysql' | 'local' {
    return this.mode;
  }

  private loadLocalStore(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_PATH)) {
      try {
        const raw = fs.readFileSync(STORE_PATH, 'utf8');
        const parsed = JSON.parse(raw) as LocalStoreData;
        if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.transactions)) {
          this.store = {
            ...parsed,
            nextNotificationId: parsed.nextNotificationId || 1,
            notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
            notificationReads: Array.isArray(parsed.notificationReads)
              ? parsed.notificationReads
              : [],
            settings: {
              ...DEFAULT_SETTINGS,
              ...(parsed.settings || {}),
            },
          };
          return;
        }
      } catch {
        // Reinitialize clean store if corrupted
      }
    }
    this.store = {
      nextUserId: 1,
      nextTxId: 1,
      nextNotificationId: 1,
      users: [],
      transactions: [],
      notifications: [],
      notificationReads: [],
      settings: {
        ...DEFAULT_SETTINGS,
        youtube_video_url: '',
      },
    };
    this.saveLocalStore();
  }

  private saveLocalStore(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpPath = path.resolve(DATA_DIR, `sham_plus_store.${process.pid}.tmp`);
    fs.writeFileSync(tmpPath, JSON.stringify(this.store, null, 2), 'utf8');
    fs.renameSync(tmpPath, STORE_PATH);
  }

  private async ensureMysqlSchema(): Promise<void> {
    if (!this.pool) return;
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        unique_id VARCHAR(32) NOT NULL UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        national_id VARCHAR(64) NOT NULL UNIQUE,
        phone VARCHAR(32) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        shamcash_code VARCHAR(128) NOT NULL,
        shamcash_qr_url VARCHAR(512) NOT NULL DEFAULT '',
        balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        role ENUM('user','admin') NOT NULL DEFAULT 'user',
        status ENUM('active','suspended') NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type ENUM('deposit','withdraw') NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        receipt_url VARCHAR(512) NOT NULL DEFAULT '',
        status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        admin_note VARCHAR(512) NOT NULL DEFAULT '',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_tx_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        id INT PRIMARY KEY,
        app_logo_url VARCHAR(512) NOT NULL DEFAULT '',
        admin_deposit_qr_url VARCHAR(512) NOT NULL DEFAULT '',
        telegram_support VARCHAR(255) NOT NULL DEFAULT 'ShamPlusSupport',
        youtube_video_url VARCHAR(512) NOT NULL DEFAULT '',
        admin_phone VARCHAR(32) NOT NULL DEFAULT '0900000009',
        admin_password_hash VARCHAR(255) NOT NULL DEFAULT '',
        withdrawals_enabled TINYINT(1) NOT NULL DEFAULT 1,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await this.pool.execute(
        'ALTER TABLE settings ADD COLUMN withdrawals_enabled TINYINT(1) NOT NULL DEFAULT 1'
      );
    } catch {
      // Column already exists
    }

    await this.pool.execute(
      `INSERT IGNORE INTO settings (id, telegram_support, admin_phone, withdrawals_enabled) VALUES (1, ?, ?, 1)`,
      ['ShamPlusSupport', process.env.ADMIN_PHONE || '0900000009']
    );

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS notification_reads (
        notification_id INT NOT NULL,
        user_id INT NOT NULL,
        read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (notification_id, user_id),
        CONSTRAINT fk_nr_notif FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
        CONSTRAINT fk_nr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  async getSettings(): Promise<DbSettings> {
    await this.init();
    if (this.mode === 'mysql' && this.pool) {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        'SELECT * FROM settings WHERE id = 1 LIMIT 1'
      );
      if (rows.length > 0) {
        const r = rows[0];
        return {
          id: Number(r.id),
          app_logo_url: String(r.app_logo_url || ''),
          admin_deposit_qr_url: String(r.admin_deposit_qr_url || ''),
          telegram_support: String(r.telegram_support || ''),
          youtube_video_url: String(r.youtube_video_url || ''),
          admin_phone: String(r.admin_phone || process.env.ADMIN_PHONE || '0900000009'),
          admin_password_hash: String(r.admin_password_hash || ''),
          withdrawals_enabled:
            r.withdrawals_enabled === undefined ? true : Boolean(Number(r.withdrawals_enabled)),
          updated_at: String(r.updated_at || new Date().toISOString()),
        };
      }
    }
    return {
      ...this.store.settings,
      withdrawals_enabled:
        this.store.settings.withdrawals_enabled === undefined
          ? true
          : Boolean(this.store.settings.withdrawals_enabled),
    };
  }

  async updateSettings(patch: Partial<DbSettings>): Promise<DbSettings> {
    await this.init();
    if (this.mode === 'mysql' && this.pool) {
      const current = await this.getSettings();
      const next = { ...current, ...patch };
      await this.pool.execute(
        `UPDATE settings SET
          app_logo_url = ?,
          admin_deposit_qr_url = ?,
          telegram_support = ?,
          youtube_video_url = ?,
          admin_phone = ?,
          admin_password_hash = ?,
          withdrawals_enabled = ?
        WHERE id = 1`,
        [
          next.app_logo_url,
          next.admin_deposit_qr_url,
          next.telegram_support,
          next.youtube_video_url,
          next.admin_phone,
          next.admin_password_hash,
          next.withdrawals_enabled ? 1 : 0,
        ]
      );
      return this.getSettings();
    }

    this.store.settings = {
      ...this.store.settings,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    this.saveLocalStore();
    return { ...this.store.settings };
  }

  async findUserByPhone(phone: string): Promise<DbUser | null> {
    await this.init();
    if (this.mode === 'mysql' && this.pool) {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        'SELECT * FROM users WHERE phone = ? LIMIT 1',
        [phone]
      );
      return rows.length > 0 ? this.mapMysqlUser(rows[0]) : null;
    }
    const found = this.store.users.find((u) => u.phone === phone);
    return found ? { ...found } : null;
  }

  async findUserByNationalId(nationalId: string): Promise<DbUser | null> {
    await this.init();
    if (this.mode === 'mysql' && this.pool) {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        'SELECT * FROM users WHERE national_id = ? LIMIT 1',
        [nationalId]
      );
      return rows.length > 0 ? this.mapMysqlUser(rows[0]) : null;
    }
    const found = this.store.users.find((u) => u.national_id === nationalId);
    return found ? { ...found } : null;
  }

  async findUserById(id: number): Promise<DbUser | null> {
    await this.init();
    if (this.mode === 'mysql' && this.pool) {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        'SELECT * FROM users WHERE id = ? LIMIT 1',
        [id]
      );
      return rows.length > 0 ? this.mapMysqlUser(rows[0]) : null;
    }
    const found = this.store.users.find((u) => u.id === id);
    return found ? { ...found } : null;
  }

  async createUser(input: {
    full_name: string;
    national_id: string;
    phone: string;
    password_hash: string;
    shamcash_code: string;
    shamcash_qr_url: string;
  }): Promise<DbUser> {
    await this.init();
    if (this.mode === 'mysql' && this.pool) {
      const conn = await this.pool.getConnection();
      try {
        await conn.beginTransaction();
        const [maxRows] = await conn.execute<RowDataPacket[]>(
          'SELECT COALESCE(MAX(id), 0) AS max_id FROM users'
        );
        const nextNum = 1001 + Number(maxRows[0]?.max_id || 0);
        const tempUniqueId = `SP-${nextNum}`;
        const [result] = await conn.execute<ResultSetHeader>(
          `INSERT INTO users (unique_id, full_name, national_id, phone, password_hash, shamcash_code, shamcash_qr_url, balance, role, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0.00, 'user', 'active')`,
          [
            tempUniqueId,
            input.full_name,
            input.national_id,
            input.phone,
            input.password_hash,
            input.shamcash_code,
            input.shamcash_qr_url,
          ]
        );
        const finalUniqueId = `SP-${1000 + result.insertId}`;
        await conn.execute('UPDATE users SET unique_id = ? WHERE id = ?', [
          finalUniqueId,
          result.insertId,
        ]);
        await conn.commit();
        const created = await this.findUserById(result.insertId);
        if (!created) throw new Error('Failed to load created user');
        return created;
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    const id = this.store.nextUserId++;
    const user: DbUser = {
      id,
      unique_id: `SP-${1000 + id}`,
      full_name: input.full_name,
      national_id: input.national_id,
      phone: input.phone,
      password_hash: input.password_hash,
      shamcash_code: input.shamcash_code,
      shamcash_qr_url: input.shamcash_qr_url,
      balance: 0,
      role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
    };
    this.store.users.push(user);
    this.saveLocalStore();
    return { ...user };
  }

  async listUsers(search?: string): Promise<DbUser[]> {
    await this.init();
    const q = search?.trim().toLowerCase() || '';
    if (this.mode === 'mysql' && this.pool) {
      if (q) {
        const like = `%${q}%`;
        const [rows] = await this.pool.execute<RowDataPacket[]>(
          `SELECT * FROM users WHERE role = 'user' AND (LOWER(full_name) LIKE ? OR LOWER(unique_id) LIKE ? OR phone LIKE ?) ORDER BY id DESC`,
          [like, like, like]
        );
        return rows.map((r) => this.mapMysqlUser(r));
      }
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM users WHERE role = 'user' ORDER BY id DESC`
      );
      return rows.map((r) => this.mapMysqlUser(r));
    }

    return this.store.users
      .filter((u) => u.role === 'user')
      .filter((u) => {
        if (!q) return true;
        return (
          u.full_name.toLowerCase().includes(q) ||
          u.unique_id.toLowerCase().includes(q) ||
          u.phone.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.id - a.id)
      .map((u) => ({ ...u }));
  }

  async updateUserAdmin(
    userId: number,
    patch: { balance?: number; status?: 'active' | 'suspended' }
  ): Promise<DbUser | null> {
    await this.init();
    if (this.mode === 'mysql' && this.pool) {
      const existing = await this.findUserById(userId);
      if (!existing) return null;
      const nextBalance =
        patch.balance !== undefined ? Number(patch.balance) : existing.balance;
      const nextStatus = patch.status || existing.status;
      await this.pool.execute(
        'UPDATE users SET balance = ?, status = ? WHERE id = ?',
        [nextBalance, nextStatus, userId]
      );
      return this.findUserById(userId);
    }

    const idx = this.store.users.findIndex((u) => u.id === userId);
    if (idx === -1) return null;
    if (patch.balance !== undefined) {
      this.store.users[idx].balance = Number(patch.balance);
    }
    if (patch.status) {
      this.store.users[idx].status = patch.status;
    }
    this.saveLocalStore();
    return { ...this.store.users[idx] };
  }

  async addProfitToAllUsers(
    amount: number
  ): Promise<{ updatedCount: number; totalAdded: number }> {
    await this.init();
    const cleanAmount = Number(amount.toFixed(2));
    if (this.mode === 'mysql' && this.pool) {
      const conn = await this.pool.getConnection();
      try {
        await conn.beginTransaction();
        const [result] = await conn.execute<ResultSetHeader>(
          "UPDATE users SET balance = ROUND(balance + ?, 2) WHERE role = 'user'",
          [cleanAmount]
        );
        await conn.commit();
        const updatedCount = Number(result.affectedRows || 0);
        return {
          updatedCount,
          totalAdded: Number((updatedCount * cleanAmount).toFixed(2)),
        };
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    let updatedCount = 0;
    for (let i = 0; i < this.store.users.length; i++) {
      if (this.store.users[i].role === 'user') {
        this.store.users[i].balance = Number(
          (Number(this.store.users[i].balance) + cleanAmount).toFixed(2)
        );
        updatedCount++;
      }
    }
    this.saveLocalStore();
    return {
      updatedCount,
      totalAdded: Number((updatedCount * cleanAmount).toFixed(2)),
    };
  }

  async createTransaction(input: {
    user_id: number;
    type: 'deposit' | 'withdraw';
    amount: number;
    receipt_url: string;
  }): Promise<DbTransaction> {
    await this.init();
    if (this.mode === 'mysql' && this.pool) {
      const [result] = await this.pool.execute<ResultSetHeader>(
        `INSERT INTO transactions (user_id, type, amount, receipt_url, status, admin_note)
         VALUES (?, ?, ?, ?, 'pending', '')`,
        [input.user_id, input.type, input.amount, input.receipt_url]
      );
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        'SELECT * FROM transactions WHERE id = ? LIMIT 1',
        [result.insertId]
      );
      return this.mapMysqlTx(rows[0]);
    }

    const now = new Date().toISOString();
    const tx: DbTransaction = {
      id: this.store.nextTxId++,
      user_id: input.user_id,
      type: input.type,
      amount: Number(input.amount),
      receipt_url: input.receipt_url,
      status: 'pending',
      admin_note: '',
      created_at: now,
      updated_at: now,
    };
    this.store.transactions.push(tx);
    this.saveLocalStore();
    return { ...tx };
  }

  async listUserTransactions(userId: number): Promise<DbTransaction[]> {
    await this.init();
    if (this.mode === 'mysql' && this.pool) {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        'SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC',
        [userId]
      );
      return rows.map((r) => this.mapMysqlTx(r));
    }
    return this.store.transactions
      .filter((t) => t.user_id === userId)
      .sort((a, b) => b.id - a.id)
      .map((t) => ({ ...t }));
  }

  async listAdminTransactions(filters: {
    search?: string;
    type?: string;
    status?: string;
  }): Promise<
    Array<
      DbTransaction & {
        user_unique_id: string;
        user_full_name: string;
        user_phone: string;
        user_shamcash_code: string;
        user_balance: number;
      }
    >
  > {
    await this.init();
    const q = filters.search?.trim().toLowerCase() || '';
    const type = filters.type && filters.type !== 'all' ? filters.type : '';
    const status = filters.status && filters.status !== 'all' ? filters.status : '';

    if (this.mode === 'mysql' && this.pool) {
      let sql = `
        SELECT t.*, u.unique_id AS user_unique_id, u.full_name AS user_full_name,
               u.phone AS user_phone, u.shamcash_code AS user_shamcash_code,
               u.balance AS user_balance
        FROM transactions t
        INNER JOIN users u ON u.id = t.user_id
        WHERE 1=1
      `;
      const params: Array<string | number> = [];
      if (type) {
        sql += ' AND t.type = ?';
        params.push(type);
      }
      if (status) {
        sql += ' AND t.status = ?';
        params.push(status);
      }
      if (q) {
        const like = `%${q}%`;
        sql +=
          ' AND (LOWER(u.full_name) LIKE ? OR LOWER(u.unique_id) LIKE ? OR u.phone LIKE ?)';
        params.push(like, like, like);
      }
      sql += ' ORDER BY t.id DESC';
      const [rows] = await this.pool.execute<RowDataPacket[]>(sql, params);
      return rows.map((r) => ({
        ...this.mapMysqlTx(r),
        user_unique_id: String(r.user_unique_id),
        user_full_name: String(r.user_full_name),
        user_phone: String(r.user_phone),
        user_shamcash_code: String(r.user_shamcash_code),
        user_balance: Number(r.user_balance),
      }));
    }

    const userMap = new Map(this.store.users.map((u) => [u.id, u]));
    return this.store.transactions
      .map((t) => {
        const u = userMap.get(t.user_id);
        return {
          ...t,
          user_unique_id: u?.unique_id || 'N/A',
          user_full_name: u?.full_name || 'مستخدم غير معروف',
          user_phone: u?.phone || '',
          user_shamcash_code: u?.shamcash_code || '',
          user_balance: u?.balance || 0,
        };
      })
      .filter((item) => {
        if (type && item.type !== type) return false;
        if (status && item.status !== status) return false;
        if (q) {
          const hit =
            item.user_full_name.toLowerCase().includes(q) ||
            item.user_unique_id.toLowerCase().includes(q) ||
            item.user_phone.toLowerCase().includes(q);
          if (!hit) return false;
        }
        return true;
      })
      .sort((a, b) => b.id - a.id);
  }

  async processTransactionAction(input: {
    transaction_id: number;
    action: 'approve' | 'reject';
    amount?: number;
    admin_note?: string;
  }): Promise<{ tx: DbTransaction; userBalance: number }> {
    await this.init();
    if (this.mode === 'mysql' && this.pool) {
      const conn = await this.pool.getConnection();
      try {
        await conn.beginTransaction();
        const [txRows] = await conn.execute<RowDataPacket[]>(
          'SELECT * FROM transactions WHERE id = ? FOR UPDATE',
          [input.transaction_id]
        );
        if (txRows.length === 0) {
          throw new Error('TX_NOT_FOUND');
        }
        const tx = this.mapMysqlTx(txRows[0]);
        if (tx.status !== 'pending') {
          throw new Error('TX_ALREADY_PROCESSED');
        }
        const [uRows] = await conn.execute<RowDataPacket[]>(
          'SELECT * FROM users WHERE id = ? FOR UPDATE',
          [tx.user_id]
        );
        if (uRows.length === 0) {
          throw new Error('USER_NOT_FOUND');
        }
        const user = this.mapMysqlUser(uRows[0]);
        const finalAmount =
          input.amount !== undefined && input.amount > 0
            ? Number(input.amount)
            : tx.amount;

        let newBalance = user.balance;
        const nextStatus = input.action === 'approve' ? 'approved' : 'rejected';

        if (input.action === 'approve') {
          if (tx.type === 'deposit') {
            newBalance = Number((user.balance + finalAmount).toFixed(2));
          } else {
            if (user.balance < finalAmount) {
              throw new Error('INSUFFICIENT_BALANCE');
            }
            newBalance = Number((user.balance - finalAmount).toFixed(2));
          }
          await conn.execute('UPDATE users SET balance = ? WHERE id = ?', [
            newBalance,
            user.id,
          ]);
        }

        await conn.execute(
          'UPDATE transactions SET amount = ?, status = ?, admin_note = ? WHERE id = ?',
          [finalAmount, nextStatus, input.admin_note || '', tx.id]
        );

        await conn.commit();
        const [updatedRows] = await this.pool.execute<RowDataPacket[]>(
          'SELECT * FROM transactions WHERE id = ? LIMIT 1',
          [tx.id]
        );
        return {
          tx: this.mapMysqlTx(updatedRows[0]),
          userBalance: newBalance,
        };
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    const txIdx = this.store.transactions.findIndex(
      (t) => t.id === input.transaction_id
    );
    if (txIdx === -1) throw new Error('TX_NOT_FOUND');
    const tx = this.store.transactions[txIdx];
    if (tx.status !== 'pending') throw new Error('TX_ALREADY_PROCESSED');

    const userIdx = this.store.users.findIndex((u) => u.id === tx.user_id);
    if (userIdx === -1) throw new Error('USER_NOT_FOUND');
    const user = this.store.users[userIdx];

    const finalAmount =
      input.amount !== undefined && input.amount > 0
        ? Number(input.amount)
        : tx.amount;

    let newBalance = user.balance;
    if (input.action === 'approve') {
      if (tx.type === 'deposit') {
        newBalance = Number((user.balance + finalAmount).toFixed(2));
      } else {
        if (user.balance < finalAmount) {
          throw new Error('INSUFFICIENT_BALANCE');
        }
        newBalance = Number((user.balance - finalAmount).toFixed(2));
      }
      this.store.users[userIdx].balance = newBalance;
    }

    this.store.transactions[txIdx] = {
      ...tx,
      amount: finalAmount,
      status: input.action === 'approve' ? 'approved' : 'rejected',
      admin_note: input.admin_note || '',
      updated_at: new Date().toISOString(),
    };
    this.saveLocalStore();
    return {
      tx: { ...this.store.transactions[txIdx] },
      userBalance: newBalance,
    };
  }

  async getAdminStats(): Promise<{
    total_users: number;
    total_balances: number;
    pending_count: number;
  }> {
    await this.init();
    if (this.mode === 'mysql' && this.pool) {
      const [uStats] = await this.pool.execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS total_users, COALESCE(SUM(balance), 0) AS total_balances FROM users WHERE role = 'user'"
      );
      const [tStats] = await this.pool.execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS pending_count FROM transactions WHERE status = 'pending'"
      );
      return {
        total_users: Number(uStats[0]?.total_users || 0),
        total_balances: Number(uStats[0]?.total_balances || 0),
        pending_count: Number(tStats[0]?.pending_count || 0),
      };
    }

    const regularUsers = this.store.users.filter((u) => u.role === 'user');
    return {
      total_users: regularUsers.length,
      total_balances: Number(
        regularUsers.reduce((sum, u) => sum + Number(u.balance), 0).toFixed(2)
      ),
      pending_count: this.store.transactions.filter((t) => t.status === 'pending')
        .length,
    };
  }

  async createNotification(input: {
    user_id: number | null;
    title: string;
    message: string;
  }): Promise<DbNotification> {
    await this.init();
    if (this.mode === 'mysql' && this.pool) {
      const [result] = await this.pool.execute<ResultSetHeader>(
        'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
        [input.user_id, input.title, input.message]
      );
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        'SELECT * FROM notifications WHERE id = ? LIMIT 1',
        [result.insertId]
      );
      const r = rows[0];
      return {
        id: Number(r.id),
        user_id: r.user_id === null ? null : Number(r.user_id),
        title: String(r.title),
        message: String(r.message),
        created_at: String(r.created_at),
      };
    }

    const notif: DbNotification = {
      id: this.store.nextNotificationId++,
      user_id: input.user_id,
      title: input.title,
      message: input.message,
      created_at: new Date().toISOString(),
    };
    this.store.notifications.push(notif);
    this.saveLocalStore();
    return { ...notif };
  }

  async listAdminNotifications(): Promise<
    Array<DbNotification & { target_label: string }>
  > {
    await this.init();
    if (this.mode === 'mysql' && this.pool) {
      const [rows] = await this.pool.execute<RowDataPacket[]>(`
        SELECT n.*, u.full_name AS target_name, u.unique_id AS target_unique_id
        FROM notifications n
        LEFT JOIN users u ON u.id = n.user_id
        ORDER BY n.id DESC
        LIMIT 100
      `);
      return rows.map((r) => ({
        id: Number(r.id),
        user_id: r.user_id === null ? null : Number(r.user_id),
        title: String(r.title),
        message: String(r.message),
        created_at: String(r.created_at),
        target_label:
          r.user_id === null
            ? 'جميع العملاء'
            : `${String(r.target_name || 'عميل')} (${String(r.target_unique_id || '')})`,
      }));
    }

    const userMap = new Map(this.store.users.map((u) => [u.id, u]));
    return [...this.store.notifications]
      .sort((a, b) => b.id - a.id)
      .slice(0, 100)
      .map((n) => {
        const u = n.user_id !== null ? userMap.get(n.user_id) : undefined;
        return {
          ...n,
          target_label:
            n.user_id === null
              ? 'جميع العملاء'
              : u
              ? `${u.full_name} (${u.unique_id})`
              : `عميل #${n.user_id}`,
        };
      });
  }

  async listUserNotifications(
    userId: number
  ): Promise<Array<DbNotification & { is_read: boolean }>> {
    await this.init();
    if (this.mode === 'mysql' && this.pool) {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `
        SELECT n.*, IF(nr.user_id IS NULL, 0, 1) AS is_read
        FROM notifications n
        LEFT JOIN notification_reads nr
          ON nr.notification_id = n.id AND nr.user_id = ?
        WHERE n.user_id IS NULL OR n.user_id = ?
        ORDER BY n.id DESC
        LIMIT 100
      `,
        [userId, userId]
      );
      return rows.map((r) => ({
        id: Number(r.id),
        user_id: r.user_id === null ? null : Number(r.user_id),
        title: String(r.title),
        message: String(r.message),
        created_at: String(r.created_at),
        is_read: Boolean(Number(r.is_read)),
      }));
    }

    const readSet = new Set(
      this.store.notificationReads
        .filter((nr) => nr.user_id === userId)
        .map((nr) => nr.notification_id)
    );
    return this.store.notifications
      .filter((n) => n.user_id === null || n.user_id === userId)
      .sort((a, b) => b.id - a.id)
      .slice(0, 100)
      .map((n) => ({
        ...n,
        is_read: readSet.has(n.id),
      }));
  }

  async markNotificationRead(
    userId: number,
    notificationId?: number
  ): Promise<void> {
    await this.init();
    if (this.mode === 'mysql' && this.pool) {
      if (notificationId) {
        await this.pool.execute(
          `INSERT IGNORE INTO notification_reads (notification_id, user_id)
           SELECT id, ? FROM notifications
           WHERE id = ? AND (user_id IS NULL OR user_id = ?)`,
          [userId, notificationId, userId]
        );
      } else {
        await this.pool.execute(
          `INSERT IGNORE INTO notification_reads (notification_id, user_id)
           SELECT id, ? FROM notifications
           WHERE user_id IS NULL OR user_id = ?`,
          [userId, userId]
        );
      }
      return;
    }

    const now = new Date().toISOString();
    const existingSet = new Set(
      this.store.notificationReads
        .filter((nr) => nr.user_id === userId)
        .map((nr) => nr.notification_id)
    );
    const targets = this.store.notifications.filter(
      (n) =>
        (n.user_id === null || n.user_id === userId) &&
        (!notificationId || n.id === notificationId)
    );
    let changed = false;
    for (const n of targets) {
      if (!existingSet.has(n.id)) {
        this.store.notificationReads.push({
          notification_id: n.id,
          user_id: userId,
          read_at: now,
        });
        changed = true;
      }
    }
    if (changed) this.saveLocalStore();
  }

  private mapMysqlUser(r: RowDataPacket): DbUser {
    return {
      id: Number(r.id),
      unique_id: String(r.unique_id),
      full_name: String(r.full_name),
      national_id: String(r.national_id),
      phone: String(r.phone),
      password_hash: String(r.password_hash),
      shamcash_code: String(r.shamcash_code),
      shamcash_qr_url: String(r.shamcash_qr_url || ''),
      balance: Number(r.balance || 0),
      role: r.role === 'admin' ? 'admin' : 'user',
      status: r.status === 'suspended' ? 'suspended' : 'active',
      created_at: String(r.created_at),
    };
  }

  private mapMysqlTx(r: RowDataPacket): DbTransaction {
    return {
      id: Number(r.id),
      user_id: Number(r.user_id),
      type: r.type === 'withdraw' ? 'withdraw' : 'deposit',
      amount: Number(r.amount),
      receipt_url: String(r.receipt_url || ''),
      status:
        r.status === 'approved'
          ? 'approved'
          : r.status === 'rejected'
          ? 'rejected'
          : 'pending',
      admin_note: String(r.admin_note || ''),
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };
  }
}

export const db = new DatabaseAdapter();
