// Contact rules and helpers shared by the server and the browser.

/** A phone book entry, as the server sends it to the page. */
export type Contact = {
	id: number;
	groupName: string;
	location: string;
	phoneNumber: string;
	/** Side-index letter: A–Z or "#". */
	indexLetter: string;
	createdAt: string;
	updatedAt: string;
};

/** What a delete/undo form action did. The list page shows a banner for it. */
export enum ActionOutcome {
	Deleted = 'deleted',
	NotFound = 'not-found',
	Restored = 'restored',
	RestoreFailed = 'restore-failed'
}

/** How far a letter section of the list has loaded its contacts. */
export enum SectionLoadState {
	/** Nothing loaded yet: the whole section is a placeholder. */
	NotStarted,
	/** Some chunks loaded; more to come when the placeholder below them scrolls into view. */
	Partial,
	/** Every contact of the letter is loaded. */
	Complete
}

/** The side index of the list page: A–Z, plus "#" for groups that don't start with a letter. */
export const INDEX_LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'] as const;

/** How many contacts the list loads at once, per letter section. */
export const SECTION_CHUNK_SIZE = 100;

/** First letter of the group, accents removed ("Ärzte" → "A"); "#" for digits and symbols. */
export function indexLetterFor(groupName: string): string {
	const first = [...groupName.trim()][0] ?? '';
	const letter = first.normalize('NFD').replace(/\p{Mn}/gu, '').toUpperCase();
	return /^[A-Z]$/.test(letter) ? letter : '#';
}

/** The letter as used in URLs and ids ("#" can't be in a path). */
export function letterParam(letter: string): string {
	return letter === '#' ? 'other' : letter;
}

/** Inverse of letterParam; undefined if it isn't a side-index letter. */
export function letterFromParam(param: string): string | undefined {
	if (param === 'other') return '#';
	return /^[A-Z]$/.test(param) ? param : undefined;
}

/** HTML id of a side-index section: "letter-A" … "letter-Z", "letter-other" for "#". */
export function sectionId(letter: string): string {
	return `letter-${letterParam(letter)}`;
}

/** tel: link for a phone number as typed ("+1 555-0101" → "tel:+1555-0101"). */
export function telHref(phoneNumber: string): string {
	return `tel:${phoneNumber.replaceAll(' ', '')}`;
}

/** What GET /contacts/letters/[letter] returns: one chunk of a letter section. */
export type SectionChunkResponse = {
	contacts: Contact[];
	/** Pass as ?after= to load the next chunk; null when this was the last one. */
	next: string | null;
	/** Contacts after this chunk (the page reserves their space). */
	remaining: number;
};
