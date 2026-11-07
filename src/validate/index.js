// Pure validator for listing and pin JSON. Takes the parsed document and a
// config of { rules, bannedWords } (see rules.js). Returns one result per rule:
// { rule, label, status: 'pass' | 'fail' | 'warn' | 'skip', detail }.
import { charCount, countEmDashes, findHashtags, findPhrases, findRepeatedPhrases, words } from './checks.js';

export { readImageInfo } from './image.js';

const result = (rule, label, status, detail) => ({ rule, label, status, detail });
const passFail = (ok) => (ok ? 'pass' : 'fail');
const isText = (v) => typeof v === 'string';
const missing = (rule, label, field) => result(rule, label, 'fail', `missing ${field}`);

export function detectType(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  if ('textOverlay' in doc || 'taggedTopics' in doc) return 'pin';
  if ('tags' in doc || 'basketSummary' in doc) return 'listing';
  return null;
}

function maxChars(rule, label, value, field, max) {
  if (!isText(value)) return missing(rule, label, field);
  const n = charCount(value);
  return result(rule, label, passFail(n <= max), `${n}/${max} chars`);
}

function noEmDash(rule, label, value, field) {
  if (!isText(value)) return missing(rule, label, field);
  const n = countEmDashes(value);
  return result(rule, label, passFail(n === 0), `${n} em dash${n === 1 ? '' : 'es'}`);
}

function copyChecks(texts, config) {
  const text = texts.filter(isText).join('\n');
  const banned = findPhrases(text, config.bannedWords);
  const mentions = findPhrases(text, config.rules.copy.forbiddenMentions);
  return [
    result('copy.bannedWords', 'No banned words', passFail(banned.length === 0),
      banned.length ? `${banned.length} found: ${banned.join(', ')}` : `0 of ${config.bannedWords.length} found`),
    result('copy.forbiddenMentions', 'No forbidden mentions', passFail(mentions.length === 0),
      mentions.length ? `${mentions.length} found: ${mentions.join(', ')}` : '0 found'),
  ];
}

export function validateListing(listing, config) {
  const r = config.rules.listing;
  const out = [];
  const { title, tags, basketSummary, description } = listing;

  out.push(maxChars('listing.title.maxChars', 'Title length', title, 'title', r.title.maxChars));

  if (isText(title)) {
    const n = words(title).length;
    out.push(result('listing.title.maxWordsSoft', 'Title word count (soft)',
      n <= r.title.maxWordsSoft ? 'pass' : 'warn', `${n}/${r.title.maxWordsSoft} words`));
  } else {
    out.push(missing('listing.title.maxWordsSoft', 'Title word count (soft)', 'title'));
  }

  if (r.title.noRepeatedPhrase) {
    if (isText(title)) {
      const repeats = findRepeatedPhrases(title);
      out.push(result('listing.title.noRepeatedPhrase', 'No repeated phrase in title', passFail(repeats.length === 0),
        repeats.length ? `repeated: ${repeats.map((p) => `"${p}"`).join(', ')}` : '0 repeated phrases'));
    } else {
      out.push(missing('listing.title.noRepeatedPhrase', 'No repeated phrase in title', 'title'));
    }
  }

  const tagList = Array.isArray(tags) ? tags : null;
  if (tagList) {
    out.push(result('listing.tags.exactCount', 'Tag count', passFail(tagList.length === r.tags.exactCount),
      `${tagList.length}/${r.tags.exactCount} tags`));

    const tooLong = tagList.filter((t) => !isText(t) || charCount(t) > r.tags.maxCharsEach);
    const longest = Math.max(0, ...tagList.filter(isText).map(charCount));
    out.push(result('listing.tags.maxCharsEach', 'Tag length', passFail(tooLong.length === 0),
      tooLong.length
        ? `${tooLong.length} over ${r.tags.maxCharsEach}: ${tooLong.map((t) => `"${t}" (${charCount(String(t))})`).join(', ')}`
        : `longest ${longest}/${r.tags.maxCharsEach} chars`));

    if (r.tags.noDuplicates) {
      const seen = new Set();
      const dupes = new Set();
      for (const t of tagList.filter(isText)) {
        const key = t.trim().toLowerCase();
        if (seen.has(key)) dupes.add(key);
        seen.add(key);
      }
      out.push(result('listing.tags.noDuplicates', 'No duplicate tags', passFail(dupes.size === 0),
        dupes.size ? `${dupes.size} duplicate: ${[...dupes].map((d) => `"${d}"`).join(', ')}` : '0 duplicates'));
    }

    const anchors = config.rules.anchorTagsFlagged.filter((a) =>
      tagList.some((t) => isText(t) && t.trim().toLowerCase() === a.toLowerCase()));
    out.push(result('anchorTagsFlagged', 'Weak anchor tags (flag only)', anchors.length ? 'warn' : 'pass',
      anchors.length ? `${anchors.length} weak tag${anchors.length === 1 ? '' : 's'}: ${anchors.join(', ')} (see knowledge/tag-scores.md)` : '0 weak anchor tags'));
  } else {
    for (const [rule, label] of [
      ['listing.tags.exactCount', 'Tag count'],
      ['listing.tags.maxCharsEach', 'Tag length'],
      ['listing.tags.noDuplicates', 'No duplicate tags'],
      ['anchorTagsFlagged', 'Weak anchor tags (flag only)'],
    ]) out.push(missing(rule, label, 'tags'));
  }

  out.push(maxChars('listing.basketSummary.maxChars', 'Basket summary length', basketSummary, 'basketSummary', r.basketSummary.maxChars));

  if (r.description.noEmDash) {
    out.push(noEmDash('listing.description.noEmDash', 'No em dash in description', description, 'description'));
  }

  if (isText(description)) {
    const has = findPhrases(description, [r.description.requiresPhrase]).length > 0;
    out.push(result('listing.description.requiresPhrase', `Description says "${r.description.requiresPhrase}"`, passFail(has),
      has ? 'found' : 'not found'));
  } else {
    out.push(missing('listing.description.requiresPhrase', `Description says "${r.description.requiresPhrase}"`, 'description'));
  }

  out.push(...copyChecks([title, description, basketSummary, ...(tagList || [])], config));
  return out;
}

export function validatePin(pin, config, { image } = {}) {
  const r = config.rules.pin;
  const out = [];
  const { title, description, textOverlay, altText, taggedTopics } = pin;

  out.push(maxChars('pin.title.maxChars', 'Pin title length', title, 'title', r.title.maxChars));

  if (isText(description)) {
    const n = charCount(description);
    const { minChars, maxChars: max } = r.description;
    out.push(result('pin.description.length', 'Pin description length', passFail(n >= minChars && n <= max),
      `${n} chars (allowed ${minChars} to ${max})`));
  } else {
    out.push(missing('pin.description.length', 'Pin description length', 'description'));
  }

  if (r.description.noHashtags) {
    if (isText(description)) {
      const tags = findHashtags(description);
      out.push(result('pin.description.noHashtags', 'No hashtags', passFail(tags.length === 0),
        tags.length ? `${tags.length} found: ${tags.join(', ')}` : '0 hashtags'));
    } else {
      out.push(missing('pin.description.noHashtags', 'No hashtags', 'description'));
    }
  }

  if (r.description.noEmDash) {
    out.push(noEmDash('pin.description.noEmDash', 'No em dash in pin description', description, 'description'));
  }

  if (isText(textOverlay)) {
    const n = words(textOverlay).length;
    const { minWords, maxWords } = r.overlay;
    out.push(result('pin.overlay.words', 'Overlay word count', passFail(n >= minWords && n <= maxWords),
      `${n} words (allowed ${minWords} to ${maxWords})`));
  } else {
    out.push(missing('pin.overlay.words', 'Overlay word count', 'textOverlay'));
  }

  const { width, height, maxMB } = r.image;
  if (!image) {
    const why = pin.imagePath ? `not read (${pin.imagePath})` : 'no image given';
    out.push(result('pin.image.dimensions', 'Image size in px', 'skip', why));
    out.push(result('pin.image.maxMB', 'Image file size', 'skip', why));
  } else if (image.error) {
    out.push(result('pin.image.dimensions', 'Image size in px', 'fail', image.error));
    out.push(result('pin.image.maxMB', 'Image file size', 'fail', image.error));
  } else {
    const known = image.format === 'png' || image.format === 'jpeg';
    const dimsOk = known && image.width === width && image.height === height;
    out.push(result('pin.image.dimensions', 'Image size in px', passFail(dimsOk),
      known ? `${image.width} x ${image.height} ${image.format} (need ${width} x ${height})` : 'not a PNG or JPEG'));
    const mb = image.bytes / 1_000_000;
    out.push(result('pin.image.maxMB', 'Image file size', passFail(mb <= maxMB), `${mb.toFixed(2)}/${maxMB} MB`));
  }

  if (Array.isArray(taggedTopics)) {
    out.push(result('pin.taggedTopicsMax', 'Tagged topics', passFail(taggedTopics.length <= r.taggedTopicsMax),
      `${taggedTopics.length}/${r.taggedTopicsMax} topics`));
  } else {
    out.push(result('pin.taggedTopicsMax', 'Tagged topics', 'pass', '0 topics (none given)'));
  }

  out.push(...copyChecks([title, description, textOverlay, altText], config));
  return out;
}

export function validate(doc, config, options = {}) {
  const type = options.type || detectType(doc);
  if (type === 'listing') return { type, results: validateListing(doc, config) };
  if (type === 'pin') return { type, results: validatePin(doc, config, options) };
  return {
    type: null,
    results: [result('document.type', 'Document type', 'fail', 'could not tell if this is a listing or a pin')],
  };
}

export const hasFailures = (results) => results.some((x) => x.status === 'fail');

export function formatReport(results) {
  const width = Math.max(...results.map((x) => x.rule.length));
  const lines = results.map((x) => `${x.status.toUpperCase().padEnd(4)}  ${x.rule.padEnd(width)}  ${x.detail}`);
  const count = (s) => results.filter((x) => x.status === s).length;
  lines.push(`${count('pass')} passed, ${count('fail')} failed, ${count('warn')} warnings, ${count('skip')} skipped`);
  return lines.join('\n');
}
