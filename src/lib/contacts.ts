// Contact rules and helpers shared by the server and the browser.

/** A phone book entry, as the server sends it to the page. */
export type Contact = {
	id: number;
	groupName: string;
	location: string;
	phoneNumber: string;
	/** Optional free text, may contain line breaks. Empty when not set. */
	description: string;
	createdAt: string;
	updatedAt: string;
};

/** A group in the side bar and list: its name and how many contacts it has. */
export type GroupCount = { name: string; count: number };

/** What a delete/undo form action did. The list page shows a banner for it. */
export enum ActionOutcome {
	Deleted = 'deleted',
	NotFound = 'not-found',
	Restored = 'restored',
	RestoreFailed = 'restore-failed'
}

/** How far a group section of the list has loaded its contacts. */
export enum SectionLoadState {
	/** Nothing loaded yet: the whole section is a placeholder. */
	NotStarted,
	/** Some chunks loaded; more to come when the placeholder below them scrolls into view. */
	Partial,
	/** Every contact of the group is loaded. */
	Complete
}

/** How many contacts the list loads at once, per group section. */
export const SECTION_CHUNK_SIZE = 100;

/**
 * Identifies a group the way the database compares group names (SQLite NOCASE: ASCII letters
 * ignore case, everything else is exact), so "family" and "Family" are the same group.
 */
export function groupKey(groupName: string): string {
	return groupName.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

/**
 * HTML id of a group's section, for the side bar links: "group-family-1x2y3z".
 * Readable part for debugging, plus a hash so "a b" and "a-b" never collide.
 */
export function sectionId(groupName: string): string {
	const key = groupKey(groupName);
	const readable = key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
	let hash = 0x811c9dc5; // FNV-1a
	for (const char of key) {
		hash ^= char.codePointAt(0)!;
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return `group-${readable || 'x'}-${hash.toString(36)}`;
}

/** What GET /contacts/group returns: one chunk of a group section. */
export type SectionChunkResponse = {
	contacts: Contact[];
	/** Pass as ?after= to load the next chunk; null when this was the last one. */
	next: string | null;
	/** Contacts after this chunk (the page reserves their space). */
	remaining: number;
};
