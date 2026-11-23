import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import {
  hashPassword,
  requireAdmin,
  requireAuth,
  signToken,
  verifyPassword,
  type AuthenticatedRequest,
} from './server/auth.ts';
import { db, type DbUser } from './server/db.ts';

const PORT = Number(process.env.PORT || 3000);
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_IMAGE_MIME = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = ALLOWED_IMAGE_MIME.get(file.mimetype) || '.jpg';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('يُسمح فقط برفع صور بصيغة JPG أو PNG أو WEBP.'));
    }
  },
});

function sanitizeUser(user: DbUser) {
  const { password_hash: _ph, ...safe } = user;
  return safe;
}

function normalizeYouTubeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    const host = parsed.hostname.toLowerCase();
    let videoId = '';
    if (host === 'youtu.be') {
      videoId = parsed.pathname.slice(1).split('/')[0] || '';
    } else if (
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com'
    ) {
      if (parsed.pathname === '/watch') {
        videoId = parsed.searchParams.get('v') || '';
      } else if (parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.split('/')[2] || '';
      } else if (parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.split('/')[2] || '';
      }
    }
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return '';
    return `https://www.youtube.com/watch?v=${videoId}`;
  } catch {
    return '';
  }
}

function sanitizeTelegramHandle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  let handle = trimmed
    .replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '')
    .replace(/^@+/, '')
    .split(/[/?#]/)[0] || '';
  handle = handle.replace(/[^a-zA-Z0-9_]/g, '');
  return handle;
}

// Live economic news cache (10 minutes)
interface MarketNewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  category: string;
  published_at: string;
  url: string;
}

let newsCache: { items: MarketNewsItem[]; fetchedAt: number } | null = null;

function stripXmlTags(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

async function fetchLatestEconomicNews(): Promise<MarketNewsItem[]> {
  const now = Date.now();
  if (newsCache && now - newsCache.fetchedAt < 10 * 60 * 1000) {
    return newsCache.items;
  }

  const feeds = [
    {
      url: 'https://sa.investing.com/rss/news_25.rss',
      source: 'Investing العربية',
      category: 'السلع والذهب',
    },
    {
      url: 'https://sa.investing.com/rss/news_1.rss',
      source: 'Investing العربية',
      category: 'العملات والفوركس',
    },
    {
      url: 'https://www.aljazeera.net/aljazeerarss/ebusiness',
      source: 'الجزيرة اقتصاد',
      category: 'البورصة العالمية',
    },
  ];

  for (const feed of feeds) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const resp = await fetch(feed.url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'ShamPlusMarketReader/1.0' },
      });
      clearTimeout(timer);
      if (!resp.ok) continue;
      const xml = await resp.text();
      const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 4);
      if (itemMatches.length >= 2) {
        const items: MarketNewsItem[] = itemMatches.map((m, idx) => {
          const block = m[1];
          const title = stripXmlTags(
            block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || 'خبر اقتصادي عاجل'
          );
          const descRaw = stripXmlTags(
            block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || ''
          );
          const pubDate = stripXmlTags(
            block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || ''
          );
          const link = stripXmlTags(
            block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || ''
          );
          const safeUrl =
            link.startsWith('https://') || link.startsWith('http://') ? link : '#';
          return {
            id: `rss-${idx}-${Date.now()}`,
            title,
            summary:
              descRaw.length > 140 ? `${descRaw.slice(0, 140)}...` : descRaw || title,
            source: feed.source,
            category: feed.category,
            published_at: pubDate
              ? new Date(pubDate).toLocaleString('ar-EG', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'محدث الآن',
            url: safeUrl,
          };
        });
        newsCache = { items, fetchedAt: now };
        return items;
      }
    } catch {
      // Continue to next feed or fallback
    }
  }

  const timestampLabel = new Date().toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const fallback: MarketNewsItem[] = [
    {
      id: 'news-1',
      title: 'الذهب العالمي (XAU/USD) يحافظ على زخمه الصعودي وسط ترقب قرارات الفائدة',
      summary:
        'تواصل عقود الذهب الفورية التداول قرب مستويات دعم محورية مع تزايد الإقبال على الملاذات الآمنة.',
      source: 'نشرة الأسواق العالمية',
      category: 'أسواق الذهب',
      published_at: `تحديث ${timestampLabel}`,
      url: '#',
    },
    {
      id: 'news-2',
      title: 'مؤشر الدولار الأمريكي يتحرك في نطاق عرضي قبل صدور بيانات التضخم',
      summary:
        'تترقب المحافظ الاستثمارية مؤشرات أسعار المستهلكين لتحديد مسار السيولة في البورصات العالمية.',
      source: 'موجز البورصة',
      category: 'العملات الرئيسية',
      published_at: `تحديث ${timestampLabel}`,
      url: '#',
    },
    {
      id: 'news-3',
      title: 'تدفقات مؤسسية جديدة نحو صناديق المعادن النفيسة وأسهم التكنولوجيا',
      summary:
        'تقارير إدارة الأصول تشير إلى تنويع متزايد في المحافظ بين السبائك الذهبية وأسهم النمو.',
      source: 'تحليلات التجارة',
      category: 'إدارة المحافظ',
      published_at: `تحديث ${timestampLabel}`,
      url: '#',
    },
    {
      id: 'news-4',
      title: 'توصيات إدارة المخاطر: أهمية توزيع السيولة والالتزام بحدود السحب الآمن',
      summary:
        'الخبراء يؤكدون أن التحوط المالي ومراقبة الشارت اللحظي ركيزتان لحماية رأس المال.',
      source: 'أكاديمية التداول',
      category: 'إدارة رأس المال',
      published_at: `تحديث ${timestampLabel}`,
      url: '#',
    },
  ];
  newsCache = { items: fallback, fetchedAt: now };
  return fallback;
}

async function startServer() {
  await db.init();
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Safely serve uploaded images with path confinement check
  app.get('/uploads/:filename', (req, res) => {
    const filename = path.basename(req.params.filename || '');
    if (!filename || filename.includes('..')) {
      res.status(400).end();
      return;
    }
    const resolvedPath = path.resolve(UPLOADS_DIR, filename);
    if (!resolvedPath.startsWith(UPLOADS_DIR + path.sep)) {
      res.status(403).end();
      return;
    }
    if (!fs.existsSync(resolvedPath)) {
      res.status(404).end();
      return;
    }
    res.sendFile(resolvedPath);
  });

  // POST /api/register.php
  app.post(
    '/api/register.php',
    upload.single('shamcash_qr_file'),
    async (req, res) => {
      try {
        const full_name = String(req.body.full_name || '').trim();
        const national_id = String(req.body.national_id || '').trim();
        const phone = String(req.body.phone || '').trim();
        const password = String(req.body.password || '');
        const shamcash_code = String(req.body.shamcash_code || '').trim();

        if (!full_name || full_name.length < 5) {
          res.status(400).json({
            success: false,
            message: 'يرجى إدخال الاسم الثلاثي الكامل بشكل صحيح.',
          });
          return;
        }
        if (!national_id || national_id.length < 5) {
          res.status(400).json({
            success: false,
            message: 'يرجى إدخال الرقم الوطني بشكل صحيح.',
          });
          return;
        }
        if (!phone || phone.length < 7) {
          res.status(400).json({
            success: false,
            message: 'يرجى إدخال رقم الجوال (المرتبط بواتساب) بشكل صحيح.',
          });
          return;
        }
        if (password.length < 4) {
          res.status(400).json({
            success: false,
            message: 'يجب أن تكون كلمة المرور 4 أحرف على الأقل.',
          });
          return;
        }
        if (!shamcash_code) {
          res.status(400).json({
            success: false,
            message: 'يرجى إدخال كود حساب شام كاش لاستلام السحوبات.',
          });
          return;
        }

        const settings = await db.getSettings();
        const adminPhone = process.env.ADMIN_PHONE?.trim() || settings.admin_phone;
        if (phone === adminPhone) {
          res.status(400).json({
            success: false,
            message: 'رقم الجوال هذا محجوز للإدارة.',
          });
          return;
        }

        const existingNational = await db.findUserByNationalId(national_id);
        if (existingNational) {
          res.status(409).json({
            success: false,
            message: 'الرقم الوطني مسجل مسبقاً في المنصة ولا يمكن تكراره.',
          });
          return;
        }

        const existingPhone = await db.findUserByPhone(phone);
        if (existingPhone) {
          res.status(409).json({
            success: false,
            message: 'رقم الجوال مسجل مسبقاً، يمكنك تسجيل الدخول مباشرة.',
          });
          return;
        }

        const shamcash_qr_url = req.file ? `/uploads/${req.file.filename}` : '';
        const created = await db.createUser({
          full_name,
          national_id,
          phone,
          password_hash: hashPassword(password),
          shamcash_code,
          shamcash_qr_url,
        });

        const token = signToken({
          userId: created.id,
          uniqueId: created.unique_id,
          role: 'user',
        });

        res.status(201).json({
          success: true,
          message: `تم إنشاء حسابك بنجاح! رقم المعرف الموحد الخاص بك هو ${created.unique_id}`,
          token,
          user: sanitizeUser(created),
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          message:
            err instanceof Error ? err.message : 'تعذر إنشاء الحساب، حاول مجدداً.',
        });
      }
    }
  );

  // POST /api/login.php
  app.post('/api/login.php', async (req, res) => {
    try {
      const phone = String(req.body.phone || '').trim();
      const password = String(req.body.password || '');

      if (!phone || !password) {
        res.status(400).json({
          success: false,
          message: 'يرجى إدخال رقم الجوال وكلمة المرور.',
        });
        return;
      }

      const settings = await db.getSettings();
      const envAdminPhone = process.env.ADMIN_PHONE?.trim();
      const envAdminPass = process.env.ADMIN_PASSWORD;
      const effectiveAdminPhone = envAdminPhone || settings.admin_phone || '0900000009';

      if (phone === effectiveAdminPhone) {
        let adminValid = false;
        if (envAdminPass) {
          adminValid = password === envAdminPass;
        } else if (settings.admin_password_hash) {
          adminValid = verifyPassword(password, settings.admin_password_hash);
        } else {
          res.status(401).json({
            success: false,
            message: 'بيانات دخول المدير غير مفعلة. يرجى ضبط ADMIN_PASSWORD في إعدادات الخادم.',
          });
          return;
        }

        if (!adminValid) {
          res.status(401).json({
            success: false,
            message: 'بيانات دخول المدير غير صحيحة.',
          });
          return;
        }

        const token = signToken({
          userId: 0,
          uniqueId: 'SP-ADMIN',
          role: 'admin',
        });
        res.json({
          success: true,
          redirect: 'admin',
          token,
          user: {
            id: 0,
            unique_id: 'SP-ADMIN',
            full_name: 'الإدارة العامة - Sham Plus',
            national_id: 'ADMIN',
            phone: effectiveAdminPhone,
            shamcash_code: '',
            shamcash_qr_url: '',
            balance: 0,
            role: 'admin',
            status: 'active',
            created_at: settings.updated_at,
          },
        });
        return;
      }

      const user = await db.findUserByPhone(phone);
      if (!user || !verifyPassword(password, user.password_hash)) {
        res.status(401).json({
          success: false,
          message: 'رقم الجوال أو كلمة المرور غير صحيحة.',
        });
        return;
      }

      if (user.status === 'suspended') {
        res.status(403).json({
          success: false,
          message: 'تم إيقاف هذا الحساب مؤقتاً. يرجى التواصل مع الدعم الفني عبر تليجرام.',
        });
        return;
      }

      const token = signToken({
        userId: user.id,
        uniqueId: user.unique_id,
        role: user.role,
      });

      res.json({
        success: true,
        redirect: user.role === 'admin' ? 'admin' : 'user',
        token,
        user: sanitizeUser(user),
      });
    } catch {
      res.status(500).json({ success: false, message: 'حدث خطأ أثناء تسجيل الدخول.' });
    }
  });

  // GET /api/user_profile.php?user_id=...
  app.get('/api/user_profile.php', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const requestedId = Number(req.query.user_id || req.auth?.userId);
      if (!Number.isFinite(requestedId) || requestedId <= 0) {
        res.status(400).json({ success: false, message: 'معرف المستخدم غير صالح.' });
        return;
      }
      if (req.auth?.role !== 'admin' && req.auth?.userId !== requestedId) {
        res.status(403).json({ success: false, message: 'غير مصرح لك بعرض هذا الحساب.' });
        return;
      }

      const user = await db.findUserById(requestedId);
      if (!user) {
        res.status(404).json({ success: false, message: 'الحساب غير موجود.' });
        return;
      }

      const transactions = await db.listUserTransactions(user.id);
      res.json({
        success: true,
        user: sanitizeUser(user),
        transactions,
      });
    } catch {
      res.status(500).json({ success: false, message: 'تعذر جلب بيانات الملف الشخصي.' });
    }
  });

  // POST /api/transactions_create.php
  app.post(
    '/api/transactions_create.php',
    requireAuth,
    upload.single('receipt_file'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const requestedUserId = Number(req.body.user_id || req.auth?.userId);
        if (
          !Number.isFinite(requestedUserId) ||
          requestedUserId <= 0 ||
          (req.auth?.role !== 'admin' && req.auth?.userId !== requestedUserId)
        ) {
          res.status(403).json({ success: false, message: 'غير مصرح لك بتنفيذ هذه العملية.' });
          return;
        }

        const type = req.body.type === 'withdraw' ? 'withdraw' : req.body.type === 'deposit' ? 'deposit' : null;
        if (!type) {
          res.status(400).json({ success: false, message: 'نوع العملية غير صالح.' });
          return;
        }

        const amount = Number(req.body.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          res.status(400).json({ success: false, message: 'يرجى إدخال مبلغ صحيح أكبر من 0.' });
          return;
        }

        const user = await db.findUserById(requestedUserId);
        if (!user) {
          res.status(404).json({ success: false, message: 'الحساب غير موجود.' });
          return;
        }

        if (user.status === 'suspended') {
          res.status(403).json({
            success: false,
            message: 'حسابك موقوف حالياً ولا يمكن إجراء عمليات مالية.',
          });
          return;
        }

        if (type === 'deposit') {
          if (!req.file) {
            res.status(400).json({
              success: false,
              message: 'يرجى إرفاق صورة إشعار التحويل لإتمام طلب الإيداع.',
            });
            return;
          }
          const tx = await db.createTransaction({
            user_id: user.id,
            type: 'deposit',
            amount: Number(amount.toFixed(2)),
            receipt_url: `/uploads/${req.file.filename}`,
          });
          res.status(201).json({
            success: true,
            message: 'تم إرسال طلب الإيداع بنجاح وهو قيد المراجعة.',
            transaction: tx,
          });
          return;
        }

        // Server-side withdrawal lock check
        const appSettings = await db.getSettings();
        if (!appSettings.withdrawals_enabled) {
          res.status(403).json({
            success: false,
            message: 'السحب معلق حالياً من قبل الإدارة. الرجاء الانتظار 30 يوم للسماح بالسحب.',
          });
          return;
        }

        // Withdrawal validation: maximum 50% of current balance
        const maxAllowed = Number((user.balance * 0.5).toFixed(2));
        if (user.balance <= 0 || amount > maxAllowed) {
          res.status(400).json({
            success: false,
            message: `لا يمكن سحب أكثر من 50% من رصيدك الحالي. الحد الأقصى المتاح للسحب الآن هو $${maxAllowed.toFixed(2)}.`,
          });
          return;
        }

        const tx = await db.createTransaction({
          user_id: user.id,
          type: 'withdraw',
          amount: Number(amount.toFixed(2)),
          receipt_url: '',
        });
        res.status(201).json({
          success: true,
          message: 'تم تقديم طلب السحب بنجاح وهو قيد المعالجة.',
          transaction: tx,
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          message:
            err instanceof Error ? err.message : 'تعذر تسجيل الطلب المالي.',
        });
      }
    }
  );

  // GET /api/settings.php (public safe fields only)
  app.get('/api/settings.php', async (_req, res) => {
    try {
      const s = await db.getSettings();
      res.json({
        success: true,
        settings: {
          app_logo_url: s.app_logo_url,
          admin_deposit_qr_url: s.admin_deposit_qr_url,
          telegram_support: s.telegram_support,
          youtube_video_url: s.youtube_video_url,
          withdrawals_enabled: s.withdrawals_enabled,
        },
      });
    } catch {
      res.status(500).json({ success: false, message: 'تعذر جلب الإعدادات.' });
    }
  });

  // POST /api/settings.php (Admin only)
  app.post(
    '/api/settings.php',
    requireAdmin,
    upload.fields([
      { name: 'app_logo_file', maxCount: 1 },
      { name: 'admin_deposit_qr_file', maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        const files = req.files as Record<string, Express.Multer.File[]> | undefined;
        const current = await db.getSettings();

        const patch: Record<string, string | boolean> = {};
        if (files?.app_logo_file?.[0]) {
          patch.app_logo_url = `/uploads/${files.app_logo_file[0].filename}`;
        }
        if (files?.admin_deposit_qr_file?.[0]) {
          patch.admin_deposit_qr_url = `/uploads/${files.admin_deposit_qr_file[0].filename}`;
        }
        if (req.body.telegram_support !== undefined) {
          patch.telegram_support = sanitizeTelegramHandle(String(req.body.telegram_support));
        }
        if (req.body.withdrawals_enabled !== undefined) {
          const val = String(req.body.withdrawals_enabled).trim().toLowerCase();
          patch.withdrawals_enabled = val === '1' || val === 'true';
        }
        if (req.body.youtube_video_url !== undefined) {
          const rawYt = String(req.body.youtube_video_url).trim();
          if (rawYt === '') {
            patch.youtube_video_url = '';
          } else {
            const normalized = normalizeYouTubeUrl(rawYt);
            if (!normalized) {
              res.status(400).json({
                success: false,
                message: 'رابط فيديو اليوتيوب غير صالح. يرجى إدخال رابط YouTube صحيح.',
              });
              return;
            }
            patch.youtube_video_url = normalized;
          }
        }

        const updated = await db.updateSettings({
          ...current,
          ...patch,
        });

        res.json({
          success: true,
          message: 'تم حفظ إعدادات التطبيق بنجاح.',
          settings: {
            app_logo_url: updated.app_logo_url,
            admin_deposit_qr_url: updated.admin_deposit_qr_url,
            telegram_support: updated.telegram_support,
            youtube_video_url: updated.youtube_video_url,
            withdrawals_enabled: updated.withdrawals_enabled,
          },
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          message:
            err instanceof Error ? err.message : 'تعذر تحديث الإعدادات.',
        });
      }
    }
  );

  // GET /api/admin_transactions.php
  app.get('/api/admin_transactions.php', requireAdmin, async (req, res) => {
    try {
      const search = String(req.query.search || '');
      const type = String(req.query.type || 'all');
      const status = String(req.query.status || 'all');
      const [transactions, stats] = await Promise.all([
        db.listAdminTransactions({ search, type, status }),
        db.getAdminStats(),
      ]);
      res.json({ success: true, transactions, stats });
    } catch {
      res.status(500).json({ success: false, message: 'تعذر جلب العمليات المالية.' });
    }
  });

  // POST /api/admin_tx_action.php
  app.post('/api/admin_tx_action.php', requireAdmin, async (req, res) => {
    try {
      const transaction_id = Number(req.body.transaction_id);
      const action =
        req.body.action === 'approve'
          ? 'approve'
          : req.body.action === 'reject'
          ? 'reject'
          : null;
      const amount =
        req.body.amount !== undefined && req.body.amount !== ''
          ? Number(req.body.amount)
          : undefined;
      const admin_note = String(req.body.admin_note || '').trim();

      if (!Number.isFinite(transaction_id) || transaction_id <= 0 || !action) {
        res.status(400).json({ success: false, message: 'بيانات القرار الإداري غير مكتملة.' });
        return;
      }

      if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
        res.status(400).json({ success: false, message: 'المبلغ المعدّل يجب أن يكون أكبر من صفر.' });
        return;
      }

      const result = await db.processTransactionAction({
        transaction_id,
        action,
        amount,
        admin_note,
      });

      res.json({
        success: true,
        message:
          action === 'approve'
            ? 'تمت الموافقة على العملية وتحديث رصيد العميل بنجاح.'
            : 'تم رفض العملية مع إبقاء الرصيد كما هو.',
        transaction: result.tx,
        user_balance: result.userBalance,
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'TX_NOT_FOUND') {
        res.status(404).json({ success: false, message: 'العملية غير موجودة.' });
        return;
      }
      if (code === 'TX_ALREADY_PROCESSED') {
        res.status(409).json({ success: false, message: 'تمت معالجة هذه العملية مسبقاً.' });
        return;
      }
      if (code === 'INSUFFICIENT_BALANCE') {
        res.status(400).json({
          success: false,
          message: 'رصيد العميل الحالي غير كافٍ لخصم مبلغ السحب المطلوب.',
        });
        return;
      }
      res.status(500).json({ success: false, message: 'تعذر تنفيذ القرار الإداري.' });
    }
  });

  // GET /api/admin_users.php
  app.get('/api/admin_users.php', requireAdmin, async (req, res) => {
    try {
      const search = String(req.query.search || '');
      const [users, stats] = await Promise.all([
        db.listUsers(search),
        db.getAdminStats(),
      ]);
      res.json({
        success: true,
        users: users.map(sanitizeUser),
        stats,
      });
    } catch {
      res.status(500).json({ success: false, message: 'تعذر جلب قائمة المستخدمين.' });
    }
  });

  // POST /api/admin_users.php (update balance or status)
  app.post('/api/admin_users.php', requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.body.user_id);
      if (!Number.isFinite(userId) || userId <= 0) {
        res.status(400).json({ success: false, message: 'معرف العميل غير صالح.' });
        return;
      }

      const patch: { balance?: number; status?: 'active' | 'suspended' } = {};
      if (req.body.balance !== undefined && req.body.balance !== '') {
        const bal = Number(req.body.balance);
        if (!Number.isFinite(bal) || bal < 0) {
          res.status(400).json({ success: false, message: 'الرصيد يجب أن يكون رقماً غير سالب.' });
          return;
        }
        patch.balance = Number(bal.toFixed(2));
      }
      if (req.body.status === 'active' || req.body.status === 'suspended') {
        patch.status = req.body.status;
      }

      const updated = await db.updateUserAdmin(userId, patch);
      if (!updated) {
        res.status(404).json({ success: false, message: 'المستخدم غير موجود.' });
        return;
      }

      res.json({
        success: true,
        message: 'تم تحديث بيانات حساب العميل بنجاح.',
        user: sanitizeUser(updated),
      });
    } catch {
      res.status(500).json({ success: false, message: 'تعذر تحديث بيانات المستخدم.' });
    }
  });

  // POST /api/admin_bulk_profit.php (Add profit amount to all users' balances)
  app.post('/api/admin_bulk_profit.php', requireAdmin, async (req, res) => {
    try {
      const amount = Number(req.body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        res.status(400).json({
          success: false,
          message: 'يرجى إدخال مبلغ ربح صحيح أكبر من صفر.',
        });
        return;
      }

      const result = await db.addProfitToAllUsers(amount);
      if (result.updatedCount === 0) {
        res.status(400).json({
          success: false,
          message: 'لا يوجد عملاء مسجلون حالياً لإضافة الأرباح إلى أرصدتهم.',
        });
        return;
      }

      res.json({
        success: true,
        message: `تمت إضافة $${amount.toFixed(2)} إلى رصيد ${result.updatedCount} عميل بنجاح.`,
        updated_count: result.updatedCount,
        total_added: result.totalAdded,
      });
    } catch {
      res.status(500).json({
        success: false,
        message: 'تعذر تنفيذ زيادة الأرباح الجماعية.',
      });
    }
  });

  // GET /api/notifications.php (Customer notifications)
  app.get('/api/notifications.php', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.auth?.userId;
      if (!userId || userId <= 0) {
        res.json({ success: true, notifications: [], unread_count: 0 });
        return;
      }
      const notifications = await db.listUserNotifications(userId);
      const unread_count = notifications.filter((n) => !n.is_read).length;
      res.json({ success: true, notifications, unread_count });
    } catch {
      res.status(500).json({ success: false, message: 'تعذر جلب الإشعارات.' });
    }
  });

  // POST /api/notifications_read.php (Mark notification(s) as read)
  app.post('/api/notifications_read.php', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.auth?.userId;
      if (!userId || userId <= 0) {
        res.json({ success: true });
        return;
      }
      const notifId =
        req.body.notification_id !== undefined && req.body.notification_id !== null
          ? Number(req.body.notification_id)
          : undefined;
      await db.markNotificationRead(
        userId,
        notifId && Number.isFinite(notifId) ? notifId : undefined
      );
      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false, message: 'تعذر تحديث حالة الإشعارات.' });
    }
  });

  // GET /api/admin_notifications.php (Admin sent notifications history)
  app.get('/api/admin_notifications.php', requireAdmin, async (_req, res) => {
    try {
      const notifications = await db.listAdminNotifications();
      res.json({ success: true, notifications });
    } catch {
      res.status(500).json({ success: false, message: 'تعذر جلب سجل الإشعارات.' });
    }
  });

  // POST /api/admin_notifications.php (Admin sends message to all or specific customer)
  app.post('/api/admin_notifications.php', requireAdmin, async (req, res) => {
    try {
      const title = String(req.body.title || '').trim();
      const message = String(req.body.message || '').trim();
      const rawTarget = req.body.target_user_id;

      if (!title || title.length < 2) {
        res.status(400).json({
          success: false,
          message: 'يرجى إدخال عنوان واضح للإشعار.',
        });
        return;
      }
      if (!message || message.length < 2) {
        res.status(400).json({
          success: false,
          message: 'يرجى كتابة نص الرسالة المراد إرسالها.',
        });
        return;
      }

      let targetUserId: number | null = null;
      if (
        rawTarget !== undefined &&
        rawTarget !== null &&
        rawTarget !== '' &&
        rawTarget !== 'all'
      ) {
        const parsedId = Number(rawTarget);
        if (!Number.isFinite(parsedId) || parsedId <= 0) {
          res.status(400).json({
            success: false,
            message: 'معرف العميل المستهدف غير صالح.',
          });
          return;
        }
        const targetUser = await db.findUserById(parsedId);
        if (!targetUser) {
          res.status(404).json({
            success: false,
            message: 'العميل المستهدف غير موجود.',
          });
          return;
        }
        targetUserId = targetUser.id;
      }

      const notification = await db.createNotification({
        user_id: targetUserId,
        title,
        message,
      });

      res.status(201).json({
        success: true,
        message:
          targetUserId === null
            ? 'تم إرسال الرسالة كإشعار لجميع العملاء بنجاح.'
            : 'تم إرسال الرسالة كإشعار للعميل المحدد بنجاح.',
        notification,
      });
    } catch {
      res.status(500).json({
        success: false,
        message: 'تعذر إرسال الإشعار.',
      });
    }
  });

  // GET /api/market_news.php
  app.get('/api/market_news.php', async (req, res) => {
    try {
      if (req.query.refresh === '1') {
        newsCache = null;
      }
      const items = await fetchLatestEconomicNews();
      res.json({ success: true, items: items.slice(0, 4) });
    } catch {
      res.status(500).json({ success: false, items: [] });
    }
  });

  // GET /api/gold_chart.php?interval=15|60|240|D
  const goldChartCache = new Map<
    string,
    { fetchedAt: number; payload: Record<string, unknown> }
  >();

  app.get('/api/gold_chart.php', async (req, res) => {
    const tf = String(req.query.interval || '60');
    const cached = goldChartCache.get(tf);
    if (cached && Date.now() - cached.fetchedAt < 60 * 1000) {
      res.json(cached.payload);
      return;
    }

    const yahooParams =
      tf === '15'
        ? { interval: '15m', range: '2d' }
        : tf === '240'
        ? { interval: '1h', range: '1mo' }
        : tf === 'D'
        ? { interval: '1d', range: '3mo' }
        : { interval: '1h', range: '5d' };

    for (const ticker of ['GC=F', 'XAUUSD=X']) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4500);
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          ticker
        )}?interval=${yahooParams.interval}&range=${yahooParams.range}`;
        const resp = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        clearTimeout(timer);
        if (!resp.ok) continue;

        const data = (await resp.json()) as {
          chart?: {
            result?: Array<{
              meta?: {
                regularMarketPrice?: number;
                chartPreviousClose?: number;
                previousClose?: number;
              };
              timestamp?: number[];
              indicators?: {
                quote?: Array<{
                  open?: Array<number | null>;
                  high?: Array<number | null>;
                  low?: Array<number | null>;
                  close?: Array<number | null>;
                }>;
              };
            }>;
          };
        };

        const result = data.chart?.result?.[0];
        const timestamps = result?.timestamp || [];
        const quote = result?.indicators?.quote?.[0];
        if (!result || !quote || timestamps.length === 0) continue;

        let candles: Array<{
          time: number;
          open: number;
          high: number;
          low: number;
          close: number;
        }> = [];

        for (let i = 0; i < timestamps.length; i++) {
          const o = quote.open?.[i];
          const h = quote.high?.[i];
          const l = quote.low?.[i];
          const c = quote.close?.[i];
          if (
            typeof o === 'number' &&
            typeof h === 'number' &&
            typeof l === 'number' &&
            typeof c === 'number'
          ) {
            candles.push({
              time: timestamps[i] * 1000,
              open: Number(o.toFixed(2)),
              high: Number(h.toFixed(2)),
              low: Number(l.toFixed(2)),
              close: Number(c.toFixed(2)),
            });
          }
        }

        if (tf === '240' && candles.length > 4) {
          const grouped: typeof candles = [];
          for (let i = 0; i < candles.length; i += 4) {
            const slice = candles.slice(i, i + 4);
            grouped.push({
              time: slice[0].time,
              open: slice[0].open,
              high: Math.max(...slice.map((s) => s.high)),
              low: Math.min(...slice.map((s) => s.low)),
              close: slice[slice.length - 1].close,
            });
          }
          candles = grouped;
        }

        candles = candles.slice(-60);
        if (candles.length === 0) continue;

        const lastPrice = Number(
          (
            result.meta?.regularMarketPrice ||
            candles[candles.length - 1].close
          ).toFixed(2)
        );
        const prevClose = Number(
          (
            result.meta?.chartPreviousClose ||
            result.meta?.previousClose ||
            candles[0].open
          ).toFixed(2)
        );
        const change = Number((lastPrice - prevClose).toFixed(2));
        const changePercent = prevClose
          ? Number(((change / prevClose) * 100).toFixed(2))
          : 0;
        const high = Math.max(...candles.map((c) => c.high));
        const low = Math.min(...candles.map((c) => c.low));

        const payload = {
          success: true,
          symbol: 'XAU/USD',
          price: lastPrice,
          previousClose: prevClose,
          change,
          changePercent,
          high,
          low,
          candles,
        };
        goldChartCache.set(tf, { fetchedAt: Date.now(), payload });
        res.json(payload);
        return;
      } catch {
        // Try next ticker
      }
    }

    res.status(503).json({
      success: false,
      message: 'تعذر جلب بيانات شارت الذهب حالياً.',
      candles: [],
    });
  });

  // Multer error handler
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (err) {
        res.status(400).json({ success: false, message: err.message });
        return;
      }
      next();
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Sham Plus] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
