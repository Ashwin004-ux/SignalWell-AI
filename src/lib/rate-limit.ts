/**
 * A minimal in-memory sliding-window rate limiter. This is intentionally
 * simple and has a real limitation: it's per-process, so it does NOT share
 * state across multiple server instances (e.g. serverless functions that
 * scale horizontally). It's enough to stop a single runaway client or a
 * tight retry loop from hammering the AI API from one instance, but it is
 * NOT a substitute for a shared store (Redis/Upstash) in a multi-instance
 * production deployment — see docs/ROADMAP.md.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const bucket = buckets.get(key) ?? { timestamps: [] };

  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSeconds = Math.ceil((windowMs - (now - oldest)) / 1000);
    buckets.set(key, bucket);
    return { allowed: false, retryAfterSeconds };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { allowed: true, retryAfterSeconds: 0 };
}

// Periodically drop buckets that have gone idle so this doesn't grow
// unbounded over a long-running process.
const IDLE_CLEANUP_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    const newest = bucket.timestamps[bucket.timestamps.length - 1] ?? 0;
    if (now - newest > IDLE_CLEANUP_MS) buckets.delete(key);
  }
}, IDLE_CLEANUP_MS).unref?.();
