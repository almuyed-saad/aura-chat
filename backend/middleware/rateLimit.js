const buckets = new Map();

const rateLimit = ({ windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests' } = {}) => {
  return (req, res, next) => {
    const forwardedFor = req.headers['x-forwarded-for'];
    const ip = (typeof forwardedFor === 'string' ? forwardedFor.split(',')[0] : req.ip) || 'unknown';
    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    existing.count += 1;
    if (existing.count > max) {
      res.set('Retry-After', String(Math.ceil((existing.resetAt - now) / 1000)));
      return res.status(429).json({ message });
    }

    return next();
  };
};

const cleanupRateLimitBuckets = () => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

const cleanupTimer = setInterval(cleanupRateLimitBuckets, 10 * 60 * 1000);
cleanupTimer.unref();

module.exports = rateLimit;
