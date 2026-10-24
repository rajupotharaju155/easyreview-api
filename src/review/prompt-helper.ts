import { SubmittedAnswer } from '../ai-settings/ai-settings.service';
import {
  AI_TONE_PROMPTS,
  type ResolvedAiTone,
} from '../ai-settings/constants/tone.constants';
import { usesLatinScript } from './languages';

export type ReviewPromptContext = {
  name: string;
  /** Area drafts may name; null means the business switched place names off. */
  localArea: string | null;
  /** Business-chosen or category-picked tone; null keeps the default voice. */
  tone: ResolvedAiTone | null;
  primaryTypeDisplayName?: string;
  starRating: number;
  keywords: string[];
  assignedLanguages: string[];
  answers: SubmittedAnswer[];
  wordTargets: number[];
};

/** Picked per v2 request so drafts from the same shop do not share one register. */
const VOICES = [
  'relaxed and easygoing',
  'chatty, shares one small detail',
  'matter-of-fact, with a light word of praise',
  'happy, talks about what they liked most',
  'helpful, adds a tip for the next visitor',
] as const;

function pickOne<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Always one keyword when the shop has any, so drafts do not echo the full slogan list. */
function pickTopicHint(keywords: string[]): string | null {
  if (!keywords.length) return null;
  return pickOne(keywords);
}

function locationRule(ctx: ReviewPromptContext): string {
  return ctx.localArea
    ? `- If a draft says where the business is, call the area "${ctx.localArea}". Never name any other area, city, or state.`
    : '- Do not mention any place name: no area, neighbourhood, city, or state.';
}

function answerLines(ctx: ReviewPromptContext): string[] {
  return ctx.answers.map(
    ({ question, answers: selected }) =>
      `- ${question}: ${selected.join(', ')}`,
  );
}

function scriptSpec(language: string): string {
  return usesLatinScript(language) ? 'latinScript=true' : 'latinScript=false';
}

function specLines(ctx: ReviewPromptContext): string[] {
  return ctx.wordTargets.map((wordCount, index) => {
    const language = ctx.assignedLanguages[index];
    return `${index + 1}. language="${language}", ${scriptSpec(language)}, targetWordCount=${wordCount}`;
  });
}

function joinPrompt(lines: Array<string | null>): string {
  return lines.filter((line) => line !== null).join('\n');
}

function scriptRules(): string[] {
  return [
    '- Write each draft in its assigned language, using the script that draft specifies.',
    '- latinScript=true: write that language using Latin/English letters only (transliteration). Never use native scripts such as Telugu, Hindi, or Arabic script.',
    "- latinScript=false: write in that language's own script (for example Georgian Mkhedruli). Do not romanize or transliterate the review into English letters.",
    '- When latinScript=false, the business name is a proper noun. Keep the same name; only write those sounds in the native script. Do not translate it. Example: "Crush Mens Salon" stays Crush Mens Salon in Georgian letters — never "Krabi" or a translation of the word crush.',
  ];
}

/** Original prompt: weave in keywords, include the listing name, cover visit details. */
export function buildV1Prompt(ctx: ReviewPromptContext): string {
  const answers = answerLines(ctx);

  return joinPrompt([
    'You write short, authentic Google review drafts for customers.',
    'Return ONLY valid JSON matching this shape:',
    '{"suggestions":[{"text":"...","language":"..."}]}',
    '',
    `The customer visited ${ctx.name}.`,
    ctx.primaryTypeDisplayName
      ? `- Category: ${ctx.primaryTypeDisplayName}`
      : null,
    ctx.localArea ? `- Area: ${ctx.localArea}` : null,
    `- Customer star rating: ${ctx.starRating} out of 5`,
    ctx.tone ? `- Tone: ${AI_TONE_PROMPTS[ctx.tone]}` : null,
    `- Keywords to naturally weave in when relevant: ${ctx.keywords.join(', ') || 'none'}`,
    ...(answers.length
      ? ['', 'What this customer told us about their visit:', ...answers]
      : []),
    '',
    `Generate exactly ${ctx.wordTargets.length} review drafts with these exact specs:`,
    ...specLines(ctx),
    '',
    'Rules:',
    ...(answers.length
      ? [
          '- Ground every draft in the visit details above; treat them as facts about this specific customer.',
          '- Work those details into the sentences. Never list them or echo the question wording.',
          '- If the customer named several things, include all of them naturally — they are all true of this visit.',
        ]
      : []),
    ctx.primaryTypeDisplayName
      ? '- Only mention services, staff roles, and details that a customer of this category would plausibly experience.'
      : null,
    ctx.tone
      ? '- Write every draft in the tone above, and let the star rating set how positive it is (lower = polite constructive).'
      : '- Match the tone to the star rating (higher = more positive; lower = polite constructive).',
    '- Sound like a real customer, not marketing copy.',
    '- If the business name is in all caps, do not write it in all caps. Weave it into the sentence the way a customer would. You may use the full name, a shortened everyday name, or just the kind of place. Example: "CRUSH MENS BEAUTY PARLOUR AND SALOON" can become "Crush salon", "Crush mens salon", or just "salon".',
    locationRule(ctx),
    '- Do not invent specific staff names, prices, or unverifiable claims.',
    '- Do not include hashtags, emojis, or quotation marks around the whole review.',
    ...scriptRules(),
    '- Aim for approximately the target word count for each review (±15%).',
    '- Keep each suggestion distinct in wording.',
  ]);
}

/** Casual customer prompt: no business or place name, at most one keyword, varied voice. */
export function buildV2Prompt(ctx: ReviewPromptContext): string {
  const answers = answerLines(ctx);
  // Only casual (or no) tone reaches v2; casual keeps the random voices.
  const voice = pickOne(VOICES);
  const topicHint = pickTopicHint(ctx.keywords);
  const openings = ctx.wordTargets.map(() =>
    pickOne(['capital', 'lowercase'] as const),
  );

  return joinPrompt([
    'You write Google review drafts as if you are the customer typing on a phone right after the visit.',
    'The review will be posted on this business listing. The customer and the reader already know which place it is, so the customer just talks about it.',
    'Return ONLY valid JSON matching this shape:',
    '{"suggestions":[{"text":"...","language":"..."}]}',
    '',
    'Business context (never copy these strings into the review):',
    `- Name: ${ctx.name}`,
    ctx.primaryTypeDisplayName
      ? `- Category: ${ctx.primaryTypeDisplayName}`
      : null,
    ctx.localArea ? `- Area: ${ctx.localArea}` : null,
    `- Customer star rating: ${ctx.starRating} out of 5`,
    `- Voice for this batch: ${voice}`,
    topicHint
      ? `- Include this topic in the review, in your own words, not as a slogan: ${topicHint}`
      : '- Do not force any marketing phrases or slogans into the review.',
    ...(answers.length
      ? ['', 'What this customer told us about their visit:', ...answers]
      : []),
    '',
    `Generate exactly ${ctx.wordTargets.length} review drafts with these exact specs:`,
    ...specLines(ctx).map(
      (line, index) => `${line}, firstLetter=${openings[index]}`,
    ),
    '',
    'Rules:',
    '- Write like a friendly, ordinary person, not a copywriter. Use contractions and complete, easy-flowing sentences.',
    '- Start each draft with a capital or lowercase letter as specified in firstLetter. Do not make every draft start lowercase.',
    '- Do not mention the business name, city, or area. Refer to the place by its kind, e.g. "this resort", "the salon", "this place".',
    '- Casual punctuation is fine, but keep it easy to read. Do not add deliberate spelling or grammar mistakes.',
    '- Do not open with "Visited", "Got a … at", or "Had a great experience".',
    '- Do not close with "highly recommend", "best in town", "easily the best", "10/10", or "overall".',
    '- Do not use slogan phrasing (friendly staff, hidden gem, exceeded expectations, from start to finish).',
    ...(answers.length
      ? [
          '- Treat the visit details as facts about this customer. Never list them or echo the question wording.',
          '- Do not try to cover every visit detail. Pick 1–2 things and talk only about those.',
        ]
      : []),
    ctx.primaryTypeDisplayName
      ? '- Only mention services, staff roles, and details that a customer of this category would plausibly experience.'
      : null,
    '- Match positivity to the star rating, but a high rating can still be casual and specific rather than glowing.',
    '- Each draft must use a different sentence shape.',
    '- Do not invent specific staff names, prices, or unverifiable claims.',
    '- Do not refer to staff as "guy", "the guy", "this guy", "lady", or similar placeholders. Describe the work, not a nameless person.',
    '- Do not include hashtags, emojis, or quotation marks around the whole review.',
    ...scriptRules(),
    '- Aim for approximately the target word count for each review (±15%).',
    '',
    'Register to match (tone only — do not reuse these words or phrases):',
    '- "this is a decent resort with all amenities, must visit during summers when all activities are open."',
    '- "Good haircut and they took their time to get it right. Will come back for the next one."',
    '- "nice cozy place for a quick coffee, the cold brew is really good."',
  ]);
}
