import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig, REPO_ROOT } from '../src/validate/rules.js';
import { validate, validateListing, validatePin, formatReport, hasFailures, detectType, readImageInfo } from '../src/validate/index.js';

const config = loadConfig();
const sample = (name) => JSON.parse(readFileSync(resolve(REPO_ROOT, 'data/samples', name), 'utf8'));
const validListing = sample('cozy-christmas-listing.json');
const validPin = sample('cozy-christmas-pin-1.json');
const invalidListing = sample('invalid-listing.json');

const listingWith = (patch) => ({ ...structuredClone(validListing), ...patch });
const pinWith = (patch) => ({ ...structuredClone(validPin), ...patch });
const statusOf = (results, rule) => {
  const found = results.find((x) => x.rule === rule);
  assert.ok(found, `no result for ${rule}`);
  return found.status;
};
const listingStatus = (patch, rule) => statusOf(validateListing(listingWith(patch), config), rule);
const pinStatus = (patch, rule, options) => statusOf(validatePin(pinWith(patch), config, options), rule);
const tagsOf = (n, make = (i) => `tag number ${i}`) => Array.from({ length: n }, (_, i) => make(i));
const textOf = (n) => 'Hand-drawn Procreate brushes for pattern work. '.repeat(20).slice(0, n);

describe('config', () => {
  test('loads rules and banned words', () => {
    assert.equal(config.rules.listing.title.maxChars, 140);
    assert.equal(config.bannedWords.length, 16);
    assert.ok(config.bannedWords.includes("it's worth noting"));
  });
});

describe('listing rules', () => {
  test('title.maxChars: 140 passes, 141 fails', () => {
    assert.equal(listingStatus({ title: 'a'.repeat(140) }, 'listing.title.maxChars'), 'pass');
    assert.equal(listingStatus({ title: 'a'.repeat(141) }, 'listing.title.maxChars'), 'fail');
  });

  test('title.maxWordsSoft: 15 words pass, 16 words warn (never fail)', () => {
    const titleOf = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
    assert.equal(listingStatus({ title: titleOf(15) }, 'listing.title.maxWordsSoft'), 'pass');
    assert.equal(listingStatus({ title: titleOf(16) }, 'listing.title.maxWordsSoft'), 'warn');
    assert.equal(listingStatus({ title: 'Brushes & Stamps | Hand-Drawn' }, 'listing.title.maxWordsSoft'), 'pass');
  });

  test('title.noRepeatedPhrase: repeated 2+ word phrase fails, single repeated word passes', () => {
    assert.equal(listingStatus({ title: 'Christmas Brushes | Winter Christmas Brushes' }, 'listing.title.noRepeatedPhrase'), 'fail');
    assert.equal(listingStatus({ title: 'Hand-Drawn Stamps | Hand Drawn Brushes' }, 'listing.title.noRepeatedPhrase'), 'fail');
    assert.equal(listingStatus({ title: 'Snow Brushes & Stamps | Leaf Brushes' }, 'listing.title.noRepeatedPhrase'), 'pass');
  });

  test('tags.exactCount: 13 passes, 12 and 14 fail', () => {
    assert.equal(listingStatus({ tags: tagsOf(13) }, 'listing.tags.exactCount'), 'pass');
    assert.equal(listingStatus({ tags: tagsOf(12) }, 'listing.tags.exactCount'), 'fail');
    assert.equal(listingStatus({ tags: tagsOf(14) }, 'listing.tags.exactCount'), 'fail');
  });

  test('tags.maxCharsEach: 20 chars passes, 21 fails', () => {
    assert.equal(listingStatus({ tags: tagsOf(13, (i) => `${i}`.padEnd(20, 'x')) }, 'listing.tags.maxCharsEach'), 'pass');
    const tags = tagsOf(13);
    tags[4] = 'x'.repeat(21);
    assert.equal(listingStatus({ tags }, 'listing.tags.maxCharsEach'), 'fail');
  });

  test('tags.noDuplicates: duplicate fails, ignoring case and spaces', () => {
    const tags = tagsOf(13);
    tags[1] = ' Tag Number 0 ';
    assert.equal(listingStatus({ tags }, 'listing.tags.noDuplicates'), 'fail');
    assert.equal(listingStatus({ tags: tagsOf(13) }, 'listing.tags.noDuplicates'), 'pass');
  });

  test('basketSummary.maxChars: 200 passes, 201 fails', () => {
    assert.equal(listingStatus({ basketSummary: 'a'.repeat(200) }, 'listing.basketSummary.maxChars'), 'pass');
    assert.equal(listingStatus({ basketSummary: 'a'.repeat(201) }, 'listing.basketSummary.maxChars'), 'fail');
  });

  test('description.noEmDash: em dash fails, en dash and hyphen pass', () => {
    assert.equal(listingStatus({ description: 'Brushes — stamps. No AI.' }, 'listing.description.noEmDash'), 'fail');
    assert.equal(listingStatus({ description: 'Brushes – stamps - hand-drawn. No AI.' }, 'listing.description.noEmDash'), 'pass');
  });

  test('description.requiresPhrase: "No AI" required', () => {
    assert.equal(listingStatus({ description: 'Hand-drawn brushes.' }, 'listing.description.requiresPhrase'), 'fail');
    assert.equal(listingStatus({ description: 'Hand-drawn brushes. No AI.' }, 'listing.description.requiresPhrase'), 'pass');
  });

  test('anchorTagsFlagged: weak anchor tags warn, never fail', () => {
    const tags = tagsOf(13);
    tags[0] = 'Digital Download';
    tags[1] = 'instant download';
    const results = validateListing(listingWith({ tags }), config);
    assert.equal(statusOf(results, 'anchorTagsFlagged'), 'warn');
    assert.match(results.find((x) => x.rule === 'anchorTagsFlagged').detail, /2 weak tags/);
    assert.equal(listingStatus({ tags: tagsOf(13) }, 'anchorTagsFlagged'), 'pass');
  });

  test('missing fields fail instead of passing silently', () => {
    const results = validateListing({ tags: tagsOf(13) }, config);
    assert.equal(statusOf(results, 'listing.title.maxChars'), 'fail');
    assert.equal(statusOf(results, 'listing.basketSummary.maxChars'), 'fail');
    assert.equal(statusOf(results, 'listing.description.requiresPhrase'), 'fail');
    assert.equal(statusOf(validateListing({ title: 'x', basketSummary: 'x' }, config), 'listing.tags.exactCount'), 'fail');
  });
});

describe('copy rules', () => {
  test('copy.bannedWords: found in any listing field, any case, curly apostrophes', () => {
    assert.equal(listingStatus({ title: 'Beautiful Brushes' }, 'copy.bannedWords'), 'fail');
    assert.equal(listingStatus({ basketSummary: 'An amazing set.' }, 'copy.bannedWords'), 'fail');
    assert.equal(listingStatus({ description: 'It’s worth noting this. No AI.' }, 'copy.bannedWords'), 'fail');
    assert.equal(listingStatus({ description: 'A game-changer. No AI.' }, 'copy.bannedWords'), 'fail');
    assert.equal(pinStatus({ textOverlay: 'Stunning hand-drawn Christmas brushes' }, 'copy.bannedWords'), 'fail');
  });

  test('copy.bannedWords: whole words only', () => {
    assert.equal(listingStatus({ description: 'Unlocked layers. No AI.' }, 'copy.bannedWords'), 'pass');
  });

  test('copy.forbiddenMentions: Romania and Romanian fail', () => {
    assert.equal(listingStatus({ description: 'Inspired by Romanian folk art. No AI.' }, 'copy.forbiddenMentions'), 'fail');
    assert.equal(pinStatus({ altText: 'Brushes drawn in Romania.' }, 'copy.forbiddenMentions'), 'fail');
    assert.equal(listingStatus({}, 'copy.forbiddenMentions'), 'pass');
  });
});

describe('pin rules', () => {
  test('pin.title.maxChars: 100 passes, 101 fails', () => {
    assert.equal(pinStatus({ title: 'a'.repeat(100) }, 'pin.title.maxChars'), 'pass');
    assert.equal(pinStatus({ title: 'a'.repeat(101) }, 'pin.title.maxChars'), 'fail');
  });

  test('pin.description.length: 200 to 300 chars', () => {
    assert.equal(pinStatus({ description: textOf(199) }, 'pin.description.length'), 'fail');
    assert.equal(pinStatus({ description: textOf(200) }, 'pin.description.length'), 'pass');
    assert.equal(pinStatus({ description: textOf(300) }, 'pin.description.length'), 'pass');
    assert.equal(pinStatus({ description: textOf(301) }, 'pin.description.length'), 'fail');
  });

  test('pin.description.noHashtags: hashtag fails, "#1" does not count', () => {
    assert.equal(pinStatus({ description: `${textOf(210)} #procreate` }, 'pin.description.noHashtags'), 'fail');
    assert.equal(pinStatus({ description: `${textOf(210)} Our #1 set.` }, 'pin.description.noHashtags'), 'pass');
  });

  test('pin.description.noEmDash', () => {
    assert.equal(pinStatus({ description: `${textOf(210)} — hand-drawn` }, 'pin.description.noEmDash'), 'fail');
    assert.equal(pinStatus({}, 'pin.description.noEmDash'), 'pass');
  });

  test('pin.overlay.words: 4 to 8 words', () => {
    assert.equal(pinStatus({ textOverlay: 'one two three' }, 'pin.overlay.words'), 'fail');
    assert.equal(pinStatus({ textOverlay: 'one two three four' }, 'pin.overlay.words'), 'pass');
    assert.equal(pinStatus({ textOverlay: 'a b c d e f g h' }, 'pin.overlay.words'), 'pass');
    assert.equal(pinStatus({ textOverlay: 'a b c d e f g h i' }, 'pin.overlay.words'), 'fail');
  });

  test('pin.taggedTopicsMax: 10 passes, 11 fails', () => {
    assert.equal(pinStatus({ taggedTopics: tagsOf(10) }, 'pin.taggedTopicsMax'), 'pass');
    assert.equal(pinStatus({ taggedTopics: tagsOf(11) }, 'pin.taggedTopicsMax'), 'fail');
  });

  test('pin.image.dimensions: must be exactly 1000 x 1500 PNG or JPEG', () => {
    const ok = { format: 'png', width: 1000, height: 1500, bytes: 1000 };
    assert.equal(pinStatus({}, 'pin.image.dimensions', { image: ok }), 'pass');
    assert.equal(pinStatus({}, 'pin.image.dimensions', { image: { ...ok, width: 1500, height: 1000 } }), 'fail');
    assert.equal(pinStatus({}, 'pin.image.dimensions', { image: { ...ok, format: 'unknown' } }), 'fail');
  });

  test('pin.image.maxMB: 5 MB passes, over 5 MB fails', () => {
    const img = { format: 'jpeg', width: 1000, height: 1500 };
    assert.equal(pinStatus({}, 'pin.image.maxMB', { image: { ...img, bytes: 5_000_000 } }), 'pass');
    assert.equal(pinStatus({}, 'pin.image.maxMB', { image: { ...img, bytes: 5_000_001 } }), 'fail');
  });

  test('pin image checks are skipped, not passed, when no image is given', () => {
    assert.equal(pinStatus({}, 'pin.image.dimensions'), 'skip');
    assert.equal(pinStatus({}, 'pin.image.maxMB'), 'skip');
  });
});

describe('image reader', () => {
  test('reads PNG size', () => {
    const png = new Uint8Array(33);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const dv = new DataView(png.buffer);
    dv.setUint32(16, 1000);
    dv.setUint32(20, 1500);
    assert.deepEqual(readImageInfo(png), { format: 'png', width: 1000, height: 1500, bytes: 33 });
  });

  test('reads JPEG size from the frame header after other segments', () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8,
      0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0, length 4
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x05, 0xdc, 0x03, 0xe8, 0x03, // SOF0: 1500 high, 1000 wide
      0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    const info = readImageInfo(jpeg);
    assert.equal(info.format, 'jpeg');
    assert.equal(info.width, 1000);
    assert.equal(info.height, 1500);
  });

  test('unknown bytes report unknown format', () => {
    assert.equal(readImageInfo(new Uint8Array([1, 2, 3])).format, 'unknown');
  });
});

describe('samples', () => {
  test('valid listing sample passes every rule', () => {
    const { type, results } = validate(validListing, config);
    assert.equal(type, 'listing');
    const notPassing = results.filter((x) => x.status !== 'pass');
    assert.deepEqual(notPassing, []);
  });

  test('valid pin sample has no failures (image skipped: imagePath is null)', () => {
    const { type, results } = validate(validPin, config);
    assert.equal(type, 'pin');
    assert.equal(hasFailures(results), false);
    assert.deepEqual(results.filter((x) => x.status !== 'pass').map((x) => x.rule), ['pin.image.dimensions', 'pin.image.maxMB']);
  });

  test('invalid sample fails on each rule it breaks', () => {
    const { type, results } = validate(invalidListing, config);
    assert.equal(type, 'listing');
    assert.equal(hasFailures(results), true);
    const expected = {
      'listing.title.maxChars': 'fail',
      'listing.title.maxWordsSoft': 'warn',
      'listing.tags.exactCount': 'fail',
      'listing.tags.noDuplicates': 'fail',
      'listing.description.noEmDash': 'fail',
      'listing.description.requiresPhrase': 'fail',
      'copy.bannedWords': 'fail',
      'anchorTagsFlagged': 'warn',
    };
    for (const [rule, status] of Object.entries(expected)) assert.equal(statusOf(results, rule), status, rule);
    const banned = results.find((x) => x.rule === 'copy.bannedWords').detail;
    assert.match(banned, /genuinely/);
    assert.match(banned, /beautiful/);
  });

  test('invalid sample does not break these rules (documented, covered by fixtures above)', () => {
    const { results } = validate(invalidListing, config);
    for (const rule of ['listing.title.noRepeatedPhrase', 'listing.tags.maxCharsEach', 'listing.basketSummary.maxChars', 'copy.forbiddenMentions']) {
      assert.equal(statusOf(results, rule), 'pass', rule);
    }
  });
});

describe('report', () => {
  test('one line per rule plus a summary line, with counts', () => {
    const { results } = validate(validListing, config);
    const lines = formatReport(results).split('\n');
    assert.equal(lines.length, results.length + 1);
    assert.match(lines[0], /^PASS\s+listing\.title\.maxChars\s+74\/140 chars$/);
    assert.match(lines.at(-1), /^\d+ passed, 0 failed, 0 warnings, 0 skipped$/);
  });

  test('unknown document type fails', () => {
    assert.equal(detectType({ foo: 1 }), null);
    assert.equal(hasFailures(validate({ foo: 1 }, config).results), true);
  });
});
