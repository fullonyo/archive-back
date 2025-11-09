const { prisma } = require('../config/prisma');
const AssetService = require('./assetService');

// Helper function to convert BigInt to Number recursively
function convertBigIntToNumber(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  
  if (obj instanceof Date) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    const result = new Array(obj.length);
    for (let i = 0; i < obj.length; i++) {
      result[i] = convertBigIntToNumber(obj[i]);
    }
    return result;
  }
  
  if (typeof obj === 'object') {
    const converted = Object.create(Object.getPrototypeOf(obj));
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      converted[key] = convertBigIntToNumber(obj[key]);
    }
    return converted;
  }
  
  return obj;
}

/**
 * BookmarkService
 * Gerencia os bookmarks (save for later) dos usuários
 * Separado de UserFavorite (likes/hearts)
 */
class BookmarkService {
  /**
   * Toggle bookmark status
   * @param {number} userId - ID do usuário
   * @param {number} assetId - ID do asset
   * @returns {Promise<{success: boolean, bookmarked: boolean, message: string}>}
   */
  static async toggleBookmark(userId, assetId) {
    try {
      // Verificar se asset existe
      const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        select: { id: true, title: true }
      });

      if (!asset) {
        return {
          success: false,
          bookmarked: false,
          message: 'Asset not found'
        };
      }

      // Verificar se já existe bookmark
      const existingBookmark = await prisma.userBookmark.findUnique({
        where: {
          unique_user_asset_bookmark: {
            userId,
            assetId
          }
        }
      });

      if (existingBookmark) {
        // Remove bookmark
        await prisma.userBookmark.delete({
          where: { id: existingBookmark.id }
        });

        return {
          success: true,
          bookmarked: false,
          message: 'Bookmark removed'
        };
      } else {
        // Adiciona bookmark
        await prisma.userBookmark.create({
          data: {
            userId,
            assetId
          }
        });

        return {
          success: true,
          bookmarked: true,
          message: 'Asset bookmarked'
        };
      }
    } catch (error) {
      console.error('Toggle bookmark error:', error);
      throw error;
    }
  }

  /**
   * Get user bookmarks with pagination
   * @param {number} userId - ID do usuário
   * @param {number} page - Página atual (default: 1)
   * @param {number} limit - Items por página (default: 20)
   * @returns {Promise<{bookmarks: Array, total: number, page: number, limit: number}>}
   */
  static async getUserBookmarks(userId, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;

      const [bookmarks, total] = await Promise.all([
        prisma.userBookmark.findMany({
          where: { userId },
          include: {
            asset: {
              include: {
                category: true,
                user: {
                  select: {
                    id: true,
                    username: true,
                    avatarUrl: true
                  }
                },
                _count: {
                  select: {
                    favorites: true,
                    reviews: true,
                    downloads: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.userBookmark.count({ where: { userId } })
      ]);

      // Normalizar assets com URLs de proxy
      const normalizedBookmarks = bookmarks.map(bookmark => {
        const tags = AssetService.normalizeTags(bookmark.asset.tags);
        const { imageUrls, thumbnailUrl } = AssetService.normalizeAssetUrls(bookmark.asset);
        
        return {
          id: bookmark.id,
          bookmarkedAt: bookmark.createdAt,
          asset: {
            ...bookmark.asset,
            tags,
            imageUrls,
            thumbnailUrl,
            isBookmarked: true, // Sempre true em bookmarks
            likes: bookmark.asset._count?.favorites || 0,
            reviews: bookmark.asset._count?.reviews || 0,
            downloads: bookmark.asset._count?.downloads || 0
          }
        };
      });

      return convertBigIntToNumber({
        bookmarks: normalizedBookmarks,
        total,
        page,
        limit,
        hasMore: skip + bookmarks.length < total
      });
    } catch (error) {
      console.error('Get user bookmarks error:', error);
      throw error;
    }
  }

  /**
   * Check if user has bookmarked specific assets
   * @param {number} userId - ID do usuário
   * @param {number[]} assetIds - Array de IDs de assets
   * @returns {Promise<Set<number>>} Set de IDs dos assets bookmarked
   */
  static async getUserBookmarksSet(userId, assetIds) {
    try {
      const bookmarks = await prisma.userBookmark.findMany({
        where: {
          userId,
          assetId: { in: assetIds }
        },
        select: { assetId: true }
      });

      return new Set(bookmarks.map(b => b.assetId));
    } catch (error) {
      console.error('Get user bookmarks set error:', error);
      throw error;
    }
  }

  /**
   * Remove bookmark by ID
   * @param {number} bookmarkId - ID do bookmark
   * @param {number} userId - ID do usuário (para validação)
   * @returns {Promise<{success: boolean, message: string}>}
   */
  static async removeBookmark(bookmarkId, userId) {
    try {
      const bookmark = await prisma.userBookmark.findFirst({
        where: {
          id: bookmarkId,
          userId
        }
      });

      if (!bookmark) {
        return {
          success: false,
          message: 'Bookmark not found'
        };
      }

      await prisma.userBookmark.delete({
        where: { id: bookmarkId }
      });

      return {
        success: true,
        message: 'Bookmark removed'
      };
    } catch (error) {
      console.error('Remove bookmark error:', error);
      throw error;
    }
  }

  /**
   * Get bookmark count for user
   * @param {number} userId - ID do usuário
   * @returns {Promise<number>}
   */
  static async getUserBookmarksCount(userId) {
    try {
      return await prisma.userBookmark.count({ where: { userId } });
    } catch (error) {
      console.error('Get bookmarks count error:', error);
      throw error;
    }
  }
}

module.exports = BookmarkService;
