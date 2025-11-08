const express = require('express');
const UserService = require('../services/userService');
const AssetService = require('../services/assetService');
const UserCommentService = require('../services/userCommentService');
const { verifyToken, isAdmin, optionalAuth } = require('../middleware/auth');
const { validate, schemas, validateQuery, querySchemas } = require('../middleware/validation');
const { uploadConfigs, handleMulterError } = require('../config/multer');
const googleDriveService = require('../services/googleDrive');

const router = express.Router();

// Helper function to convert BigInt to Number recursively
function convertBigIntToNumber(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToNumber);
  }
  
  // Preserve Date objects
  if (obj instanceof Date) {
    return obj;
  }
  
  if (typeof obj === 'object') {
    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToNumber(value);
    }
    return converted;
  }
  
  return obj;
}

// Get current user profile - USING PRISMA
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await UserService.findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user stats
    const stats = await UserService.getUserStats(req.user.id);

    // Combine user data with stats
    const userWithStats = {
      ...user,
      stats: stats || {
        totalUploads: 0,
        totalDownloads: 0,
        totalFavorites: 0,
        totalReviews: 0,
        averageRating: 0
      }
    };

    res.json({
      success: true,
      data: { user: convertBigIntToNumber(userWithStats) }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
});

// Update user profile - USING PRISMA
router.put('/profile', verifyToken, validate(schemas.updateProfile), async (req, res) => {
  try {
    const { username, bio, avatar_url, country, city, social, socialLinks } = req.body;
    const userId = req.user.id;

    // Check if username is taken by another user
    if (username) {
      const existingUser = await UserService.findUserByUsername(username);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }
    }

    // Build update data
    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (bio !== undefined) updateData.bio = bio;
    if (avatar_url !== undefined) updateData.avatarUrl = avatar_url;
    if (country !== undefined) updateData.country = country;
    if (city !== undefined) updateData.city = city;
    // Aceitar tanto 'social' quanto 'socialLinks' para compatibilidade
    if (socialLinks !== undefined) updateData.socialLinks = socialLinks;
    if (social !== undefined) updateData.socialLinks = social;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    const updatedUser = await UserService.updateUser(userId, updateData);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: updatedUser }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update profile'
    });
  }
});

// Change password - USING PRISMA
router.put('/password', verifyToken, validate(schemas.changePassword), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    await UserService.changePassword(userId, currentPassword, newPassword);

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

// Upload avatar - USING PRISMA
router.post('/avatar', verifyToken, uploadConfigs.avatar, handleMulterError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Avatar file is required'
      });
    }

    // Upload avatar to Google Drive
    console.log('Uploading avatar to Google Drive...');
    const driveFile = await googleDriveService.uploadFile(req.file, req.file.buffer);
    
    // Use the direct view link for avatars (better for img tags)
    const avatarUrl = driveFile.directViewLink || driveFile.downloadLink;
    
    // Update user avatar URL
    await UserService.updateUser(req.user.id, { 
      avatarUrl: avatarUrl 
    });

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: { 
        avatar_url: avatarUrl,
        drive_id: driveFile.id
      }
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload avatar'
    });
  }
});

// Upload banner - USING PRISMA  
router.post('/banner', verifyToken, uploadConfigs.banner, handleMulterError, async (req, res) => {
  try {
    console.log('🖼️ Banner upload route: Starting upload for user', req.user.id);
    
    if (!req.file) {
      console.log('❌ Banner upload route: No file provided');
      return res.status(400).json({
        success: false,
        message: 'Banner file is required'
      });
    }

    console.log('🖼️ Banner upload route: File received:', req.file.originalname, req.file.size);

    // Upload banner to Google Drive
    console.log('📤 Banner upload route: Uploading to Google Drive...');
    const driveFile = await googleDriveService.uploadFile(req.file, req.file.buffer);
    
    console.log('✅ Banner upload route: Google Drive upload successful:', driveFile.id);
    
    // Use the direct view link for banners (better for img tags)
    const bannerUrl = driveFile.directViewLink || driveFile.alternativeViewLink || driveFile.downloadLink;
    
    console.log('🔗 Banner upload route: Banner URL:', bannerUrl);
    console.log('🔗 Banner upload route: Available URLs:', {
      directViewLink: driveFile.directViewLink,
      alternativeViewLink: driveFile.alternativeViewLink,
      downloadLink: driveFile.downloadLink
    });
    
    // Update user banner URL
    console.log('💾 Banner upload route: Updating user in database...');
    await UserService.updateUser(req.user.id, { 
      bannerUrl: bannerUrl 
    });

    console.log('✅ Banner upload route: User updated successfully');

    res.json({
      success: true,
      message: 'Banner uploaded successfully',
      data: { 
        banner_url: bannerUrl,
        drive_id: driveFile.id
      }
    });
  } catch (error) {
    console.error('❌ Banner upload route: Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload banner'
    });
  }
});

// Get user's assets - USING PRISMA
router.get('/assets', optionalAuth, validateQuery(querySchemas.pagination), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sort = 'newest', 
      userId,
      includeUnapproved,
      includeInactive 
    } = req.query;

    let targetUserId;
    let allowUnapproved = false;
    let allowInactive = false;

    if (userId) {
      // Buscando assets de outro usuário (público)
      targetUserId = parseInt(userId);
    } else if (req.user) {
      // Buscando assets do usuário logado (privado)
      targetUserId = req.user.id;
      allowUnapproved = true; // User can see their own unapproved assets
      allowInactive = true;   // User can see their own inactive assets
    } else {
      return res.status(401).json({
        success: false,
        message: 'Authentication required or userId parameter missing'
      });
    }

    // Parse boolean parameters from query string
    const shouldIncludeUnapproved = allowUnapproved && (includeUnapproved === 'true');
    const shouldIncludeInactive = allowInactive && (includeInactive === 'true');

    const result = await UserService.getUserAssets(targetUserId, {
      page: parseInt(page),
      limit: parseInt(limit),
      includeUnapproved: shouldIncludeUnapproved,
      includeInactive: shouldIncludeInactive
    });

    // Disable cache for user assets to ensure fresh approval status
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      data: convertBigIntToNumber(result)
    });
  } catch (error) {
    console.error('Get user assets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user assets'
    });
  }
});

// Get user's favorites by user ID (public route) - USING PRISMA
router.get('/favorites', validateQuery(querySchemas.pagination), async (req, res) => {
  try {
    const { userId, page = 1, limit = 20 } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const result = await UserService.getUserFavorites(parseInt(userId), {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: convertBigIntToNumber(result)
    });
  } catch (error) {
    console.error('Get user favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user favorites'
    });
  }
});

// Get current user's favorites (private route) - USING PRISMA
router.get('/my-favorites', verifyToken, validateQuery(querySchemas.pagination), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const result = await UserService.getUserFavorites(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: convertBigIntToNumber(result)
    });
  } catch (error) {
    console.error('Get user favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user favorites'
    });
  }
});

// Delete user account (soft delete) - USING PRISMA
router.delete('/account', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await UserService.softDeleteUser(userId);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account'
    });
  }
});

// Admin routes
// Get all users (admin only) - USING PRISMA
router.get('/', verifyToken, isAdmin, validateQuery(querySchemas.pagination), async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = 'newest' } = req.query;

    const result = await UserService.findAllUsers({
      page: parseInt(page),
      limit: parseInt(limit),
      sort
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users'
    });
  }
});

// Update user account type (admin only) - USING PRISMA
router.put('/:userId/account-type', verifyToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { account_type } = req.body;

    if (!['free', 'premium', 'admin'].includes(account_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account type'
      });
    }

    await UserService.updateAccountType(parseInt(userId), account_type);

    // TODO: Log admin action when AdminLog service is created

    res.json({
      success: true,
      message: 'Account type updated successfully'
    });
  } catch (error) {
    console.error('Update account type error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update account type'
    });
  }
});

// Ranking Routes
// Get top uploaders
router.get('/top-uploaders', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const users = await UserService.getTopUploaders(limit);
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get top uploaders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get top uploaders'
    });
  }
});

// Get top by downloads
router.get('/top-downloads', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const users = await UserService.getTopByDownloads(limit);
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get top by downloads error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get top by downloads'
    });
  }
});

// Get top by likes
router.get('/top-likes', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const users = await UserService.getTopByLikes(limit);
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get top by likes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get top by likes'
    });
  }
});

// Get top by rating
router.get('/top-rating', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const users = await UserService.getTopByRating(limit);
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get top by rating error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get top by rating'
    });
  }
});

// Get user by username - USING PRISMA (OPTIMIZED - Single Query)
router.get('/username/:username', optionalAuth, async (req, res) => {
  try {
    const { username } = req.params;
    
    // ✅ OTIMIZADO: Uma única query com include
    const user = await UserService.findUserByUsernameWithStats(username);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: convertBigIntToNumber(user)
    });
  } catch (error) {
    console.error('Get user by username error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user'
    });
  }
});

// Get user by ID - USING PRISMA
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await UserService.findUserById(parseInt(id));
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user stats
    const stats = await UserService.getUserStats(parseInt(id));
    const userWithStats = { ...user, stats };

    res.json({
      success: true,
      data: convertBigIntToNumber(userWithStats)
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user'
    });
  }
});

// Comment Routes

// Get profile comments
router.get('/:id/comments', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    // Verificar se o perfil existe
    const profileUser = await UserService.findUserById(parseInt(id));
    if (!profileUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const includeHidden = req.user && req.user.id === parseInt(id);
    const requesterId = req.user ? req.user.id : null;

    const result = await UserCommentService.getProfileComments({
      profileUserId: parseInt(id),
      page: parseInt(page),
      limit: parseInt(limit),
      includeHidden,
      requesterId
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get profile comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile comments'
    });
  }
});

// Create comment on profile
router.post('/:id/comments', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, parentId } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Content is required'
      });
    }

    if (content.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Comment too long (max 1000 characters)'
      });
    }

    // Verificar se o perfil existe
    const profileUser = await UserService.findUserById(parseInt(id));
    if (!profileUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const comment = await UserCommentService.createComment({
      profileUserId: parseInt(id),
      authorId: req.user.id,
      parentId: parentId ? parseInt(parentId) : null,
      content
    });

    res.status(201).json({
      success: true,
      message: 'Comment created successfully',
      data: comment
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create comment'
    });
  }
});

// Get comment replies
router.get('/comments/:commentId/replies', optionalAuth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const requesterId = req.user ? req.user.id : null;

    const result = await UserCommentService.getCommentReplies({
      commentId: parseInt(commentId),
      page: parseInt(page),
      limit: parseInt(limit),
      requesterId
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get comment replies error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get comment replies'
    });
  }
});

// Toggle comment like
router.post('/comments/:commentId/like', verifyToken, async (req, res) => {
  try {
    const { commentId } = req.params;

    const result = await UserCommentService.toggleCommentLike(
      parseInt(commentId),
      req.user.id
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Toggle comment like error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to toggle comment like'
    });
  }
});

// Update comment visibility (profile owner only)
router.put('/comments/:commentId/visibility', verifyToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { isVisible } = req.body;

    if (typeof isVisible !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isVisible must be a boolean'
      });
    }

    const comment = await UserCommentService.updateCommentVisibility(
      parseInt(commentId),
      req.user.id,
      isVisible
    );

    res.json({
      success: true,
      message: 'Comment visibility updated',
      data: comment
    });
  } catch (error) {
    console.error('Update comment visibility error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update comment visibility'
    });
  }
});

// Pin/unpin comment (profile owner only)
router.put('/comments/:commentId/pin', verifyToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { isPinned } = req.body;

    if (typeof isPinned !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isPinned must be a boolean'
      });
    }

    const comment = await UserCommentService.pinComment(
      parseInt(commentId),
      req.user.id,
      isPinned
    );

    res.json({
      success: true,
      message: isPinned ? 'Comment pinned' : 'Comment unpinned',
      data: comment
    });
  } catch (error) {
    console.error('Pin comment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to pin comment'
    });
  }
});

// Delete comment
router.delete('/comments/:commentId', verifyToken, async (req, res) => {
  try {
    const { commentId } = req.params;

    await UserCommentService.deleteComment(
      parseInt(commentId),
      req.user.id
    );

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete comment'
    });
  }
});

// Get profile comment stats
router.get('/:id/comments/stats', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o perfil existe
    const profileUser = await UserService.findUserById(parseInt(id));
    if (!profileUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const stats = await UserCommentService.getProfileCommentStats(parseInt(id));

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get comment stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get comment stats'
    });
  }
});

module.exports = router;
