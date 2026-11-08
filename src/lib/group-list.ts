/**
 * Whether the Group list (the panel on the left) is shown. It always lies on top of the page,
 * so opening or closing it never moves the contacts.
 * Auto is the starting point and needs no JavaScript to look right: shown only where it fits
 * beside the centered contacts without covering them (the `docked` breakpoint), hidden elsewhere.
 */
export enum GroupListMode {
	/** Shown on docked-wide screens, hidden on smaller ones. */
	Auto,
	/** Shown on every screen size (on smaller screens: slid in over the page, with a backdrop). */
	Open,
	/** Hidden on every screen size. */
	Closed
}

/**
 * Screens wide enough for the Group list (14rem) to sit left of the centered contacts (56rem)
 * without covering them: 56 + 2 × 14 + 2rem breathing room = 86rem. Matches `--breakpoint-docked` in app.css.
 */
export const DOCKED_QUERY = '(min-width: 86rem)';
