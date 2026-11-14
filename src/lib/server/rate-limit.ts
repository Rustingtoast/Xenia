// A tiny in-memory, fixed-window rate limiter. It lives in the process (not the database), so it
// resets on restart — that's fine here: the goal is to slow automated password guessing, not to be
// a durable counter.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Drop expired buckets once the map gets large, so a flood of distinct keys can't grow it forever.
function prune(now: number): void {
	if (buckets.size < 5000) return;
	for (const [key, bucket] of buckets) {
		if (bucket.resetAt <= now) buckets.delete(key);
	}
}

/**
 * Records one attempt for `key` and reports whether it is still within the limit.
 * `limit` is the maximum attempts allowed per `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
	prune(now);
	const bucket = buckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		buckets.set(key, { count: 1, resetAt: now + windowMs });
		return true;
	}
	bucket.count += 1;
	return bucket.count <= limit;
}

/** True when `key` is currently over its limit (used to reject before doing any work). */
export function isRateLimited(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
	const bucket = buckets.get(key);
	return !!bucket && bucket.resetAt > now && bucket.count >= limit;
}

/** Forgets any recorded attempts for `key` (e.g. after a successful login). */
export function resetRateLimit(key: string): void {
	buckets.delete(key);
}
