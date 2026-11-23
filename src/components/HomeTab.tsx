import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ExternalLink, PlayCircle, Newspaper } from 'lucide-react';
import { api } from '../api/client';
import type { AppSettings, MarketNewsItem } from '../types';
import { GoldChartSection } from './GoldChartSection';

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    let id = '';
    if (host === 'youtu.be') {
      id = parsed.pathname.slice(1).split('/')[0] || '';
    } else if (
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com'
    ) {
      if (parsed.pathname === '/watch') {
        id = parsed.searchParams.get('v') || '';
      } else if (parsed.pathname.startsWith('/embed/')) {
        id = parsed.pathname.split('/')[2] || '';
      } else if (parsed.pathname.startsWith('/shorts/')) {
        id = parsed.pathname.split('/')[2] || '';
      }
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

interface HomeTabProps {
  settings: AppSettings;
  onGoToWallet: () => void;
}

export function HomeTab({ settings, onGoToWallet }: HomeTabProps) {
  const [news, setNews] = useState<MarketNewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNews = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setNewsLoading(true);
    try {
      const res = await api.getMarketNews(force);
      setNews(res.items || []);
    } catch {
      // Keep previous news on transient failure
    } finally {
      setNewsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNews(false);
    const timer = window.setInterval(() => {
      loadNews(true);
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [loadNews]);

  const ytId = extractYouTubeId(settings.youtube_video_url);

  return (
    <div className="space-y-6">
      {/* Hero Market Header */}
      <section className="rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-[#C9A227] font-bold">
              <span>منصة التداول وإدارة الأسهم</span>
              <span aria-hidden="true">·</span>
              <span>XAU/USD</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white [text-wrap:balance]">
              تداول بثقة في أسواق الذهب العالمية
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl">
              بوابتك الذكية لأسواق المال، تداول الذهب، وإدارة المحافظ الاستثمارية بمرونة وأمان مع إدارة ذكية لرأس المال وتحديثات لحظية للبورصة.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onGoToWallet}
              className="min-h-[44px] rounded-xl bg-[#C9A227] px-5 py-2.5 text-sm font-bold text-[#080C14] hover:bg-[#DCB53B] transition-colors whitespace-nowrap"
            >
              إدارة الإيداع والسحب
            </button>
          </div>
        </div>
      </section>

      {/* Live Gold Chart (TradingView + Native Candlesticks) */}
      <GoldChartSection />

      {/* Economic News & Admin YouTube Video Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Latest 4 Economic News */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5 flex flex-col">
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <Newspaper className="w-5 h-5 text-[#C9A227]" />
              <div>
                <h3 className="text-base font-bold text-white">
                  أخبار التجارة والبورصة العالمية
                </h3>
                <p className="text-xs text-slate-400">
                  أحدث 4 أخبار اقتصادية يتم تحديثها تلقائياً
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => loadNews(true)}
              disabled={refreshing}
              className="min-h-[38px] rounded-xl border border-slate-700/80 bg-[#080C14] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-[#C9A227] transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#C9A227] ${
                  refreshing ? 'animate-spin' : ''
                }`}
              />
              <span>تحديث</span>
            </button>
          </div>

          <div className="mt-4 space-y-3 flex-1">
            {newsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-800/70 bg-[#080C14]/70 p-4 animate-pulse space-y-2"
                >
                  <div className="h-3 w-1/3 rounded bg-slate-800" />
                  <div className="h-4 w-5/6 rounded bg-slate-800" />
                  <div className="h-3 w-2/3 rounded bg-slate-800/80" />
                </div>
              ))
            ) : (
              news.slice(0, 4).map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-800/70 bg-[#080C14]/70 p-4 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-400 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#C9A227]">
                        {item.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{item.source}</span>
                    </div>
                    <span className="font-mono-num text-[11px]">
                      {item.published_at}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-100 leading-snug">
                    {item.title}
                  </h4>
                  <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                    {item.summary}
                  </p>
                  {item.url && item.url !== '#' && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#C9A227] hover:text-[#E0BE53]"
                    >
                      <span>اقرأ التفاصيل</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </article>
              ))
            )}
          </div>
        </section>

        {/* Admin YouTube Video + Platform Highlights */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800/80">
              <PlayCircle className="w-5 h-5 text-[#C9A227]" />
              <div>
                <h3 className="text-base font-bold text-white">
                  الشرح والتحليل المرئي
                </h3>
                <p className="text-xs text-slate-400">
                  فيديو إرشادي وتحليلي معتمد من إدارة Sham Plus
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-[#080C14] aspect-video flex items-center justify-center">
              {ytId ? (
                <iframe
                  title="فيديو Sham Plus الإرشادي"
                  src={`https://www.youtube.com/embed/${ytId}`}
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="p-6 text-center space-y-2">
                  <PlayCircle className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">
                    لا يوجد فيديو مضاف حالياً
                  </p>
                  <p className="text-xs text-slate-500">
                    يمكن لمدير المنصة إضافة رابط فيديو يوتيوب من لوحة التحكم ليظهر هنا مباشرة.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-[#0F1623] p-5 space-y-3 flex-1">
            <h3 className="text-sm font-bold text-[#C9A227]">
              إدارة ذكية لرأس المال مع تحديثات لحظية للبورصة
            </h3>
            <p className="text-xs leading-relaxed text-slate-300">
              نلتزم في Sham Plus بتوفير بيئة استثمارية شفافة تجمع بين متابعة أسعار الذهب والأسهم العالمية، وتوثيق عمليات الإيداع والسحب عبر معرفك الشخصي الموحد.
            </p>
            <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-[#080C14] p-3 border border-slate-800/70">
                <span className="block font-bold text-white">سقف سحب آمن</span>
                <span className="mt-1 block text-slate-400">
                  حتى 50% من الرصيد المتاح لحماية استقرار المحفظة
                </span>
              </div>
              <div className="rounded-xl bg-[#080C14] p-3 border border-slate-800/70">
                <span className="block font-bold text-white">مراجعة فورية</span>
                <span className="mt-1 block text-slate-400">
                  تأكيد الإيداعات وتحديث الرصيد فور اعتماد الإدارة
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
