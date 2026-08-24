const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const header = req.get('Authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token || token.includes(' ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded._id;
    if (!userId) return res.status(401).json({ error: 'Invalid token' });

    req.user = { id: String(userId), _id: String(userId) };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
