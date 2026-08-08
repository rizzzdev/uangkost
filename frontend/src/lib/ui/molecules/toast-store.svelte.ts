type ToastVariant = 'info' | 'warning' | 'error' | 'success';

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

let nextId = 0;
const toasts = $state<Toast[]>([]);

function add(message: string, variant: ToastVariant = 'info', durationMs = 4000) {
  const id = nextId++;
  toasts.push({ id, message, variant });
  if (durationMs > 0) {
    setTimeout(() => dismiss(id), durationMs);
  }
}

function dismiss(id: number) {
  const idx = toasts.findIndex((t) => t.id === id);
  if (idx !== -1) toasts.splice(idx, 1);
}

export const toast = {
  info: (msg: string) => add(msg, 'info'),
  warning: (msg: string) => add(msg, 'warning'),
  error: (msg: string) => add(msg, 'error', 6000),
  success: (msg: string) => add(msg, 'success')
};

export function getToastStore() {
  return {
    get toasts() {
      return toasts;
    },
    dismiss
  };
}
