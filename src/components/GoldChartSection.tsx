import { useCallback, useEffect, useRef, useState } from 'react';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { api } from '../api/client';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface GoldFeedData {
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  candles: Candle[];
}

const TIMEFRAMES = [
  { id: '15', label: '15 د' },
  { id: '60', label: '1 س' },
  { id: '240', label: '4 س' },
  { id: 'D', label: 'يومي' },
];

export function GoldChartSection() {
  const [interval, setInterval] = useState('60');
  const [chartEngine, setChartEngine] = useState<'tradingview' | 'native'>(
    'tradingview'
  );
  const [feed, setFeed] = useState<GoldFeedData | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const tvContainerRef = useRef<HTMLDivElement | null>(null);

  const loadGoldFeed = useCallback(async (tf: string) => {
    setFeedLoading(true);
    try {
      const res = await api.getGoldChart(tf);
      setFeed({
        price: res.price,
        change: res.change,
        changePercent: res.changePercent,
        high: res.high,
        low: res.low,
        candles: res.candles,
      });
    } catch {
      // Keep existing feed if transient error
    } finally {
      setFeedLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoldFeed(interval);
    const timer = window.setInterval(() => {
      loadGoldFeed(interval);
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [interval, loadGoldFeed]);

  // Mount official TradingView Advanced Chart Widget (replaces deprecated /widgetembed/ 403 URL)
  useEffect(() => {
    if (chartEngine !== 'tradingview') return;
    const container = tvContainerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const widgetHost = document.createElement('div');
    widgetHost.className = 'tradingview-widget-container__widget';
    widgetHost.style.height = '100%';
    widgetHost.style.width = '100%';
    container.appendChild(widgetHost);

    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: 'OANDA:XAUUSD',
      interval,
      timezone: 'Asia/Damascus',
      theme: 'dark',
      style: '1',
      locale: 'ar_AE',
      backgroundColor: '#080C14',
      gridColor: 'rgba(148, 163, 184, 0.08)',
      allow_symbol_change: true,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
    });

    script.onerror = () => {
      setChartEngine('native');
    };

    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [interval, chartEngine]);

  const activeCandle =
    feed && feed.candles.length > 0
      ? feed.candles[
          hoverIdx !== null && hoverIdx < feed.candles.length
            ? hoverIdx
            : feed.candles.length - 1
        ]
      : null;

  const isPositive = (feed?.change || 0) >= 0;

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-[#0F1623] overflow-hidden">
      {/* Header & Spot Quote Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 px-5 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-5 h-5 text-[#C9A227]" />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                شارت الذهب الفوري مقابل الدولار (XAU/USD)
              </h3>
              <p className="text-xs text-slate-400">
                بيانات سوق مباشرة · تحديث لحظي للبورصة العالمية
              </p>
            </div>
          </div>

          {feed && (
            <div className="flex flex-wrap items-center gap-3 border-r border-slate-800 pr-4">
              <span className="font-mono-num text-lg sm:text-xl font-extrabold text-white">
                ${feed.price.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span
                className={`font-mono-num text-xs font-bold ${
                  isPositive ? 'text-[#0ECB81]' : 'text-[#F6465D]'
                }`}
              >
                {isPositive ? '+' : ''}
                {feed.change.toFixed(2)} ({isPositive ? '+' : ''}
                {feed.changePercent.toFixed(2)}%)
              </span>
              <span className="hidden sm:inline text-xs text-slate-500">·</span>
              <span className="hidden sm:inline font-mono-num text-xs text-slate-400">
                أعلى: ${feed.high.toFixed(2)} / أدنى: ${feed.low.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Chart Mode + Timeframe Switchers */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-[#080C14] p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setChartEngine('tradingview')}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                chartEngine === 'tradingview'
                  ? 'bg-[#C9A227] text-[#080C14]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              TradingView
            </button>
            <button
              type="button"
              onClick={() => setChartEngine('native')}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                chartEngine === 'native'
                  ? 'bg-[#C9A227] text-[#080C14]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              شموع Sham Plus
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-[#080C14] p-1 border border-slate-800">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                type="button"
                onClick={() => setInterval(tf.id)}
                className={`min-h-[34px] px-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  interval === tf.id
                    ? 'bg-slate-800 text-[#E0BE53]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart Viewport */}
      {chartEngine === 'tradingview' ? (
        <div className="relative h-[410px] sm:h-[470px] w-full bg-[#080C14]">
          <div
            ref={tvContainerRef}
            className="tradingview-widget-container h-full w-full"
          />
        </div>
      ) : (
        <div className="relative h-[410px] sm:h-[470px] w-full bg-[#080C14] p-4 flex flex-col">
          {/* OHLC Readout */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 text-xs border-b border-slate-800/70">
            {activeCandle ? (
              <div className="flex flex-wrap items-center gap-3 font-mono-num">
                <span className="text-slate-400">
                  {new Date(activeCandle.time).toLocaleString('ar-EG', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="text-slate-300">
                  الافتتاح:{' '}
                  <strong className="text-white">{activeCandle.open.toFixed(2)}</strong>
                </span>
                <span className="text-slate-300">
                  الأعلى:{' '}
                  <strong className="text-[#0ECB81]">{activeCandle.high.toFixed(2)}</strong>
                </span>
                <span className="text-slate-300">
                  الأدنى:{' '}
                  <strong className="text-[#F6465D]">{activeCandle.low.toFixed(2)}</strong>
                </span>
                <span className="text-slate-300">
                  الإغلاق:{' '}
                  <strong className="text-[#C9A227]">{activeCandle.close.toFixed(2)}</strong>
                </span>
              </div>
            ) : (
              <span className="text-slate-400">جاري تحميل الشموع...</span>
            )}

            <button
              type="button"
              onClick={() => loadGoldFeed(interval)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C9A227] hover:text-[#E0BE53]"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${feedLoading ? 'animate-spin' : ''}`}
              />
              <span>تحديث البيانات</span>
            </button>
          </div>

          {/* Native Candlestick SVG */}
          <div className="flex-1 pt-3 overflow-hidden">
            {feed && feed.candles.length > 0 ? (
              <NativeCandlestickSvg
                candles={feed.candles}
                hoverIdx={hoverIdx}
                onHoverIdx={setHoverIdx}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                {feedLoading
                  ? 'جاري جلب بيانات الذهب المباشرة...'
                  : 'تعذر تحميل الشموع، اضغط تحديث البيانات.'}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function NativeCandlestickSvg({
  candles,
  hoverIdx,
  onHoverIdx,
}: {
  candles: Candle[];
  hoverIdx: number | null;
  onHoverIdx: (idx: number | null) => void;
}) {
  const width = 920;
  const height = 340;
  const padLeft = 16;
  const padRight = 68;
  const padTop = 16;
  const padBottom = 28;

  const minPrice = Math.min(...candles.map((c) => c.low));
  const maxPrice = Math.max(...candles.map((c) => c.high));
  const range = Math.max(maxPrice - minPrice, 1);
  const yMin = minPrice - range * 0.08;
  const yMax = maxPrice + range * 0.08;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const toY = (price: number) =>
    padTop + ((yMax - price) / (yMax - yMin)) * plotH;

  const step = plotW / candles.length;
  const candleW = Math.max(3, Math.min(11, step * 0.62));
  const gridLevels = 5;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full select-none"
      onMouseLeave={() => onHoverIdx(null)}
    >
      {/* Horizontal Price Grid */}
      {Array.from({ length: gridLevels }).map((_, i) => {
        const ratio = i / (gridLevels - 1);
        const priceVal = yMax - ratio * (yMax - yMin);
        const y = toY(priceVal);
        return (
          <g key={i}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={y}
              y2={y}
              stroke="rgba(148, 163, 184, 0.1)"
              strokeDasharray="3 3"
            />
            <text
              x={width - padRight + 8}
              y={y + 4}
              fill="#94A3B8"
              fontSize="11"
              fontFamily="IBM Plex Mono, monospace"
            >
              {priceVal.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* Candlesticks */}
      {candles.map((c, idx) => {
        const cx = padLeft + idx * step + step / 2;
        const isBull = c.close >= c.open;
        const color = isBull ? '#0ECB81' : '#F6465D';
        const yHigh = toY(c.high);
        const yLow = toY(c.low);
        const yOpen = toY(c.open);
        const yClose = toY(c.close);
        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));
        const isHovered = hoverIdx === idx;

        return (
          <g
            key={c.time}
            onMouseEnter={() => onHoverIdx(idx)}
            className="cursor-crosshair"
          >
            {isHovered && (
              <line
                x1={cx}
                x2={cx}
                y1={padTop}
                y2={height - padBottom}
                stroke="rgba(201, 162, 39, 0.45)"
                strokeDasharray="3 3"
              />
            )}
            <rect
              x={padLeft + idx * step}
              y={padTop}
              width={step}
              height={plotH}
              fill="transparent"
            />
            <line
              x1={cx}
              x2={cx}
              y1={yHigh}
              y2={yLow}
              stroke={color}
              strokeWidth={isHovered ? 2 : 1.4}
            />
            <rect
              x={cx - candleW / 2}
              y={bodyTop}
              width={candleW}
              height={bodyHeight}
              fill={color}
              rx={1}
              opacity={isHovered ? 1 : 0.92}
            />
          </g>
        );
      })}
    </svg>
  );
}
