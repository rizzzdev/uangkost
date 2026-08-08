---
name: Sistem Manajemen Iuran Kost
colors:
  surface: '#121212'
  surface-dim: '#101419'
  surface-bright: '#36393f'
  surface-container-lowest: '#0b0e13'
  surface-container-low: '#191c21'
  surface-container: '#1E1E1E'
  surface-container-high: '#272a30'
  surface-container-highest: '#32353b'
  on-surface: '#e1e2e9'
  on-surface-variant: '#c1c7d3'
  inverse-surface: '#e1e2e9'
  inverse-on-surface: '#2d3036'
  outline: '#8b919d'
  outline-variant: '#414751'
  surface-tint: '#a4c9ff'
  primary: '#a4c9ff'
  on-primary: '#00315d'
  primary-container: '#60a5fa'
  on-primary-container: '#003a6b'
  inverse-primary: '#0060ac'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#fabd34'
  on-tertiary: '#412d00'
  tertiary-container: '#d19900'
  on-tertiary-container: '#4b3500'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d4e3ff'
  primary-fixed-dim: '#a4c9ff'
  on-primary-fixed: '#001c39'
  on-primary-fixed-variant: '#004883'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdea4'
  tertiary-fixed-dim: '#fabd34'
  on-tertiary-fixed: '#261900'
  on-tertiary-fixed-variant: '#5d4200'
  background: '#101419'
  on-background: '#e1e2e9'
  surface-variant: '#32353b'
  text-primary: '#E0E0E0'
  text-secondary: '#9CA3AF'
  income-emerald: '#34D399'
  expense-coral: '#F87171'
typography:
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-margin: 24px
  gutter: 16px
  stack-gap: 12px
  section-padding: 32px
---

# Design Specifications: Sistem Manajemen Iuran Kost (SMIK)

## 🎨 Global Design Guidelines

- **Theme:** Dark Mode (Deep grays `#121212`, off-whites for text `#E0E0E0`).
- **Style:** Minimalism, clean lines, plenty of negative space.
- **Accents:** Neon or pastel accents for status indicators (e.g., Emerald Green for 'Paid'/Income, Coral Red for 'Unpaid'/Expense, Soft Blue for primary actions).
- **UX Goal:** Intuitive, scannable, and frictionless. Avoid cluttered menus.
- **Visuals:** Modern rounded corners, subtle shadows, and easy-to-read charts (Bar, Doughnut, Line) for data visualization.

---

## 🗂️ Sitemaps (Daftar Halaman)

### 1. Global

- **Halaman Login (Passkey)**: Antarmuka masuk tanpa kata sandi menggunakan biometrik atau PIN perangkat.

### 2. Admin (Pemilik Kost)

- **Admin Dashboard:** Ringkasan statistik keuangan bulanan dan grafik arus kas.
- **Manajemen Keuangan:** Tabel riwayat transaksi, tombol tambah transaksi baru, dan fitur ekspor laporan ke PDF.
- **Manajemen Penghuni:** Daftar seluruh penghuni, indikator status pembayaran bulan berjalan, dan tombol pemicu manual untuk mengirim pengingat WhatsApp.

### 3. Tenant (Penghuni Kost)

- **Tenant Dashboard:** Papan status tagihan pribadi bulan berjalan dan daftar riwayat pembayaran bulan-bulan sebelumnya.
