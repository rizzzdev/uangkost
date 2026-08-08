import { jsPDF, type jsPDF as JsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { MonthlyReport } from '$lib/features/finance/types.js';

/** Tipe runtime yang disuntikkan jspdf-autotable ke instance jsPDF. */
type AutoTableDoc = JsPDF & { lastAutoTable: { finalY: number } };

function rupiah(n: number): string {
  return `Rp ${Math.floor(n).toLocaleString('id-ID')}`;
}

/**
 * Buat & unduh laporan keuangan bulanan (PDF).
 * Berisi: ringkasan (saldo awal, pemasukan, pengeluaran, sisa saldo),
 * baris perhitungan, dan tabel semua transaksi pemasukan & pengeluaran bulan tersebut.
 */
export function downloadMonthlyReportPdf(report: MonthlyReport): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('uangkost', 14, 16);
  doc.setFontSize(12);
  doc.text(`Laporan Keuangan Bulanan — ${report.month}`, 14, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(130);
  doc.text(`Dibuat: ${new Date().toLocaleDateString('id-ID')}`, 14, 30);
  doc.setTextColor(0);

  // Ringkasan
  autoTable(doc, {
    startY: 36,
    head: [['Ringkasan', 'Jumlah']],
    body: [
      ['Saldo Awal Bulan', rupiah(report.openingBalance)],
      ['Pemasukan Bulan Ini', rupiah(report.income)],
      ['Pengeluaran Bulan Ini', rupiah(report.expense)],
      ['Sisa Saldo Akhir', rupiah(report.closingBalance)]
    ],
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], fontStyle: 'bold' },
    styles: { fontSize: 10 },
    columnStyles: { 1: { halign: 'right' } }
  });

  const finalY = (doc as AutoTableDoc).lastAutoTable.finalY;

  // Hitung-hitungan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Perhitungan:', 14, finalY + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${rupiah(report.openingBalance)} + ${rupiah(report.income)} - ${rupiah(report.expense)} = ${rupiah(report.closingBalance)}`,
    14,
    finalY + 16
  );
  doc.setFontSize(8);
  doc.setTextColor(130);
  doc.text('(Pemasukan = pembayaran lunas/terverifikasi pada bulan ini)', 14, finalY + 21);
  doc.setTextColor(0);

  // Tabel transaksi
  const body = report.items.map((it) => [
    it.transactionDate,
    it.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
    it.description || it.category,
    it.type === 'income' ? (it.userName ?? '-') : '-',
    rupiah(Number(it.amount))
  ]);

  autoTable(doc, {
    startY: finalY + 27,
    head: [['Tanggal', 'Jenis', 'Keterangan', 'Penghuni', 'Jumlah']],
    body,
    foot: [
      ['', 'Total Pemasukan', '', `(${report.incomeCount} transaksi)`, rupiah(report.income)],
      ['', 'Total Pengeluaran', '', `(${report.expenseCount} transaksi)`, rupiah(report.expense)]
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    styles: { fontSize: 9 },
    columnStyles: { 4: { halign: 'right' } },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      // Footer halaman
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(130);
      doc.text(
        `uangkost - Laporan ${report.month} (halaman ${pageCount})`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      );
      doc.setTextColor(0);
    }
  });

  doc.save(`laporan-${report.monthKey}.pdf`);
}
