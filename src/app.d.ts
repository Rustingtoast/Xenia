// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
// #lib (package.json "imports"), not $lib: TypeScript has no $lib alias here, and a failed import in a .d.ts
// is silent (skipLibCheck), leaving the types unchecked.
import type { AuthUser } from '#lib/server/auth.js';
import type { Locale } from '#lib/i18n/index.js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: AuthUser | null;
			/** The page's language: the one picked (cookie), else the default (hooks.server.ts). */
			locale: Locale;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
