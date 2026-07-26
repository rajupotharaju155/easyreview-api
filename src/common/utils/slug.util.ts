import { customAlphabet } from 'nanoid';

const SLUG_SUFFIX_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const generateSlugSuffix = customAlphabet(SLUG_SUFFIX_ALPHABET, 4);

/** Split text into lowercase slug word tokens. */
export function slugWordsFromText(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Ordered slug candidates for a location:
 * 1. First 2 name words (or fewer if the name is shorter)
 * 2. First 3 name words, when the name has 3+ words
 * 3. `{2-word-base}-{city}` when a city is available
 *
 * The allocator tries these in order, then falls back to
 * `{2-word-base}-{random}` when all candidates are taken.
 */
export function slugCandidatesFromName(
  name: string,
  city?: string | null,
): string[] {
  const words = slugWordsFromText(name);
  const candidates: string[] = [];

  if (words.length > 0) {
    const twoWordBase = words.slice(0, Math.min(2, words.length)).join('-');
    candidates.push(twoWordBase);

    if (words.length >= 3) {
      candidates.push(words.slice(0, 3).join('-'));
    }

    const cityToken = city ? slugWordsFromText(city)[0] : undefined;
    if (cityToken) {
      const withCity = `${twoWordBase}-${cityToken}`;
      if (!candidates.includes(withCity)) {
        candidates.push(withCity);
      }
    }
  }

  return candidates;
}

export function slugWithSuffix(baseSlug: string): string {
  return `${baseSlug}-${generateSlugSuffix()}`;
}
