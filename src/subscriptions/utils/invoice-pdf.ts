import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const MARK_SIZE = 36;
const PURPLE = rgb(0.486, 0.227, 0.929);
const INK = rgb(0.059, 0.09, 0.165);
const MUTED = rgb(0.392, 0.455, 0.545);
const LINE = rgb(0.886, 0.91, 0.941);
const SURFACE = rgb(0.973, 0.98, 0.988);

export type InvoicePayload = {
  invoiceNumber: string;
  issuedAtLabel: string;
  billToName: string;
  billToLines: string[];
  planName: string;
  periodLabel: string;
  amountLabel: string;
  paymentStatusLabel: string;
  paymentProviderLabel: string | null;
  utr: string | null;
  paymentId: string | null;
  subscriptionId: string;
  locationName: string;
};

function pdfSafe(text: string): string {
  return Array.from(text)
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code === 9 || code === 10 || code === 13) return char;
      if (code >= 32 && code <= 126) return char;
      if (char === '₹') return 'Rs.';
      if (char === '—' || char === '–' || char === '−') return '-';
      return '?';
    })
    .join('');
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = INK,
): void {
  page.drawText(pdfSafe(text), { x, y, font, size, color });
}

function readLogoMarkPng(): Buffer {
  const candidates = [
    join(__dirname, '../../assets/logo-mark.png'),
    join(__dirname, '../../../assets/logo-mark.png'),
    join(process.cwd(), 'src/assets/logo-mark.png'),
    join(process.cwd(), 'dist/src/assets/logo-mark.png'),
    join(process.cwd(), 'dist/assets/logo-mark.png'),
  ];
  const path = candidates.find((file) => existsSync(file));
  if (!path) {
    throw new Error('Invoice logo-mark.png was not found in src/assets');
  }
  return readFileSync(path);
}

export async function buildSubscriptionInvoicePdf(
  payload: InvoicePayload,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_HEIGHT - MARGIN;
  const logo = await doc.embedPng(readLogoMarkPng());
  const markWidth = (logo.width / logo.height) * MARK_SIZE;
  page.drawImage(logo, {
    x: MARGIN,
    y: y - MARK_SIZE + 8,
    width: markWidth,
    height: MARK_SIZE,
  });
  drawText(
    page,
    'EasyReview',
    MARGIN + markWidth + 10,
    y - 8,
    bold,
    18,
    PURPLE,
  );

  drawText(
    page,
    'INVOICE',
    PAGE_WIDTH - MARGIN - bold.widthOfTextAtSize('INVOICE', 22),
    y - 8,
    bold,
    22,
    INK,
  );
  y -= MARK_SIZE + 12;

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1.5,
    color: PURPLE,
  });
  y -= 28;

  const metaX = PAGE_WIDTH - MARGIN - 210;
  drawText(page, 'Invoice number', metaX, y, regular, 9, MUTED);
  drawText(page, payload.invoiceNumber, metaX, y - 14, bold, 11);
  drawText(page, 'Date', metaX, y - 36, regular, 9, MUTED);
  drawText(page, payload.issuedAtLabel, metaX, y - 50, bold, 11);
  drawText(page, 'Status', metaX, y - 72, regular, 9, MUTED);
  drawText(page, payload.paymentStatusLabel, metaX, y - 86, bold, 11);

  drawText(page, 'Bill to', MARGIN, y, regular, 9, MUTED);
  y -= 16;
  drawText(page, payload.billToName, MARGIN, y, bold, 12);
  y -= 16;
  for (const line of payload.billToLines) {
    const wrapped = wrapText(line, regular, 10, 280);
    for (const part of wrapped) {
      drawText(page, part, MARGIN, y, regular, 10, MUTED);
      y -= 14;
    }
  }

  y = Math.min(y, PAGE_HEIGHT - MARGIN - 175);
  y -= 12;

  page.drawRectangle({
    x: MARGIN,
    y: y - 22,
    width: CONTENT_WIDTH,
    height: 28,
    color: SURFACE,
  });
  drawText(page, 'Description', MARGIN + 12, y - 12, bold, 9, MUTED);
  drawText(page, 'Period', MARGIN + 250, y - 12, bold, 9, MUTED);
  const amountHeader = 'Amount';
  drawText(
    page,
    amountHeader,
    PAGE_WIDTH - MARGIN - 12 - bold.widthOfTextAtSize(amountHeader, 9),
    y - 12,
    bold,
    9,
    MUTED,
  );
  y -= 40;

  const planLines = wrapText(payload.planName, bold, 11, 220);
  const periodLines = wrapText(payload.periodLabel, regular, 10, 160);
  const rowLines = Math.max(planLines.length, periodLines.length, 1);
  for (let i = 0; i < rowLines; i += 1) {
    if (planLines[i])
      drawText(
        page,
        planLines[i],
        MARGIN + 12,
        y,
        i === 0 ? bold : regular,
        11,
      );
    if (periodLines[i])
      drawText(page, periodLines[i], MARGIN + 250, y, regular, 10, MUTED);
    if (i === 0) {
      drawText(
        page,
        payload.amountLabel,
        PAGE_WIDTH -
          MARGIN -
          12 -
          bold.widthOfTextAtSize(payload.amountLabel, 11),
        y,
        bold,
        11,
      );
    }
    y -= 16;
  }

  drawText(page, payload.locationName, MARGIN + 12, y, regular, 9, MUTED);
  y -= 20;

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.75,
    color: LINE,
  });
  y -= 24;

  drawText(page, 'Total', MARGIN + 250, y, bold, 12);
  drawText(
    page,
    payload.amountLabel,
    PAGE_WIDTH - MARGIN - 12 - bold.widthOfTextAtSize(payload.amountLabel, 12),
    y,
    bold,
    12,
  );
  y -= 36;

  drawText(page, 'Payment details', MARGIN, y, bold, 11);
  y -= 18;

  const details: Array<[string, string]> = [
    ['Subscription ID', payload.subscriptionId],
  ];
  if (payload.paymentId) details.push(['Payment ID', payload.paymentId]);
  if (payload.paymentProviderLabel) {
    details.push(['Method', payload.paymentProviderLabel]);
  }
  if (payload.utr) details.push(['UTR / reference', payload.utr]);

  for (const [label, value] of details) {
    drawText(page, label, MARGIN, y, regular, 9, MUTED);
    drawText(page, value, MARGIN + 130, y, regular, 10);
    y -= 16;
  }

  y -= 28;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.75,
    color: LINE,
  });
  y -= 18;
  drawText(
    page,
    'This is a computer-generated invoice. No signature is required.',
    MARGIN,
    y,
    regular,
    9,
    MUTED,
  );
  y -= 14;
  drawText(
    page,
    'Questions? Email raju@easyreview.co.in',
    MARGIN,
    y,
    regular,
    9,
    MUTED,
  );

  return doc.save();
}
