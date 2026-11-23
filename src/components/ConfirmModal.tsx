import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'approve' | 'reject' | 'gold';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'إلغاء',
  tone = 'gold',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const buttonStyle =
    tone === 'approve'
      ? 'bg-[#0ECB81] text-[#05130D] hover:bg-[#14DF8F]'
      : tone === 'reject'
      ? 'bg-[#F6465D] text-white hover:bg-[#FF596E]'
      : 'bg-[#C9A227] text-[#080C14] hover:bg-[#DCB53B]';

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !loading && onCancel()}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700/60 bg-[#0F1623] p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  tone === 'approve'
                    ? 'bg-[#0ECB81]/15 text-[#0ECB81]'
                    : tone === 'reject'
                    ? 'bg-[#F6465D]/15 text-[#F6465D]'
                    : 'bg-[#C9A227]/15 text-[#C9A227]'
                }`}
              >
                {tone === 'approve' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-100">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                  {description}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={onCancel}
                className="min-h-[42px] rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800/70 transition-colors disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={onConfirm}
                className={`min-h-[42px] rounded-xl px-5 py-2 text-sm font-bold transition-colors disabled:opacity-50 ${buttonStyle}`}
              >
                {loading ? 'جاري التنفيذ...' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface ImageLightboxProps {
  src: string | null;
  title: string;
  onClose: () => void;
}

export function ImageLightbox({ src, title, onClose }: ImageLightboxProps) {
  return (
    <AnimatePresence>
      {src && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.18 }}
            className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-700/70 bg-[#0F1623] p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق المعاينة"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 flex items-center justify-center bg-[#080C14] rounded-xl p-3 max-h-[70vh] overflow-hidden">
              <img
                src={src}
                alt={title}
                referrerPolicy="no-referrer"
                className="max-h-[62vh] w-auto rounded-lg object-contain"
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
