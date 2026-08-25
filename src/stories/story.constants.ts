export const STORY_TEMPLATES = [
  'sale',
  'festival',
  'cta',
  'hours',
  'new',
  'custom',
] as const;

export type StoryTemplate = (typeof STORY_TEMPLATES)[number];

export const STORY_LOOKS = [
  'festival-gold',
  'hot-sale',
  'night-glam',
  'soft-spa',
  'clean',
  'royal',
] as const;

export type StoryLook = (typeof STORY_LOOKS)[number];

export const STORY_LOOK_HINTS: Record<StoryLook, string> = {
  'festival-gold':
    'Mood only, not a layout: deep chocolate and warm gold, festive lamps and glow, slow premium energy.',
  'hot-sale':
    'Mood only, not a layout: vivid red and cream, loud urgent sale energy, high contrast, packed.',
  'night-glam':
    'Mood only, not a layout: dark navy, neon cyan and pink, urban night, fast, glowing accents.',
  'soft-spa':
    'Mood only, not a layout: blush, cream and lavender, airy boutique spa, gentle light, spacious.',
  clean:
    'Mood only, not a layout: off-white, black type, quiet editorial, modern, lots of space.',
  royal:
    'Mood only, not a layout: matte black and gold, exclusive invitation, slow evening luxury.',
};

export const STORY_PICTURE_MODES = ['photos', 'design'] as const;

export type StoryPicture = (typeof STORY_PICTURE_MODES)[number];

export const STORY_PICTURE_HINTS: Record<StoryPicture, string> = {
  photos:
    'Include rich photographic scenes that fit this local business (people at work, hands, interior, product). A hero photo plus smaller service shots is good. Invent plausible photography. No celebrities, no real brand logos, no readable phone numbers or shop names.',
  design:
    'Graphic poster only: colour, type, shapes, ornaments. No photographs of people or interiors.',
};

export const STORY_DAILY_LIMIT = 5;
export const STORY_MONTHLY_LIMIT = 20;

export const STORY_COMPOSE_MODEL = 'gemini-3.6-flash';
export const STORY_IMAGE_MODEL = 'gemini-3.1-flash-image';
export const STORY_ASPECT_RATIO = '9:16';
export const STORY_IMAGE_SIZE = '1K';
