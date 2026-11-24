import { fail, redirect } from '@sveltejs/kit';
import { message } from '#lib/i18n/index.js';
import { createSession, setSessionCookie, verifyLogin } from '#lib/server/auth.js';
import { getDb } from '#lib/server/db.js';
import { isRateLimited, rateLimit, resetRateLimit } from '#lib/server/rate-limit.js';
import type { Actions, PageServerLoad } from './$types';

const LOGIN_ATTEMPT_LIMIT = 10; // failed attempts per IP
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(307, '/');
};

export const actions: Actions = {
	default: async ({ request, url, locals, cookies, getClientAddress }) => {
		if (locals.user) redirect(303, '/');
		const data = await request.formData();
		const email = String(data.get('email') ?? '');
		const password = String(data.get('password') ?? '');

		const key = `login:${getClientAddress()}`;
		if (isRateLimited(key, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS)) {
			return fail(429, { error: message('login.tooManyAttempts') });
		}

		const user = await verifyLogin(getDb(), email, password);
		if (!user) {
			rateLimit(key, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS);
			return fail(401, { error: message('login.incorrect') });
		}

		resetRateLimit(key);
		const { token } = createSession(getDb(), user.id);
		setSessionCookie(cookies, token, url.protocol === 'https:');
		redirect(303, '/');
	}
};
