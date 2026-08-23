// Global toast system: non-blocking, auto-dismissing feedback.
// Wrap the app in <ToastProvider> once, then call useToast() anywhere.
// Provider + hooks intentionally co-located (standard React context pattern).
/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

const ToastContext = createContext(null);
let idCounter = 0;

const TONE_STYLES = {
  success: { wrap: "border-success-600 bg-success-50 text-success-700", icon: CheckCircle2 },
  error: { wrap: "border-danger-600 bg-danger-50 text-danger-700", icon: AlertTriangle },
  info: { wrap: "border-primary-600 bg-primary-50 text-primary-800", icon: Info }
};

// Heuristic so plain status strings ("...failed", "...required") pick the right tone.
const inferTone = (message = "") => {
  const text = message.toLowerCase();
  if (/(fail|error|required|invalid|denied|unable|cannot|reject|not\b)/.test(text)) return "error";
  if (/(saved|sent|approved|released|updated|published|success|done|created|issued|downloaded|confirmed|processed)/.test(text)) return "success";
  return "info";
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((message, options = {}) => {
    if (!message) return null;
    const id = ++idCounter;
    const tone = options.tone || inferTone(message);
    const duration = options.duration ?? 4200;
    setToasts((current) => [...current, { id, message, tone, title: options.title }]);
    if (duration) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const value = {
    push,
    success: (message, options) => push(message, { ...options, tone: "success" }),
    error: (message, options) => push(message, { ...options, tone: "error" }),
    info: (message, options) => push(message, { ...options, tone: "info" }),
    dismiss
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts, dismiss }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end">
      {toasts.map((toast) => {
        const style = TONE_STYLES[toast.tone] || TONE_STYLES.info;
        const Icon = style.icon;
        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border-l-4 bg-surface px-4 py-3 shadow-float ${style.wrap}`}
          >
            <Icon size={18} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              {toast.title && <p className="text-sm font-bold">{toast.title}</p>}
              <p className="text-sm font-semibold leading-snug">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className="shrink-0 rounded-md p-1 text-current/70 transition hover:bg-black/5"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  // No-op fallback keeps callers crash-safe if a tree renders without the provider.
  return ctx || { push() {}, success() {}, error() {}, info() {}, dismiss() {} };
}

/**
 * Bridge a string "message" state to toasts: whenever the message changes,
 * a toast fires (tone auto-inferred). Lets us upgrade every existing
 * `setXMessage(...)` call site to toasts without touching them.
 */
export function useToastBridge(message) {
  const toast = useToast();
  useEffect(() => {
    if (message) toast.push(message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);
}
