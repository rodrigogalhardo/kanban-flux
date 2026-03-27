const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, maxRequests: number = 60, windowMs: number = 60000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = requestCounts.get(key);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: maxRequests - entry.count };
}

// Clean up old entries periodically
if (typeof globalThis !== "undefined") {
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    requestCounts.forEach((entry, key) => {
      if (now > entry.resetAt) requestCounts.delete(key);
    });
  }, 60000);

  // Allow the interval to not prevent process exit
  if (cleanupInterval?.unref) {
    cleanupInterval.unref();
  }
}
