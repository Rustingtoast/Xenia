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
import { message, type Translatable } from '#lib/i18n/index.js';
import type { Actions, PageServerLoad } from './$types';

const REGISTER_ATTEMPT_LIMIT = 5; // registrations per IP
const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(307, '/');
};

// Messages, not text: the page shows them in the reader's language.
type RegisterErrors = { email?: Translatable; password?: Translatable; confirm?: Translatable };

export const actions: Actions = {
	default: async ({ request, url, locals, cookies, getClientAddress }) => {
		if (locals.user) redirect(303, '/');
		const data = await request.formData();
		const email = normalizeEmail(String(data.get('email') ?? ''));
		const password = String(data.get('password') ?? '');
		const confirm = String(data.get('confirm') ?? '');

		const errors: RegisterErrors = {};
		if (!isValidEmail(email)) errors.email = message('register.invalidEmail');
		else if (findUserByEmail(getDb(), email)) errors.email = message('register.emailTaken');
		if (!isValidPassword(password)) errors.password = message('register.passwordTooShort', { min: PASSWORD_MIN_LENGTH });
		if (password !== confirm) errors.confirm = message('register.passwordMismatch');
		if (Object.keys(errors).length > 0) return fail(400, { errors, email });

		const key = `register:${getClientAddress()}`;
		if (isRateLimited(key, REGISTER_ATTEMPT_LIMIT, REGISTER_WINDOW_MS)) {
			errors.email = message('register.tooMany');
			return fail(429, { errors, email });
		}

		const user = await createUser(getDb(), email, password);
		if (!user) {
			errors.email = message('register.emailTaken');
			return fail(400, { errors, email });
		}

		rateLimit(key, REGISTER_ATTEMPT_LIMIT, REGISTER_WINDOW_MS);
		const { token } = createSession(getDb(), user.id);
		setSessionCookie(cookies, token, url.protocol === 'https:');
		redirect(303, '/');
	}
};
