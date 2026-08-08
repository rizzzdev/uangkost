/**
 * Deteksi mode mobile secara reaktif (default breakpoint 768px).
 * Dipakai untuk grafik: 3 hari di mobile, 7 hari di desktop.
 *
 * Mengembalikan `{ value }` dengan getter agar pembacaan tetap tertrack
 * oleh Svelte (pola yang sama dengan feature store lain di project ini).
 */
export function useIsMobile(breakpoint = 768): { value: boolean } {
  let isMobile = $state(typeof window === 'undefined' ? true : window.innerWidth < breakpoint);

  $effect(() => {
    const handler = () => {
      isMobile = window.innerWidth < breakpoint;
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  });

  return {
    get value() {
      return isMobile;
    }
  };
}
