import { expect, test } from 'bun:test';
import { pageAction } from './forms.js';

test('pageAction posts to a named action of the current page and keeps its query', () => {
	expect(pageAction(new URL('http://xenia.test/'), 'delete')).toBe('?/delete');
	expect(pageAction(new URL('http://xenia.test/?q=bern'), 'delete')).toBe('?q=bern&/delete');
	expect(pageAction(new URL('http://xenia.test/?q=a%26b+c#group-family'), 'restore')).toBe('?q=a%26b+c&/restore');
});

test('pageAction replaces the action name left in the URL by a plain form post', () => {
	expect(pageAction(new URL('http://xenia.test/?q=bern&/delete'), 'restore')).toBe('?q=bern&/restore');
	expect(pageAction(new URL('http://xenia.test/?/delete'), 'restore')).toBe('?/restore');
});
