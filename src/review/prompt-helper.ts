import { SubmittedAnswer } from '../ai-settings/ai-settings.service';
import { usesLatinScript } from './languages';

export type ReviewPromptContext = {
  name: string;
  city?: string;
  state?: string;
  primaryTypeDisplayName?: string;
  starRating: number;
  keywords: string[];
  assignedLanguages: string[];
  answers: SubmittedAnswer[];
  wordTargets: number[];
};

/** Picked per v2 request so drafts from the same shop do not share one register. */
const VOICES = [
  'blunt, a bit impatient',
  'chatty, a bit rambling',
  'mostly facts, little praise',
  'one specific detail then stop',
  'casual and offhand',
] as const;

function pickOne<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Always one keyword when the shop has any, so drafts do not echo the full slogan list. */
function pickTopicHint(keywords: string[]): string | null {
  if (!keywords.length) return null;
  return pickOne(keywords);
}

function locationParts(ctx: ReviewPromptContext): string {
  return [ctx.city, ctx.state].filter(Boolean).join(', ');
}

function answerLines(ctx: ReviewPromptContext): string[] {
  return ctx.answers.map(
    ({ question, answers: selected }) => `- ${question}: ${selected.join(', ')}`,
  );
}

function scriptSpec(language: string): string {
  return usesLatinScript(language)
    ? 'latinScript=true'
    : 'latinScript=false';
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
    '- latinScript=false: write in that language\'s own script (for example Georgian Mkhedruli). Do not romanize or transliterate the review into English letters.',
    '- When latinScript=false, the business name is a proper noun. Keep the same name; only write those sounds in the native script. Do not translate it. Example: "Crush Mens Salon" stays Crush Mens Salon in Georgian letters — never "Krabi" or a translation of the word crush.',
  ];
}

/** Original prompt: weave in keywords, include the listing name, cover visit details. */
export function buildV1Prompt(ctx: ReviewPromptContext): string {
  const location = locationParts(ctx);
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
    location ? `- Location: ${location}` : null,
    `- Customer star rating: ${ctx.starRating} out of 5`,
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
    '- Match the tone to the star rating (higher = more positive; lower = polite constructive).',
    '- Sound like a real customer, not marketing copy.',
    '- If the business name is in all caps, do not write it in all caps. Weave it into the sentence the way a customer would. You may use the full name, a shortened everyday name, or just the kind of place. Example: "CRUSH MENS BEAUTY PARLOUR AND SALOON" can become "Crush salon", "Crush mens salon", or just "salon".',
    '- Do not invent specific staff names, prices, or unverifiable claims.',
    '- Do not include hashtags, emojis, or quotation marks around the whole review.',
    ...scriptRules(),
    '- Aim for approximately the target word count for each review (±15%).',
    '- Keep each suggestion distinct in wording.',
  ]);
}

/** Casual phone-typing prompt: no listing name, at most one keyword, varied voice. */
export function buildV2Prompt(ctx: ReviewPromptContext): string {
  const location = locationParts(ctx);
  const answers = answerLines(ctx);
  const voice = pickOne(VOICES);
  const topicHint = pickTopicHint(ctx.keywords);
  const openings = ctx.wordTargets.map(() =>
    pickOne(['capital', 'lowercase'] as const),
  );

  return joinPrompt([
    'You write Google review drafts as if you are the customer typing on a phone right after the visit.',
    'The review will be posted on this business listing. The reader already knows the name and city.',
    'Return ONLY valid JSON matching this shape:',
    '{"suggestions":[{"text":"...","language":"..."}]}',
    '',
    'Business context (never copy these strings into the review):',
    `- Name: ${ctx.name}`,
    ctx.primaryTypeDisplayName
      ? `- Category: ${ctx.primaryTypeDisplayName}`
      : null,
    location ? `- Location: ${location}` : null,
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
    '- Write like a person, not a copywriter. Contractions. Uneven sentence length. It is fine to stop abruptly.',
    '- Start each draft with a capital or lowercase letter as specified in firstLetter. Do not make every draft start lowercase.',
    '- In at least one draft, start a later sentence with "..." as if a new thought. Do not start the whole review with dots.',
    '- Leave 1–2 small grammar slips per draft (missing apostrophe, dropped "a"/"the", no capital after a period). Do not misspell service words or make the review hard to read.',
    '- Do not mention the business name, city, or area.',
    '- Do not open with "Visited", "Got a … at", or "Had a great experience".',
    '- Do not close with "highly recommend", "must visit", "best in town", "easily the best", "10/10", or "overall".',
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
    '- Each draft must use a different sentence shape. One may be a fragment.',
    '- Do not invent specific staff names, prices, or unverifiable claims.',
    '- Do not refer to staff as "guy", "the guy", "this guy", "lady", or similar placeholders. Describe the work, not a nameless person.',
    '- Do not include hashtags, emojis, or quotation marks around the whole review.',
    ...scriptRules(),
    '- Aim for approximately the target word count for each review (±15%).',
    '',
    'Register to match (tone only — do not reuse these words or phrases):',
    '- "Did a good job, didnt rush it. ...wait was bit long though"',
    '- "came in for the usual. decent, not much talk which i liked"',
    '- "Better then last time. bit pricey but fine"',
  ]);
}
