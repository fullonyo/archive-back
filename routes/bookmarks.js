const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth-prisma');
const BookmarkService = require('../services/bookmarkService');

/**
 * @route POST /api/bookmarks/:assetId
 * @desc Toggle bookmark (save for later)
 * @access Private
 */
router.post('/:assetId', verifyToken, async (req, res) => {
  try {
    const { assetId } = req.params;
    const userId = req.user.id;

    const result = await BookmarkService.toggleBookmark(userId, parseInt(assetId));

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.message
      });
    }

    res.json({
      success: true,
      bookmarked: result.bookmarked,
      message: result.message
    });
  } catch (error) {
    console.error('Toggle bookmark error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling bookmark',
      error: error.message
    });
  }
});

/**
 * @route GET /api/bookmarks
 * @desc Get user's bookmarks
 * @access Private
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await BookmarkService.getUserBookmarks(userId, page, limit);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get bookmarks error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bookmarks',
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/bookmarks/:bookmarkId
 * @desc Remove specific bookmark by ID
 * @access Private
 */
router.delete('/:bookmarkId', verifyToken, async (req, res) => {
  try {
    const { bookmarkId } = req.params;
    const userId = req.user.id;

    const result = await BookmarkService.removeBookmark(parseInt(bookmarkId), userId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.message
      });
    }

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Remove bookmark error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing bookmark',
      error: error.message
    });
  }
});

/**
 * @route GET /api/bookmarks/count
 * @desc Get user's bookmark count
 * @access Private
 */
router.get('/count', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await BookmarkService.getUserBookmarksCount(userId);

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Get bookmark count error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bookmark count',
      error: error.message
    });
  }
});

module.exports = router;
