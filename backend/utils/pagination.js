const { isValidObjectId } = require('./validation');

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const encodeCursor = (message) => Buffer.from(JSON.stringify({
  createdAt: new Date(message.createdAt).toISOString(),
  id: String(message._id)
}), 'utf8').toString('base64url');

const decodeCursor = (value) => {
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const date = new Date(parsed.createdAt);
    if (!isValidObjectId(parsed.id) || Number.isNaN(date.getTime())) return null;
    return { createdAt: date, id: parsed.id };
  } catch {
    return null;
  }
};

const parsePagination = (query = {}) => {
  const rawLimit = Number.parseInt(query.limit, 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
  const hasPaginationQuery = query.limit !== undefined || query.before !== undefined;
  if (!hasPaginationQuery) return { enabled: false, limit, before: null };
  if (query.before !== undefined && !decodeCursor(query.before)) return { error: 'Invalid pagination cursor' };
  return { enabled: true, limit, before: query.before ? decodeCursor(query.before) : null };
};

const beforeFilter = (cursor) => cursor ? {
  $or: [
    { createdAt: { $lt: cursor.createdAt } },
    { createdAt: cursor.createdAt, _id: { $lt: cursor.id } }
  ]
} : null;

const pageResult = (messages, limit) => {
  const hasMore = messages.length > limit;
  const page = messages.slice(0, limit).reverse();
  return {
    items: page,
    pagination: {
      limit,
      hasMore,
      nextCursor: hasMore && page.length ? encodeCursor(page[0]) : null
    }
  };
};

module.exports = { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, beforeFilter, decodeCursor, encodeCursor, pageResult, parsePagination };
