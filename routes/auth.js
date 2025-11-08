const express = require('express');
const AuthService = require('../services/authService');
const { validate, schemas } = require('../middleware/validation');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Register new user - USING PRISMA
router.post('/register', validate(schemas.register), async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const result = await AuthService.register({
      username,
      email,
      password
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Registration failed'
    });
  }
});

// Login user - USING PRISMA - Aceita email ou username
router.post('/login', validate(schemas.login), async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const credential = email || username; // Aceita ambos

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Email or username required'
      });
    }

    const result = await AuthService.login(credential, password);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        token: result.tokens.accessToken, // Frontend espera 'token'
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      message: error.message || 'Login failed'
    });
  }
});

// Refresh token - USING PRISMA
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    const result = await AuthService.refreshAccessToken(refreshToken);

    res.json({
      success: true,
      data: {
        accessToken: result.accessToken,
        user: result.user
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: error.message || 'Token refresh failed'
    });
  }
});

// Logout user - USING PRISMA
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    await AuthService.logout(refreshToken);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

// Get current user info - USING PRISMA
router.get('/me', verifyToken, async (req, res) => {
  try {
    const UserService = require('../services/userService');
    const userStats = await UserService.getUserStats(req.user.id);
    
    res.json({
      success: true,
      data: {
        user: {
          ...req.user,
          stats: userStats
        }
      }
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user info'
    });
  }
});

// Get profile - alias for /me - USING PRISMA
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const UserService = require('../services/userService');
    const userStats = await UserService.getUserStats(req.user.id);
    
    res.json({
      success: true,
      data: {
        user: {
          ...req.user,
          stats: userStats
        }
      }
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
});

// Change password - USING PRISMA
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    await AuthService.changePassword(req.user.id, currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to change password'
    });
  }
});

// Google OAuth login (placeholder for future implementation)
router.get('/google', async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Google OAuth not implemented yet'
  });
});

// Verify email (placeholder for future implementation)
router.post('/verify-email', async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Email verification not implemented yet'
  });
});

// Request password reset (placeholder for future implementation)
router.post('/forgot-password', async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Password reset not implemented yet'
  });
});

module.exports = router;
