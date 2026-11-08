import { describe, expect, test } from 'bun:test';
import { indexLetterFor, letterFromParam, letterParam, sectionId, telHref } from './contacts.js';

describe('indexLetterFor', () => {
	test('is the first letter of the group, uppercased, without accents', () => {
		expect(indexLetterFor('family')).toBe('F');
		expect(indexLetterFor('Ärzte')).toBe('A');
		expect(indexLetterFor('  école')).toBe('E');
	});

	test('is "#" for digits, symbols and empty groups', () => {
		expect(indexLetterFor('112 Emergency')).toBe('#');
		expect(indexLetterFor('(work)')).toBe('#');
		expect(indexLetterFor('')).toBe('#');
	});
});

test('letter params and section ids map "#" to "other"', () => {
	expect(letterParam('#')).toBe('other');
	expect(letterParam('W')).toBe('W');
	expect(letterFromParam('other')).toBe('#');
	expect(letterFromParam('W')).toBe('W');
	expect(letterFromParam('w')).toBeUndefined();
	expect(letterFromParam('WW')).toBeUndefined();
	expect(sectionId('#')).toBe('letter-other');
});

test('telHref removes spaces', () => {
	expect(telHref('+1 555-0101')).toBe('tel:+1555-0101');
});
