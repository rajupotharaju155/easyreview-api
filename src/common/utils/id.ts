import { customAlphabet } from 'nanoid';

const ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export const ID_LENGTH = 16;

const generateNanoId = customAlphabet(ALPHABET, ID_LENGTH);

export function generateId(): string {
  return generateNanoId();
}
