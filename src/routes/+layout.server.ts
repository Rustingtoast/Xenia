import type { LayoutServerLoad } from './$types';

// Every page knows who is signed in (or that nobody is). The header shows it; pages that need
// authentication redirect in their own load.
export const load: LayoutServerLoad = ({ locals }) => ({
	user: locals.user ? { id: locals.user.id, email: locals.user.email } : null
});
