// Small text helpers. No Node APIs, so the extension can reuse them.

export function charCount(text) {
  return [...(text ?? '')].length;
}

// Words are whitespace-separated tokens that contain a letter or digit,
// so "|" and "&" in titles are not counted.
export function words(text) {
  return (text ?? '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
}

function normalizeQuotes(text) {
  return (text ?? '').replace(/[‘’]/g, "'");
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Case-insensitive whole-word match. Returns the phrases that appear.
export function findPhrases(text, phrases) {
  const haystack = normalizeQuotes(text);
  return phrases.filter((phrase) => {
    const p = escapeRegExp(normalizeQuotes(phrase));
    return new RegExp(`(?<![\\p{L}\\p{N}])${p}(?![\\p{L}\\p{N}])`, 'iu').test(haystack);
  });
}

export function countEmDashes(text) {
  return ((text ?? '').match(/—/g) || []).length;
}

// A hashtag is "#" followed by a word that contains at least one letter.
export function findHashtags(text) {
  return (text ?? '').match(/(?<![\p{L}\p{N}&/])#(?=[\p{L}\p{N}_]*\p{L})[\p{L}\p{N}_]+/gu) || [];
}

const STOP_WORDS = new Set(['a', 'an', 'and', 'or', 'the', 'of', 'for', 'with', 'in', 'on', 'to']);

// Phrases of 2+ words that appear more than once without overlapping.
// "Hand-Drawn" and "hand drawn" count as the same phrase. Single repeated
// words (e.g. "Brushes") are allowed.
export function findRepeatedPhrases(text) {
  const tokens = normalizeQuotes(text).toLowerCase().split(/[^\p{L}\p{N}']+/u).filter(Boolean);
  const found = new Set();
  for (let n = 2; n <= Math.floor(tokens.length / 2); n++) {
    const firstSeen = new Map();
    for (let i = 0; i + n <= tokens.length; i++) {
      const gram = tokens.slice(i, i + n);
      if (gram.every((t) => STOP_WORDS.has(t))) continue;
      const key = gram.join(' ');
      if (!firstSeen.has(key)) firstSeen.set(key, i);
      else if (i >= firstSeen.get(key) + n) found.add(key);
    }
  }
  const list = [...found];
  return list.filter((p) => !list.some((q) => q !== p && q.includes(p)));
}

export function parseBannedWords(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}
