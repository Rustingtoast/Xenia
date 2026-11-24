import { fail, redirect } from '@sveltejs/kit';
import {
	PASSWORD_MIN_LENGTH,
	createSession,
	createUser,
	findUserByEmail,
	isValidEmail,
	isValidPassword,
	normalizeEmail,
	setSessionCookie
} from '#lib/server/auth.js';
import { getDb } from '#lib/server/db.js';
import { isRateLimited, rateLimit } from '#lib/server/rate-limit.js';
import type { Actions, PageServerLoad } from './$types';

const REGISTER_ATTEMPT_LIMIT = 5; // registrations per IP
const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(307, '/');
};

type RegisterErrors = { email?: string; password?: string; confirm?: string };

export const actions: Actions = {
	default: async ({ request, url, locals, cookies, getClientAddress }) => {
		if (locals.user) redirect(303, '/');
		const data = await request.formData();
		const email = normalizeEmail(String(data.get('email') ?? ''));
		const password = String(data.get('password') ?? '');
		const confirm = String(data.get('confirm') ?? '');

		const errors: RegisterErrors = {};
		if (!isValidEmail(email)) errors.email = 'Enter a valid email address.';
		else if (findUserByEmail(getDb(), email)) errors.email = 'That email is already registered.';
		if (!isValidPassword(password)) errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
		if (password !== confirm) errors.confirm = 'Passwords do not match.';
		if (Object.keys(errors).length > 0) return fail(400, { errors, email });

		const key = `register:${getClientAddress()}`;
		if (isRateLimited(key, REGISTER_ATTEMPT_LIMIT, REGISTER_WINDOW_MS)) {
			errors.email = 'Too many registrations. Try again later.';
			return fail(429, { errors, email });
		}

		const user = await createUser(getDb(), email, password);
		if (!user) {
			errors.email = 'That email is already registered.';
			return fail(400, { errors, email });
		}

		rateLimit(key, REGISTER_ATTEMPT_LIMIT, REGISTER_WINDOW_MS);
		const { token } = createSession(getDb(), user.id);
		setSessionCookie(cookies, token, url.protocol === 'https:');
		redirect(303, '/');
	}
};
