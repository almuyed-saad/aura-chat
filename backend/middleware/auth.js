const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id || decoded._id,  // ✅ Works with both formats
      _id: decoded.id || decoded._id
    };
    console.log('✅ Auth success for user:', req.user.id);
    next();
  } catch (error) {
    console.error('❌ Auth error:', error.message);
    res.status(401).json({ error: 'Invalid token' });
  }
};