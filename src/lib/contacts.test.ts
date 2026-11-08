import { expect, test } from 'bun:test';
import { groupKey, sectionId } from './contacts.js';

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
