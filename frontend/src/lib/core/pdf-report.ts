import { jsPDF, type jsPDF as JsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatRupiahDisplay } from '$lib/core/format.js';
import type { MonthlyReport } from '$lib/features/finance/types.js';

/** Tipe runtime yang disuntikkan jspdf-autotable ke instance jsPDF. */
type AutoTableDoc = JsPDF & { lastAutoTable: { finalY: number } };

const MARGIN = 14;

/**
 * Pastikan ruang vertikal cukup sebelum menggambar heading section.
 * Bila hampir penuh, pindah ke halaman baru agar heading tidak terpisah dari tabelnya.
 */
function ensureSectionSpace(doc: JsPDF, verticalPosition: number): number {
  const pageBottom = doc.internal.pageSize.getHeight() - 24;
  if (verticalPosition > pageBottom) {
    doc.addPage();
    return 30;
  }
  return verticalPosition;
}

/** Footer nomor halaman - digambar untuk setiap halaman (dipanggil per halaman). */
function drawPageFooter(
  doc: JsPDF,
  pageNum: number,
  totalPages: number,
  month: string,
  pageWidth: number
): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(130);
  doc.text(
    `uangkost - Laporan ${month} (halaman ${pageNum} dari ${totalPages})`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 8,
    { align: 'center' }
  );
  doc.setTextColor(0);
}

/**
 * Buat & unduh laporan keuangan bulanan (PDF).
 * Berisi: ringkasan (saldo awal, pemasukan, pengeluaran, sisa saldo),
 * tabel pemasukan + totalnya, dan tabel pengeluaran + totalnya (fallback teks bila kosong),
 * lalu penutup: hari/tanggal dan "Hormat kami" atas nama Admin uangkost.
 */
export function downloadMonthlyReportPdf(report: MonthlyReport): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header (Centered, bold title + date)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(`Laporan Keuangan Bulanan - ${report.month}`, pageWidth / 2, 20, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(130);
  doc.text(`Dibuat: ${new Date().toLocaleDateString('id-ID')}`, pageWidth / 2, 27, { align: 'center' });
  doc.setTextColor(0);

  // Section Ringkasan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Ringkasan', MARGIN, 40);

  autoTable(doc, {
    startY: 45,
    head: [['Ringkasan', 'Jumlah']],
    body: [
      ['Saldo Awal Bulan', formatRupiahDisplay(report.openingBalance)],
      ['Pemasukan Bulan Ini', formatRupiahDisplay(report.income)],
      ['Pengeluaran Bulan Ini', formatRupiahDisplay(report.expense)],
      ['Sisa Saldo Akhir', formatRupiahDisplay(report.closingBalance)]
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], fontStyle: 'bold' },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: MARGIN, right: MARGIN },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === 3) {
        data.cell.styles.fillColor = [209, 250, 229];
        data.cell.styles.textColor = [6, 78, 59];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });
  let currentY = (doc as AutoTableDoc).lastAutoTable.finalY + 14;

  const incomeItems = report.items.filter(
    (it) => it.type === 'income' && (it.status === 'paid' || it.status === 'partial')
  );
  const expenseItems = report.items.filter((it) => it.type === 'expense');

  // Section Pemasukan
  currentY = ensureSectionSpace(doc, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Pemasukan', MARGIN, currentY);
  currentY += 4;

  if (incomeItems.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(130);
    doc.text('Tidak ada pemasukan pada bulan ini.', MARGIN, currentY + 6);
    doc.setTextColor(0);
    currentY += 14;
  } else {
    autoTable(doc, {
      startY: currentY,
      head: [['Tanggal', 'Penghuni', 'Keterangan', 'Jumlah']],
      body: incomeItems.map((it) => [
        it.transactionDate,
        it.userName ?? '-',
        it.description || it.category,
        formatRupiahDisplay(Number(it.amount))
      ]),
      foot: [
        [
          {
            content: `Total Pemasukan (${report.incomeCount} transaksi)`,
            colSpan: 3
          },
          { content: formatRupiahDisplay(report.income), styles: { halign: 'right' } }
        ]
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], fontStyle: 'bold' },
      footStyles: { fillColor: [209, 250, 229], textColor: [6, 78, 59], fontStyle: 'bold' },
      styles: { fontSize: 9 },
      columnStyles: { 3: { halign: 'right' } },
      margin: { left: MARGIN, right: MARGIN }
    });
    currentY = (doc as AutoTableDoc).lastAutoTable.finalY + 14;
  }

  // Section Pengeluaran
  currentY = ensureSectionSpace(doc, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Pengeluaran', MARGIN, currentY);
  currentY += 4;

  if (expenseItems.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(130);
    doc.text('Tidak ada pengeluaran pada bulan ini.', MARGIN, currentY + 6);
    doc.setTextColor(0);
    currentY += 12;
  } else {
    autoTable(doc, {
      startY: currentY,
      head: [['Tanggal', 'Deskripsi', 'Jumlah']],
      body: expenseItems.map((it) => [
        it.transactionDate,
        it.description || it.category,
        formatRupiahDisplay(Number(it.amount))
      ]),
      foot: [
        [
          {
            content: `Total Pengeluaran (${report.expenseCount} transaksi)`,
            colSpan: 2
          },
          { content: formatRupiahDisplay(report.expense), styles: { halign: 'right' } }
        ]
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], fontStyle: 'bold' },
      footStyles: { fillColor: [254, 226, 226], textColor: [127, 29, 29], fontStyle: 'bold' },
      styles: { fontSize: 9 },
      columnStyles: { 2: { halign: 'right' } },
      margin: { left: MARGIN, right: MARGIN }
    });
    currentY = (doc as AutoTableDoc).lastAutoTable.finalY + 12;
  }

  // Penutup - hormat kami dan nama pengelola (rata kanan)
  const lineHeight = 12;
  // Pastikan blok penutup muat di halaman ini
  if (currentY + lineHeight > doc.internal.pageSize.getHeight() - 24) {
    doc.addPage();
    currentY = 30;
  }
  const rightX = pageWidth - MARGIN;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Hormat kami,', rightX, currentY, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text('Admin uangkost', rightX, currentY + lineHeight, { align: 'right' });

  // Footer untuk SEMUA halaman (termasuk halaman terakhir tanpa tabel)
  const totalPages = doc.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);
    drawPageFooter(doc, pageNum, totalPages, report.month, pageWidth);
  }

  doc.save(`laporan-${report.monthKey}.pdf`);
}
