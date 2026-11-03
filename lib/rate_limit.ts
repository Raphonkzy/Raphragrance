// Simple in-memory token bucket / sliding window rate limiter
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  ip: string,
  limit = 5000,
  windowMs = 10000
): { allowed: boolean; remaining: number; reset: number } {
  const now = Date.now();
  let record = requestCounts.get(ip);

  if (!record || now > record.resetAt) {
    record = { count: 1, resetAt: now + windowMs };
    requestCounts.set(ip, record);
    return { allowed: true, remaining: limit - 1, reset: record.resetAt };
  }

  record.count++;
  if (record.count > limit) {
    return { allowed: false, remaining: 0, reset: record.resetAt };
  }

  return { allowed: true, remaining: limit - record.count, reset: record.resetAt };
}
