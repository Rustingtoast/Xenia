// Helpers for forms that post to the page's form actions.

/**
 * The `action` of a form that posts to a named action of the current page, keeping the page's own query:
 * pageAction(page.url, 'delete') → "?q=bern&/delete". SvelteKit shows a form's answer on the URL the form
 * was sent to (without the action name); a bare "?/delete" replaces the query, so the answer would arrive
 * on the page without its search.
 */
export function pageAction(url: Pick<URL, 'search'>, name: string): string {
	const query = new URLSearchParams(url.search);
	// A page reached by a plain (not enhanced) form post still carries that post's action name.
	for (const key of [...query.keys()]) if (key.startsWith('/')) query.delete(key);
	const kept = query.toString();
	return kept ? `?${kept}&/${name}` : `?/${name}`;
}
