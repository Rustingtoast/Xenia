import { COOKIE_NOTICE_COOKIE } from '#lib/cookie-notice.js';
import { LOCALE_DEPENDENCY } from '#lib/i18n/index.js';
import { MESSAGES } from '#lib/server/messages.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, cookies, depends }) => {
	// Settings invalidates this after changing the language, so the new messages arrive without a reload.
	depends(LOCALE_DEPENDENCY);
	return {
		user: locals.user ? { id: locals.user.id, email: locals.user.email } : null,
		/** The page's language (see hooks.server.ts), and only its messages: `t` in #lib/i18n/t.ts reads them. */
		locale: locals.locale,
		messages: MESSAGES[locals.locale],
		/** Show the cookie notice: not dismissed yet in this browser. */
		cookieNotice: !cookies.get(COOKIE_NOTICE_COOKIE)
	};
};
