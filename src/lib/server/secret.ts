// The app's secret key, used to encrypt undo tokens (and later sessions).
// Production must set XENIA_SECRET (e.g. `openssl rand -hex 32`); it must stay the same across restarts.
// In development a random one is used, so undo tokens just stop working after a restart.
import { dev } from '$app/env';

let secret: string | undefined;

export function appSecret(): string {
	secret ??= process.env.XENIA_SECRET || developmentSecret();
	return secret;
}

function developmentSecret(): string {
	if (!dev) throw new Error('XENIA_SECRET is not set. Generate one with `openssl rand -hex 32`.');
	return crypto.randomUUID();
}
