/**
 * Languages whose drafts use the native writing system.
 * All others stay Latin/romanized so Indian-language drafts stay easy to type on Google.
 */
const NATIVE_SCRIPT_LANGUAGES = new Set(['georgian']);

export function usesLatinScript(language: string): boolean {
  return !NATIVE_SCRIPT_LANGUAGES.has(language.trim().toLowerCase());
}
