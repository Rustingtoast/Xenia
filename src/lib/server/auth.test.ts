import { beforeEach, describe, expect, test } from 'bun:test';
import type { Database } from 'bun:sqlite';
import { openDatabase } from './db.js';
import {
	PASSWORD_MIN_LENGTH,
	createSession,
	createUser,
	deleteSession,
	findUserByEmail,
	hashPassword,
	isValidEmail,
	isValidPassword,
	normalizeEmail,
	sessionUser,
	verifyLogin,
	verifyPassword
} from './auth.js';

let db: Database;
beforeEach(() => {
	db = openDatabase(':memory:');
});

describe('password hashing', () => {
	test('hashes with argon2id and verifies, rejecting the wrong password', async () => {
		const hash = await hashPassword('correct horse battery staple');
		expect(hash.startsWith('$argon2id$')).toBe(true);
		expect(hash).not.toContain('correct');
		expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
		expect(await verifyPassword('wrong', hash)).toBe(false);
	});

	test('verifyPassword returns false for a malformed hash', async () => {
		expect(await verifyPassword('anything', 'not-a-hash')).toBe(false);
	});
});

describe('validation', () => {
	test('normalizeEmail trims and lowercases', () => {
		expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
	});

	test('isValidEmail accepts only plausible addresses', () => {
		expect(isValidEmail('a@b.co')).toBe(true);
		expect(isValidEmail('a+b@example.com')).toBe(true);
		expect(isValidEmail('not-an-email')).toBe(false);
		expect(isValidEmail('a@b')).toBe(false); // no dot in the domain
		expect(isValidEmail('a b@c.co')).toBe(false); // space
	});

	test('isValidPassword enforces a minimum length', () => {
		expect(isValidPassword('a'.repeat(PASSWORD_MIN_LENGTH))).toBe(true);
		expect(isValidPassword('short')).toBe(false);
	});
});

describe('users', () => {
	test('creates and finds a user, email case-insensitive', async () => {
		const user = (await createUser(db, 'Foo@Bar.com', 'password-123'))!;
		expect(user.email).toBe('foo@bar.com');
		expect(findUserByEmail(db, 'FOO@bar.com')).toEqual(user);
		expect(findUserByEmail(db, 'nobody@x.com')).toBeNull();
	});

	test('createUser returns null for a duplicate email, case-insensitively', async () => {
		expect(await createUser(db, 'a@b.co', 'password-123')).not.toBeNull();
		expect(await createUser(db, 'A@B.CO', 'another-password')).toBeNull();
	});

	test('verifyLogin checks the password, also for an unknown email', async () => {
		await createUser(db, 'a@b.co', 'password-123');
		expect(await verifyLogin(db, 'A@B.CO', 'password-123')).toMatchObject({ email: 'a@b.co' });
		expect(await verifyLogin(db, 'a@b.co', 'wrong-password')).toBeNull();
		expect(await verifyLogin(db, 'nobody@x.co', 'password-123')).toBeNull();
	});

	test('verifyLogin rejects an oversized password without hashing it', async () => {
		await createUser(db, 'a@b.co', 'password-123');
		expect(await verifyLogin(db, 'a@b.co', 'x'.repeat(129))).toBeNull();
	});
});

describe('sessions', () => {
	test('sessionUser resolves the user, storing only a hash of the token', async () => {
		const user = (await createUser(db, 'a@b.co', 'password-123'))!;
		const { token } = createSession(db, user.id);

		expect(sessionUser(db, token)).toEqual(user);

		const stored = db.query<{ token_hash: string }, []>('SELECT token_hash FROM sessions').get()!.token_hash;
		expect(stored).not.toBe(token);
		expect(stored).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
	});

	test('sessionUser rejects unknown or expired tokens', async () => {
		const user = (await createUser(db, 'a@b.co', 'password-123'))!;
		const { token } = createSession(db, user.id);

		expect(sessionUser(db, 'not-a-real-token')).toBeNull();
		expect(sessionUser(db, token, Date.now() + 31 * 24 * 60 * 60 * 1000)).toBeNull();
	});

	test('deleteSession invalidates the token', async () => {
		const user = (await createUser(db, 'a@b.co', 'password-123'))!;
		const { token } = createSession(db, user.id);
		deleteSession(db, token);
		expect(sessionUser(db, token)).toBeNull();
	});
});
