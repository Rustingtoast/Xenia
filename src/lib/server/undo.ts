import type { Database } from 'bun:sqlite';
import type { Contact } from '../contacts.js';
import { ContactValidationError, createContact, findContact } from './contacts.js';

/** How long the "Undo" button after a delete keeps working. */
export const UNDO_WINDOW_MS = 5 * 60 * 1000;

type UndoPayload = {
	userId: number;
	contact: Pick<Contact, 'id' | 'groupName' | 'location' | 'phoneNumber' | 'description' | 'createdAt'>;
	expiresAt: number;
};

// Binds tokens to this one use, so they can't be swapped with other encrypted values later.
const PURPOSE = new TextEncoder().encode('xenia:undo-delete');

async function undoKey(secret: string): Promise<CryptoKey> {
	const material = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`contact undo:${secret}`));
	return crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/**
 * An encrypted, expiring copy of a deleted contact, for the "Undo" button.
 * Encrypted (AES-GCM), not just signed, so the contact data isn't readable from the page,
 * and it can't be forged. Expires so deleted contacts can't be brought back later.
 */
export async function createUndoToken(contact: Contact, userId: number, secret: string, now = Date.now()): Promise<string> {
	const payload: UndoPayload = {
		userId,
		contact: {
			id: contact.id,
			groupName: contact.groupName,
			location: contact.location,
			phoneNumber: contact.phoneNumber,
			description: contact.description,
			createdAt: contact.createdAt
		},
		expiresAt: now + UNDO_WINDOW_MS
	};
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv, additionalData: PURPOSE },
		await undoKey(secret),
		new TextEncoder().encode(JSON.stringify(payload))
	);
	return Buffer.concat([iv, new Uint8Array(ciphertext)]).toString('base64url');
}

/** Decrypts an undo token. null if it's malformed, forged, from another secret or expired. */
export async function readUndoToken(
	token: string,
	secret: string,
	now = Date.now()
): Promise<{ userId: number; contact: UndoPayload['contact'] } | null> {
	try {
		const bytes = Buffer.from(token, 'base64url');
		if (bytes.length < 13) return null;
		const plaintext = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: bytes.subarray(0, 12), additionalData: PURPOSE },
			await undoKey(secret),
			bytes.subarray(12)
		);
		const payload = JSON.parse(new TextDecoder().decode(plaintext)) as UndoPayload;
		return payload.expiresAt > now ? { userId: payload.userId, contact: payload.contact } : null;
	} catch {
		return null;
	}
}

/**
 * Re-creates a deleted contact (same id and creation time) from its undo token, for the same user
 * who deleted it. null if the token is invalid, expired, another user's, or the contact is back already.
 */
export async function restoreFromUndoToken(
	db: Database,
	token: string,
	secret: string,
	userId: number,
	now = Date.now()
): Promise<Contact | null> {
	const saved = await readUndoToken(token, secret, now);
	if (!saved || saved.userId !== userId || findContact(db, userId, saved.contact.id)) return null;
	try {
		return createContact(db, userId, saved.contact, { id: saved.contact.id, createdAt: saved.contact.createdAt });
	} catch (error) {
		if (error instanceof ContactValidationError) return null; // rules changed since it was deleted
		throw error;
	}
}
