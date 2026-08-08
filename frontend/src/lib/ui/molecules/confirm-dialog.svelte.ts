export type ConfirmVariant = 'danger' | 'primary';

interface ConfirmRequest {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant: ConfirmVariant;
}

let pending = $state<ConfirmRequest | null>(null);
let resolver: ((ok: boolean) => void) | null = null;

/**
 * Tampilkan confirmation dialog (pengganti `confirm()` native).
 * Resolve `true` bila user menekan tombol konfirmasi, `false` bila batal.
 */
export function askConfirm(options: {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
}): Promise<boolean> {
  return new Promise((resolve) => {
    pending = {
      title: options.title,
      message: options.message,
      confirmText: options.confirmText ?? 'Hapus',
      cancelText: options.cancelText ?? 'Batal',
      variant: options.variant ?? 'danger'
    };
    resolver = resolve;
  });
}

function settle(ok: boolean): void {
  pending = null;
  resolver?.(ok);
  resolver = null;
}

export function confirmDialogStore() {
  return {
    get pending() {
      return pending;
    },
    confirm: () => settle(true),
    cancel: () => settle(false)
  };
}
