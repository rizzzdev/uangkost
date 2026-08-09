export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

let toasts = $state<ToastItem[]>([]);

export function showToast(
  message: string,
  type: ToastItem['type'] = 'info',
  duration = 4000
): string {
  const id = Math.random().toString(36).substring(2, 9);
  const newItem: ToastItem = { id, type, message, duration };

  toasts = [...toasts, newItem];

  if (duration > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }

  return id;
}

export function dismissToast(id: string): void {
  toasts = toasts.filter((t) => t.id !== id);
}

export function getToasts(): ToastItem[] {
  return toasts;
}

export const toast = {
  success: (msg: string, duration?: number) => showToast(msg, 'success', duration),
  error: (msg: string, duration?: number) => showToast(msg, 'error', duration),
  info: (msg: string, duration?: number) => showToast(msg, 'info', duration),
  warning: (msg: string, duration?: number) => showToast(msg, 'warning', duration),
  dismiss: dismissToast
};
