export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderRadius?: number;
  borderWidth?: number;
}

export interface ChartDataInput {
  labels: string[];
  datasets: ChartDataset[];
}

export interface DailyPoint {
  date: string;
  income: number;
  expense: number;
}

/** Label sumbu-X "tanggal/bulan" (mis. "08/08") dari daftar harian. */
function dayLabels(days: DailyPoint[]): string[] {
  return days.map((d) => {
    const parts = d.date.split('-');
    return `${parts[2]}/${parts[1]}`;
  });
}

/** Bar chart seri tunggal (pemasukan SAJA atau pengeluaran SAJA) — dipakai di halaman Pemasukan & Pengeluaran. */
export function buildTypeBarData(
  daily: DailyPoint[],
  type: 'income' | 'expense',
  isMobile: boolean
): ChartDataInput {
  const days = daily.slice(isMobile ? -3 : -7);
  const isIncome = type === 'income';
  return {
    labels: dayLabels(days),
    datasets: [
      {
        label: isIncome ? 'Pemasukan' : 'Pengeluaran',
        data: days.map((d) => (isIncome ? d.income : d.expense)),
        backgroundColor: isIncome ? '#34D399' : '#F87171',
        borderColor: isIncome ? '#34D399' : '#F87171',
        borderRadius: 6
      }
    ]
  };
}

/** Doughnut pemasukan vs pengeluaran bulan berjalan. */
export function buildMonthlyDoughnutData(
  monthlyIncome: number,
  monthlyExpense: number
): ChartDataInput {
  return {
    labels: ['Pemasukan', 'Pengeluaran'],
    datasets: [
      {
        label: 'Bulan Ini',
        data: [monthlyIncome, monthlyExpense],
        backgroundColor: ['rgba(52,211,153,0.7)', 'rgba(248,113,113,0.7)'],
        borderColor: ['#34D399', '#F87171'],
        borderWidth: 2
      }
    ]
  };
}
