import type { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';

// Passwords are argon2id hashes; session tokens are 256-bit random values stored as SHA-256, so
// neither a database leak nor a leaked cookie exposes a password or another session.
export type AuthUser = { id: number; email: string };

export const SESSION_COOKIE = 'session';
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
const EMAIL_MAX_LENGTH = 254;

export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
	return email.length > 0 && email.length <= EMAIL_MAX_LENGTH && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(password: string): boolean {
	return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;
}

export function hashPassword(password: string): Promise<string> {
	return Bun.password.hash(password, { algorithm: 'argon2id' });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	try {
		return await Bun.password.verify(password, hash);
	} catch {
		return false;
	}
}

export function findUserByEmail(db: Database, email: string): AuthUser | null {
	return db.query<AuthUser, [string]>('SELECT id, email FROM users WHERE email = ?').get(normalizeEmail(email));
}

// Verify against a fixed dummy hash for unknown emails, so a failed login takes the same time
// whether or not the account exists.
let dummyHash: string | undefined;
async function dummyPasswordHash(): Promise<string> {
	dummyHash ??= await hashPassword('xenia-not-a-real-password');
	return dummyHash;
}

export async function verifyLogin(db: Database, email: string, password: string): Promise<AuthUser | null> {
	// Reject oversized passwords before hashing: argon2id's cost grows with the input length.
	if (password.length > PASSWORD_MAX_LENGTH) return null;
	const row = db
		.query<{ id: number; email: string; password_hash: string }, [string]>(
			'SELECT id, email, password_hash FROM users WHERE email = ?'
		)
		.get(normalizeEmail(email));
	const hash = row?.password_hash ?? (await dummyPasswordHash());
	if (!row || !(await verifyPassword(password, hash))) return null;
	return { id: row.id, email: row.email };
}

export async function createUser(db: Database, email: string, password: string): Promise<AuthUser | null> {
	const hash = await hashPassword(password);
	const row = db
		.query<{ id: number }, [string, string, string]>(
			`INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)
			 ON CONFLICT DO NOTHING RETURNING id`
		)
		.get(normalizeEmail(email), hash, new Date().toISOString());
	return row ? { id: row.id, email: normalizeEmail(email) } : null;
}

function generateSessionToken(): string {
	return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
}

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function createSession(db: Database, userId: number, now = Date.now()): { token: string; expiresAt: Date } {
	const token = generateSessionToken();
	const expiresAt = new Date(now + SESSION_DURATION_MS);
	db.query<null, [string, number, string, string]>(
		'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
	).run(hashToken(token), userId, new Date(now).toISOString(), expiresAt.toISOString());
	return { token, expiresAt };
}

export function deleteSession(db: Database, token: string): void {
	db.query('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

export function sessionUser(db: Database, token: string, now = Date.now()): AuthUser | null {
	return db
		.query<AuthUser, [string, string]>(
			`SELECT u.id, u.email
			 FROM sessions s JOIN users u ON u.id = s.user_id
			 WHERE s.token_hash = ? AND s.expires_at > ?`
		)
		.get(hashToken(token), new Date(now).toISOString());
}

export function setSessionCookie(cookies: Cookies, token: string, secure: boolean): void {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure,
		maxAge: Math.floor(SESSION_DURATION_MS / 1000)
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
