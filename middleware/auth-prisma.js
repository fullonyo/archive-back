const jwt = require('jsonwebtoken');
const { prisma } = require('../config/prisma');

// Verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if user still exists and is active using Prisma
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          email: true,
          accountType: true,
          isActive: true,
          isVerified: true
        }
      });

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive'
        });
      }

      req.user = user;
      next();
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError.message);
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// Check if user has required account type
const requireAccountType = (requiredTypes) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userType = req.user.accountType;
    const allowedTypes = Array.isArray(requiredTypes) ? requiredTypes : [requiredTypes];

    if (!allowedTypes.includes(userType)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        required: allowedTypes,
        current: userType
      });
    }

    next();
  };
};

// Check if user can upload (premium or admin)
const canUpload = requireAccountType(['PREMIUM', 'ADMIN']);

// Check if user is admin
const isAdmin = requireAccountType(['ADMIN']);

// Optional authentication (user may or may not be logged in)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if user exists and is active
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          email: true,
          accountType: true,
          isActive: true,
          isVerified: true
        }
      });

      if (user && user.isActive) {
        req.user = user;
      }
    } catch (jwtError) {
      // Ignore JWT errors in optional auth
      console.log('Optional auth JWT error (ignored):', jwtError.message);
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next(); // Continue without auth in case of errors
  }
};

module.exports = {
  verifyToken,
  requireAccountType,
  canUpload,
  isAdmin,
  optionalAuth
};
