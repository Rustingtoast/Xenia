// Helpers for forms that post to the page's form actions.

/**
 * Form action for a named page action, keeping the page's query:
 * pageAction(page.url, 'delete') → "?q=bern&/delete".
 */
export function pageAction(url: Pick<URL, 'search'>, name: string): string {
	const query = new URLSearchParams(url.search);
	// A page reached by a plain (not enhanced) form post still carries that post's action name.
	for (const key of [...query.keys()]) if (key.startsWith('/')) query.delete(key);
	const kept = query.toString();
	return kept ? `?${kept}&/${name}` : `?/${name}`;
}
