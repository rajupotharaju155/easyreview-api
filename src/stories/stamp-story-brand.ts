import sharp from 'sharp';

const MIN_FOOTER_RATIO = 0.16;
const SIDE_PAD_RATIO = 0.07;
const NAME_SIZE_RATIO = 0.055;
const MIN_NAME_SIZE_RATIO = 0.032;
const PHONE_SIZE_RATIO = 0.038;

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function estimateWidth(text: string, fontSize: number): number {
  const letters = [...text];
  const upper =
    letters.filter((ch) => ch >= 'A' && ch <= 'Z').length /
    Math.max(letters.length, 1);
  // Arial Bold: caps are wide; stay conservative so we wrap before clipping.
  const em = upper > 0.5 ? 0.72 : 0.58;
  return letters.length * fontSize * em;
}

function wrapToWidth(text: string, fontSize: number, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (estimateWidth(next, fontSize) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

function ellipsize(text: string, fontSize: number, maxWidth: number): string {
  if (estimateWidth(text, fontSize) <= maxWidth) return text;
  const suffix = '…';
  let cut = text;
  while (cut.length > 1 && estimateWidth(cut + suffix, fontSize) > maxWidth) {
    cut = cut.slice(0, -1).trimEnd();
  }
  return `${cut}${suffix}`;
}

function fitName(
  name: string,
  maxWidth: number,
  preferredSize: number,
  minSize: number,
): { lines: string[]; fontSize: number } {
  const trimmed = name.trim();
  if (!trimmed) return { lines: [], fontSize: preferredSize };
  for (let fontSize = preferredSize; fontSize >= minSize; fontSize -= 1) {
    const lines = wrapToWidth(trimmed, fontSize, maxWidth);
    const fits =
      lines.length > 0 &&
      lines.length <= 2 &&
      lines.every((line) => estimateWidth(line, fontSize) <= maxWidth);
    if (fits) return { lines, fontSize };
  }

  const lines = wrapToWidth(trimmed, minSize, maxWidth).slice(0, 2);
  return {
    fontSize: minSize,
    lines: lines.map((line) => ellipsize(line, minSize, maxWidth)),
  };
}

/**
 * Burns shop name and phone into a 9:16 poster so they stay readable.
 * The image model is not trusted to spell this text.
 */
export async function stampStoryBrand(
  image: Buffer,
  name: string | null,
  phone: string | null,
): Promise<{ bytes: Buffer; mimeType: string }> {
  const title = name?.trim() ?? '';
  const phoneText = phone?.trim() ?? '';
  if (!title && !phoneText) {
    return { bytes: image, mimeType: 'image/png' };
  }

  const metadata = await sharp(image).metadata();
  const width = metadata.width ?? 1080;
  const height = metadata.height ?? 1920;
  const maxTextWidth = Math.round(width * (1 - SIDE_PAD_RATIO * 2));
  const preferredNameSize = Math.round(width * NAME_SIZE_RATIO);
  const minNameSize = Math.round(width * MIN_NAME_SIZE_RATIO);
  const { lines, fontSize: nameSize } = fitName(
    title,
    maxTextWidth,
    preferredNameSize,
    minNameSize,
  );
  const phoneSize = Math.round(width * PHONE_SIZE_RATIO);
  const nameLineHeight = Math.round(nameSize * 1.18);
  const blockHeight =
    lines.length * nameLineHeight + (phoneText ? Math.round(phoneSize * 1.55) : 0);
  const verticalPad = Math.round(height * 0.018);
  const footerHeight = Math.max(
    Math.round(height * MIN_FOOTER_RATIO),
    blockHeight + verticalPad * 2,
  );
  const footerTop = height - footerHeight;
  const firstNameY = footerTop + verticalPad + (lines.length ? nameSize : phoneSize);
  const phoneY = lines.length
    ? firstNameY +
      (lines.length - 1) * nameLineHeight +
      Math.round(phoneSize * 1.55)
    : firstNameY;
  const centerX = Math.round(width / 2);

  const nameSpans = lines
    .map((line, index) => {
      const yAttr =
        index === 0
          ? `y="${firstNameY}"`
          : `dy="${nameLineHeight}"`;
      return `<tspan x="${centerX}" ${yAttr}>${escapeXml(line)}</tspan>`;
    })
    .join('');

  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="${footerTop}" width="${width}" height="${footerHeight}" fill="rgba(12,12,16,0.88)"/>
      ${
        nameSpans
          ? `<text x="${centerX}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${nameSize}" font-weight="700" fill="#ffffff">${nameSpans}</text>`
          : ''
      }
      ${
        phoneText
          ? `<text x="${centerX}" y="${phoneY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${phoneSize}" font-weight="500" fill="#e5e7eb">${escapeXml(phoneText)}</text>`
          : ''
      }
    </svg>`,
  );

  const bytes = await sharp(image)
    .composite([{ input: svg, top: 0, left: 0 }])
    .png()
    .toBuffer();

  return { bytes, mimeType: 'image/png' };
}
