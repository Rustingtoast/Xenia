// In-memory fixed-window rate limiter. It resets on restart — fine here: the goal is to slow
// automated guessing, not to be a durable counter.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Drop expired buckets once the map gets large, so distinct keys can't grow it forever.
function prune(now: number): void {
	if (buckets.size < 5000) return;
	for (const [key, bucket] of buckets) {
		if (bucket.resetAt <= now) buckets.delete(key);
	}
}

/** Records an attempt for `key`; returns false when it is over the limit (rejected). */
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

export function isRateLimited(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
	const bucket = buckets.get(key);
	return !!bucket && bucket.resetAt > now && bucket.count >= limit;
}

export function resetRateLimit(key: string): void {
	buckets.delete(key);
}
