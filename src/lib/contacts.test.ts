import { describe, expect, test } from 'bun:test';
import {
	SEARCH_MAX_LENGTH,
	compactPhoneSearch,
	groupKey,
	highlightParts,
	normalizeSearch,
	phoneHighlightParts,
	sectionId
} from './contacts.js';

test('groupKey ignores ASCII case only, like the database (SQLite NOCASE)', () => {
	expect(groupKey('Family')).toBe(groupKey('family'));
	expect(groupKey('FAMILY')).toBe('family');
	expect(groupKey('Ärzte')).not.toBe(groupKey('ärzte')); // NOCASE doesn't fold non-ASCII letters
});

test('sectionId is a stable, valid HTML id per group', () => {
	expect(sectionId('Family')).toBe(sectionId('family'));
	expect(sectionId('Family')).toMatch(/^group-family-[0-9a-z]+$/);
	expect(sectionId('a b')).not.toBe(sectionId('a-b'));
	expect(sectionId('112 / Notruf')).toMatch(/^group-112-notruf-[0-9a-z]+$/);
	expect(sectionId('ÄÖÜ')).toMatch(/^group-x-[0-9a-z]+$/);
	expect(sectionId('Work')).not.toContain(' ');
});

test('normalizeSearch trims, collapses spaces and limits the length', () => {
	expect(normalizeSearch('  New   York  ')).toBe('New York');
	expect(normalizeSearch('x'.repeat(150))).toHaveLength(SEARCH_MAX_LENGTH);
	expect(normalizeSearch('   ')).toBe('');
});

test('normalizeSearch gives the same search when applied twice, also at the length limit', () => {
	const spaceAtTheCut = `${'x'.repeat(SEARCH_MAX_LENGTH - 1)} yz`;
	expect(normalizeSearch(spaceAtTheCut)).toBe('x'.repeat(SEARCH_MAX_LENGTH - 1)); // no space left at the end
	const emojiAtTheCut = `${'x'.repeat(SEARCH_MAX_LENGTH - 1)}😀`;
	expect(normalizeSearch(emojiAtTheCut)).toBe('x'.repeat(SEARCH_MAX_LENGTH - 1)); // no half emoji
	const emojiBeforeTheCut = `${'x'.repeat(SEARCH_MAX_LENGTH - 2)}😀yz`;
	expect(normalizeSearch(emojiBeforeTheCut)).toBe(`${'x'.repeat(SEARCH_MAX_LENGTH - 2)}😀`);

	for (const search of [spaceAtTheCut, emojiAtTheCut, emojiBeforeTheCut, '  New   York  ']) {
		expect(normalizeSearch(normalizeSearch(search))).toBe(normalizeSearch(search));
	}
});

describe('highlightParts', () => {
	test('marks every match, ignoring A–Z case', () => {
		expect(highlightParts('Zurich West', 'west')).toEqual([
			{ text: 'Zurich ', match: false },
			{ text: 'West', match: true }
		]);
		expect(highlightParts('Bern, bern', 'BERN')).toEqual([
			{ text: 'Bern', match: true },
			{ text: ', ', match: false },
			{ text: 'bern', match: true }
		]);
	});

	test('is plain text without a search or without a match', () => {
		expect(highlightParts('Basel', '')).toEqual([{ text: 'Basel', match: false }]);
		expect(highlightParts('Basel', 'bern')).toEqual([{ text: 'Basel', match: false }]);
	});

	test('compares like the database: A–Z ignore case, other letters are exact', () => {
		expect(highlightParts('Ärzte', 'Ärz')).toEqual([
			{ text: 'Ärz', match: true },
			{ text: 'te', match: false }
		]);
		expect(highlightParts('Ärzte', 'ärz')).toEqual([{ text: 'Ärzte', match: false }]);
	});

	test('a space in the search also matches line breaks, tabs and several spaces', () => {
		expect(highlightParts('Dr. Weber, family doctor.\nOpen Mon–Fri.', 'doctor. open')).toEqual([
			{ text: 'Dr. Weber, family ', match: false },
			{ text: 'doctor.\nOpen', match: true },
			{ text: ' Mon–Fri.', match: false }
		]);
		expect(highlightParts('Dr.  Weber', 'dr. weber')).toEqual([{ text: 'Dr.  Weber', match: true }]);
		expect(highlightParts('Gate\t\r\n  code', 'gate code')).toEqual([{ text: 'Gate\t\r\n  code', match: true }]);
		expect(highlightParts('Dr.Weber', 'dr. weber')).toEqual([{ text: 'Dr.Weber', match: false }]); // needs a space
	});

	test('takes the search literally: no wildcards or patterns', () => {
		expect(highlightParts('a.c abc (1+1)', 'a.c')).toEqual([
			{ text: 'a.c', match: true },
			{ text: ' abc (1+1)', match: false }
		]);
		expect(highlightParts('a.c abc (1+1)', '(1+1)')).toEqual([
			{ text: 'a.c abc ', match: false },
			{ text: '(1+1)', match: true }
		]);
	});
});

test('compactPhoneSearch: a phone-like search without its separators, null for anything else', () => {
	expect(compactPhoneSearch('555 01-01')).toBe('5550101');
	expect(compactPhoneSearch('(079) 123.45/67')).toBe('0791234567');
	expect(compactPhoneSearch('+41 (79)')).toBe('+4179'); // the "+" counts: only numbers starting with it
	expect(compactPhoneSearch('Zurich 1')).toBeNull();
	expect(compactPhoneSearch('---')).toBeNull();
	expect(compactPhoneSearch('')).toBeNull();
});

test('compactPhoneSearch: short searches are taken as typed, not as part of any number', () => {
	// Fewer than 4 digits: "1.5" (km), "24/7", "8.30" or "+41" would match half the phone book.
	for (const search of ['1.5', '24/7', '8.30', '+41', '555', '1 5']) {
		expect(compactPhoneSearch(search)).toBeNull();
	}
	expect(compactPhoneSearch('12.05')).toBe('1205');
});

describe('phoneHighlightParts', () => {
	test('marks the match as typed', () => {
		expect(phoneHighlightParts('+1 555-0101', '555-01')).toEqual([
			{ text: '+1 ', match: false },
			{ text: '555-01', match: true },
			{ text: '01', match: false }
		]);
	});

	test('marks digits across separators when the search is written differently', () => {
		expect(phoneHighlightParts('+1 555-0101', '5550101')).toEqual([
			{ text: '+1 ', match: false },
			{ text: '555-0101', match: true }
		]);
		expect(phoneHighlightParts('(555) 010-0113', '0100113')).toEqual([
			{ text: '(555) ', match: false },
			{ text: '010-0113', match: true }
		]);
	});

	test('leaves the number plain for word searches or no match', () => {
		expect(phoneHighlightParts('+1 555-0101', 'zurich')).toEqual([{ text: '+1 555-0101', match: false }]);
		expect(phoneHighlightParts('+1 555-0101', '999')).toEqual([{ text: '+1 555-0101', match: false }]);
	});

	test('short searches only match as typed', () => {
		expect(phoneHighlightParts('+1 555-0101', '1.5')).toEqual([{ text: '+1 555-0101', match: false }]);
		expect(phoneHighlightParts('555 0141', '+41')).toEqual([{ text: '555 0141', match: false }]);
		expect(phoneHighlightParts('+41 79 123 45 67', '+41')).toEqual([
			{ text: '+41', match: true },
			{ text: ' 79 123 45 67', match: false }
		]);
	});

	test('a "+" in the search only matches a number that starts with it', () => {
		expect(phoneHighlightParts('+41 79 123 45 67', '+4179')).toEqual([
			{ text: '+41 79', match: true },
			{ text: ' 123 45 67', match: false }
		]);
		expect(phoneHighlightParts('555 4179', '+4179')).toEqual([{ text: '555 4179', match: false }]);
		expect(phoneHighlightParts('+41 79 123 45 67', '4179')).toEqual([
			{ text: '+', match: false },
			{ text: '41 79', match: true },
			{ text: ' 123 45 67', match: false }
		]);
	});
});
