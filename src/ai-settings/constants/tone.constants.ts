export const AI_TONES = [
  'auto',
  'casual',
  'warm',
  'professional',
  'respectful',
  'enthusiastic',
  'premium',
] as const;

export type AiTone = (typeof AI_TONES)[number];

/** A tone the prompt can use; `auto` always resolves to one of these or to none. */
export type ResolvedAiTone = Exclude<AiTone, 'auto'>;

/** How each tone is described to the model. */
export const AI_TONE_PROMPTS: Record<ResolvedAiTone, string> = {
  casual: 'casual — relaxed, everyday words, short sentences',
  warm: 'warm — friendly and personal, a little emotional, like telling a friend',
  professional:
    'professional — polite, clear, and factual; no slang or exaggeration',
  respectful:
    'respectful — calm, grateful, and reassuring; never jokey, slangy, or over-excited',
  enthusiastic:
    'enthusiastic — high energy and excited; an exclamation mark or two is fine',
  premium:
    'premium — polished and refined; notices the experience and the details',
};

/**
 * Auto tone by Google place type or category name, checked in order so the
 * more sensitive categories win. Unmatched categories get no tone line.
 */
const AUTO_TONE_RULES: Array<{ tone: ResolvedAiTone; pattern: RegExp }> = [
  {
    tone: 'respectful',
    pattern:
      /hospital|doctor|clinic|medical|dentist|dental|physiotherap|health|pharmacy|drugstore|astrolog|psychic|spiritual|temple|church|mosque|gurudwara|place_of_worship|funeral|cemetery|counsel|psycholog|nursing|elder|old age/,
  },
  {
    tone: 'premium',
    pattern:
      /fine_dining|fine dining|jewel|luxury|resort|spa\b|wedding|banquet|bridal/,
  },
  {
    tone: 'professional',
    pattern:
      /lawyer|legal|advocate|account|tax|insurance|bank|finance|real_estate|real estate|consult|school|college|university|coaching|tutor|education|software|it services|corporate|travel_agency|travel agency|car_repair|car repair|car_dealer|electrician|plumber|contractor/,
  },
  {
    tone: 'enthusiastic',
    pattern:
      /amusement|water_park|play|event|party|adventure|bowling|trampoline|escape|arcade|dessert|ice_cream|ice cream|makeup|kids|children/,
  },
  {
    tone: 'warm',
    pattern:
      /family|bed_and_breakfast|guest_house|homestay|pet|veterinar|child_care|daycare|sweet|confectioner|florist|gift/,
  },
  {
    tone: 'casual',
    pattern:
      /cafe|coffee|tea|restaurant|food|bakery|bar\b|pub|salon|barber|beauty|gym|fitness|store|shop/,
  },
];

export function resolveAutoTone(category: {
  primaryType?: string | null;
  primaryTypeDisplayName?: string | null;
  types?: string[] | null;
}): ResolvedAiTone | null {
  // Primary type first, so a cafe that also lists "store" is judged as a cafe.
  const candidates = [
    category.primaryType,
    category.primaryTypeDisplayName,
    (category.types ?? []).join(' '),
  ]
    .filter(Boolean)
    .map((text) => (text as string).toLowerCase());

  for (const text of candidates) {
    const rule = AUTO_TONE_RULES.find(({ pattern }) => pattern.test(text));
    if (rule) return rule.tone;
  }
  return null;
}
