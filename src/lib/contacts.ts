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

/** What a delete/undo/create/edit form action did. The list page shows a banner for it. */
export enum ActionOutcome {
	Deleted = 'deleted',
	NotFound = 'not-found',
	Restored = 'restored',
	RestoreFailed = 'restore-failed',
	Created = 'created',
	Updated = 'updated'
}

/**
 * A contact after a create or edit, for the page to refresh the list around it.
 * `previousGroupName` is only set by edits, so the page knows where the contact moved from.
 */
export type ContactChange = {
	id: number;
	groupName: string;
	previousGroupName?: string;
};

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
 * Lowercases A–Z only, like SQLite NOCASE/LIKE: "Family" = "family", but "Ärzte" ≠ "ärzte".
 * Keeps the length, so positions stay valid.
 */
export function foldCase(text: string): string {
	return text.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

/** Identifies a group the way the database compares group names, so "family" and "Family" are the same group. */
export function groupKey(groupName: string): string {
	return foldCase(groupName);
}

/** Longest search text that is used; anything beyond is ignored. */
export const SEARCH_MAX_LENGTH = 100;

/**
 * The search as applied: trimmed, whitespace collapsed, at most SEARCH_MAX_LENGTH. Normalizing twice is a
 * no-op, so what's shown is always what's applied.
 */
export function normalizeSearch(search: string): string {
	const text = search.trim().replace(/\s+/g, ' ');
	if (text.length <= SEARCH_MAX_LENGTH) return text;
	// The cut must not leave half an emoji (a lone surrogate) or a space at the end.
	return text.slice(0, SEARCH_MAX_LENGTH).replace(/[\uD800-\uDBFF]$/, '').trimEnd();
}

/** What counts as a space when searching, so "doctor. open" matches "…doctor.\nOpen…". */
export const SPACE_LIKE = ['\t', '\n', '\r'];
const SPACE_RUN = `[ ${SPACE_LIKE.join('')}]+`;

/** Separators allowed in a phone number ("(555) 010-0199", "044/123.45.67"). */
export const PHONE_SEPARATORS = [' ', '(', ')', '.', '/', '-'];
const SEPARATOR_CLASS = PHONE_SEPARATORS.map((char) => `\\${char}`).join('');

/** A valid phone number: digits and separators, optionally starting with "+". */
export const PHONE_FORMAT = new RegExp(`^\\+?[0-9${SEPARATOR_CLASS}]+$`);
/** A search that could be (part of) a phone number. */
const PHONE_LIKE = new RegExp(`^[0-9+${SEPARATOR_CLASS}]+$`);
/** A phone-like search needs this many digits before it also finds numbers that are written differently. */
export const PHONE_SEARCH_MIN_DIGITS = 4;

/**
 * A phone-like search with separators removed: "555 01-01" → "5550101", so it also finds "+1 555-0101".
 * A "+" is kept: "+4179" only matches numbers starting with it. null for words and short searches ("1.5",
 * "24/7", "+41"), which match as typed only.
 */
export function compactPhoneSearch(search: string): string | null {
	const text = normalizeSearch(search);
	if (!PHONE_LIKE.test(text)) return null;
	const compact = text.replace(/[^0-9+]/g, '');
	return compact.replace(/\+/g, '').length >= PHONE_SEARCH_MIN_DIGITS ? compact : null;
}

/** A piece of a text: either plain, or matching the search (shown highlighted). */
export type TextPart = { text: string; match: boolean };

/** Cuts a text into plain and matching parts; `ranges` are the matches as [start, end), in order. */
function splitAtRanges(text: string, ranges: [number, number][]): TextPart[] {
	const parts: TextPart[] = [];
	let from = 0;
	for (const [start, end] of ranges) {
		if (start > from) parts.push({ text: text.slice(from, start), match: false });
		parts.push({ text: text.slice(start, end), match: true });
		from = end;
	}
	if (from < text.length) parts.push({ text: text.slice(from), match: false });
	return parts;
}

/** A search prepared for highlighting: `words` finds it in a text, `phone` is its compactPhoneSearch. */
type SearchMatcher = { search: string; words: RegExp | null; phone: string | null };
let lastMatcher: SearchMatcher | undefined;

/** Prepared once per search, not per text: every highlighted text on the page asks for the same search. */
function searchMatcher(search: string): SearchMatcher {
	if (lastMatcher?.search !== search) {
		const words = foldCase(normalizeSearch(search)).split(' ').filter(Boolean);
		lastMatcher = {
			search,
			// A space in the search stands for any run of spaces, tabs and line breaks in the text.
			words: words.length
				? new RegExp(words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(SPACE_RUN), 'g')
				: null,
			phone: compactPhoneSearch(search)
		};
	}
	return lastMatcher;
}

/**
 * Splits text into plain and matching parts, matching like the database (A–Z ignore case, space = line
 * break), so what's highlighted is what made the contact match.
 */
export function highlightParts(text: string, search: string): TextPart[] {
	const { words } = searchMatcher(search);
	if (!words) return [{ text, match: false }];
	// foldCase keeps the length, so positions in the folded text are positions in the text.
	const matches = Array.from(foldCase(text).matchAll(words), (match): [number, number] => [
		match.index,
		match.index + match[0].length
	]);
	return splitAtRanges(text, matches);
}

/** Like highlightParts, but also marks a match only visible with separators removed ("5550101" in "+1 555-0101"). */
export function phoneHighlightParts(phoneNumber: string, search: string): TextPart[] {
	const asTyped = highlightParts(phoneNumber, search);
	const { phone } = searchMatcher(search);
	if (!phone || asTyped.some((part) => part.match)) return asTyped;

	const positions: number[] = []; // where each digit (and the "+") of the number is
	for (let i = 0; i < phoneNumber.length; i++) if (/[0-9+]/.test(phoneNumber[i])) positions.push(i);
	const compact = positions.map((i) => phoneNumber[i]).join('');

	const matches: [number, number][] = [];
	for (let at = compact.indexOf(phone); at !== -1; at = compact.indexOf(phone, at + phone.length)) {
		matches.push([positions[at], positions[at + phone.length - 1] + 1]);
	}
	return splitAtRanges(phoneNumber, matches);
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
