import { beforeEach, expect, test } from 'bun:test';
import { isRateLimited, rateLimit, resetRateLimit } from './rate-limit.js';

const KEY = 'test';
const LIMIT = 3;
const WINDOW = 60_000;

beforeEach(() => {
	resetRateLimit(KEY);
});

test('allows up to the limit, then rejects', () => {
	expect(rateLimit(KEY, LIMIT, WINDOW, 0)).toBe(true); // 1st
	expect(rateLimit(KEY, LIMIT, WINDOW, 1)).toBe(true); // 2nd
	expect(rateLimit(KEY, LIMIT, WINDOW, 2)).toBe(true); // 3rd
	expect(rateLimit(KEY, LIMIT, WINDOW, 3)).toBe(false); // 4th → over the limit
});

test('resets after the window elapses', () => {
	expect(rateLimit(KEY, LIMIT, WINDOW, 0)).toBe(true);
	expect(rateLimit(KEY, LIMIT, WINDOW, 1)).toBe(true);
	expect(rateLimit(KEY, LIMIT, WINDOW, 2)).toBe(true);
	expect(rateLimit(KEY, LIMIT, WINDOW, 3)).toBe(false);
	// Once the window has passed, a fresh bucket starts.
	expect(rateLimit(KEY, LIMIT, WINDOW, WINDOW + 1)).toBe(true);
});

test('isRateLimited reports over-limit only within the window', () => {
	rateLimit(KEY, LIMIT, WINDOW, 0);
	rateLimit(KEY, LIMIT, WINDOW, 1);
	rateLimit(KEY, LIMIT, WINDOW, 2);
	expect(isRateLimited(KEY, LIMIT, WINDOW, 3)).toBe(true);
	expect(isRateLimited(KEY, LIMIT, WINDOW, WINDOW + 1)).toBe(false);
});

test('resetRateLimit clears the bucket', () => {
	rateLimit(KEY, LIMIT, WINDOW, 0);
	resetRateLimit(KEY);
	expect(isRateLimited(KEY, LIMIT, WINDOW, 1)).toBe(false);
});

test('distinct keys are limited independently', () => {
	rateLimit('a', LIMIT, WINDOW, 0);
	rateLimit('a', LIMIT, WINDOW, 1);
	rateLimit('a', LIMIT, WINDOW, 2);
	expect(isRateLimited('a', LIMIT, WINDOW, 3)).toBe(true);
	expect(isRateLimited('b', LIMIT, WINDOW, 3)).toBe(false);
});
