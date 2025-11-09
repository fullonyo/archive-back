const { prisma } = require('../config/prisma');

// Helper function to convert BigInt to Number recursively (OPTIMIZED)
function convertBigIntToNumber(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  
  // Preserve Date objects (fast check)
  if (obj instanceof Date) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    // Pre-allocate array for better performance
    const result = new Array(obj.length);
    for (let i = 0; i < obj.length; i++) {
      result[i] = convertBigIntToNumber(obj[i]);
    }
    return result;
  }
  
  if (typeof obj === 'object') {
    // Use Object.create for faster object creation
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

// Helper function to ensure tags are always arrays
function normalizeTags(tags) {
  if (!tags) return [];
  
  if (Array.isArray(tags)) {
    return tags.filter(tag => tag && typeof tag === 'string');
  }
  
  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) {
        return parsed.filter(tag => tag && typeof tag === 'string');
      }
    } catch {
      // If JSON parsing fails, treat as comma-separated string
      return tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    }
  }
  
  return [];
}

// Helper function to ensure imageUrls are always arrays
function normalizeImageUrls(imageUrls) {
  if (!imageUrls) return [];
  
  if (Array.isArray(imageUrls)) {
    return imageUrls.filter(url => url && typeof url === 'string');
  }
  
  if (typeof imageUrls === 'string') {
    try {
      const parsed = JSON.parse(imageUrls);
      if (Array.isArray(parsed)) {
        return parsed.filter(url => url && typeof url === 'string');
      }
    } catch {
      // If JSON parsing fails, return single URL as array
      return [imageUrls];
    }
  }
  
  return [];
}

// Helper function to extract Google Drive file ID from various URL formats
function extractGoogleDriveId(url) {
  if (!url || typeof url !== 'string') return null;
  
  // Pattern 1: https://drive.google.com/file/d/FILE_ID/view
  const pattern1 = /\/file\/d\/([a-zA-Z0-9_-]+)/;
  const match1 = url.match(pattern1);
  if (match1) return match1[1];
  
  // Pattern 2: https://drive.google.com/uc?id=FILE_ID
  // Pattern 3: https://drive.google.com/uc?export=download&id=FILE_ID
  // Pattern 4: https://drive.google.com/uc?export=view&id=FILE_ID
  const pattern2 = /[?&]id=([a-zA-Z0-9_-]+)/;
  const match2 = url.match(pattern2);
  if (match2) return match2[1];
  
  // Pattern 5: https://drive.google.com/thumbnail?id=FILE_ID&sz=w400
  const pattern3 = /thumbnail\?id=([a-zA-Z0-9_-]+)/;
  const match3 = url.match(pattern3);
  if (match3) return match3[1];
  
  // Pattern 6: https://drive.google.com/open?id=FILE_ID
  const pattern4 = /open\?id=([a-zA-Z0-9_-]+)/;
  const match4 = url.match(pattern4);
  if (match4) return match4[1];
  
  // Pattern 7: https://lh3.googleusercontent.com/d/FILE_ID
  const pattern5 = /googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/;
  const match5 = url.match(pattern5);
  if (match5) return match5[1];
  
  // If it looks like a direct ID (no URL format)
  if (/^[a-zA-Z0-9_-]{25,}$/.test(url)) {
    return url;
  }
  
  return null;
}

// Helper function to convert Google Drive URL to proxy URL
function convertToProxyUrl(driveUrl) {
  if (!driveUrl || typeof driveUrl !== 'string') return driveUrl;
  
  // Skip if already a proxy URL
  if (driveUrl.includes('/api/proxy/image')) return driveUrl;
  
  // Skip if it's a data URI or placeholder
  if (driveUrl.startsWith('data:') || driveUrl.includes('placeholder')) return driveUrl;
  
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  return `${baseUrl}/api/proxy/image?url=${encodeURIComponent(driveUrl)}`;
}

// Helper function to normalize asset URLs (thumbnailUrl + imageUrls)
function normalizeAssetUrls(asset) {
  // Normalize imageUrls array
  let imageUrls = normalizeImageUrls(asset.imageUrls);
  
  // Get proper thumbnail URL
  let thumbnailUrl = getProperThumbnailUrl(asset);
  
  // Convert all Google Drive URLs to proxy URLs
  imageUrls = imageUrls.map(url => convertToProxyUrl(url));
  thumbnailUrl = convertToProxyUrl(thumbnailUrl);
  
  return {
    imageUrls,
    thumbnailUrl
  };
}

// Helper function to generate proper Google Drive thumbnail URL
function getProperThumbnailUrl(asset) {
  let fileId = null;
  
  // Priority 1: Try to extract ID from thumbnailUrl if it exists
  if (asset.thumbnailUrl) {
    fileId = extractGoogleDriveId(asset.thumbnailUrl);
    // If thumbnailUrl is already in thumbnail format and valid, return as-is
    if (fileId && asset.thumbnailUrl.includes('thumbnail?id=')) {
      return asset.thumbnailUrl;
    }
  }
  
  // Priority 2: Try to extract ID from googleDriveUrl
  if (!fileId && asset.googleDriveUrl) {
    fileId = extractGoogleDriveId(asset.googleDriveUrl);
  }
  
  // Priority 3: Use googleDriveId directly
  if (!fileId && asset.googleDriveId) {
    fileId = extractGoogleDriveId(asset.googleDriveId);
  }
  
  // Priority 4: Try to extract from first imageUrl
  if (!fileId && asset.imageUrls) {
    const images = normalizeImageUrls(asset.imageUrls);
    if (images.length > 0) {
      fileId = extractGoogleDriveId(images[0]);
      // If no ID extracted but valid URL, return the URL
      if (!fileId && images[0] && !images[0].includes('test_') && !images[0].includes('placeholder')) {
        return images[0];
      }
    }
  }
  
  // If we found a valid file ID, construct the thumbnail URL
  if (fileId && !fileId.includes('test_') && !fileId.includes('placeholder')) {
    const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
    
    // Use proxy URL for better compatibility (bypasses CORS and authentication issues)
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const proxyUrl = `${backendUrl}/api/proxy/image?url=${encodeURIComponent(thumbnailUrl)}`;
    
    return proxyUrl;
  }
  
  // Fallback to null (frontend will use placeholder)
  return null;
}

/**
 * Asset Service - Todas as operações relacionadas a assets
 */
class AssetService {
  // Criar novo asset
  static async createAsset(assetData) {
    const asset = await prisma.asset.create({
      data: assetData,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            icon: true
          }
        }
      }
    });
    
    return convertBigIntToNumber(asset);
  }

  // Buscar asset por ID com informações completas
  static async findAssetById(id, userId = null, includeInactive = false) {
    const where = {
      id,
      ...(includeInactive ? {} : { isActive: true, isApproved: true })
    };

    const asset = await prisma.asset.findUnique({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            accountType: true,
            createdAt: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            description: true,
            icon: true
          }
        },
        reviews: {
          where: { isApproved: true },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            downloads: true,
            favorites: true,
            reviews: { where: { isApproved: true } }
          }
        }
      }
    });
    
    if (asset) {
      // Normalize tags
      asset.tags = normalizeTags(asset.tags);
      
      // Normalize URLs (imageUrls + thumbnailUrl) - CENTRALIZADO
      const { imageUrls, thumbnailUrl } = normalizeAssetUrls(asset);
      asset.imageUrls = imageUrls;
      asset.thumbnailUrl = thumbnailUrl;
      
      // Calculate average rating from reviews
      if (asset.reviews && asset.reviews.length > 0) {
        const totalRating = asset.reviews.reduce((sum, review) => sum + review.rating, 0);
        asset.averageRating = Number((totalRating / asset.reviews.length).toFixed(1));
      } else {
        asset.averageRating = 0;
      }
      
      // Check if asset is favorited by the logged user
      if (userId) {
        asset.isLiked = await this.isFavoritedByUser(userId, id);
      } else {
        asset.isLiked = false;
      }
    }
    
    return convertBigIntToNumber(asset);
  }

  // Buscar assets com filtros e paginação
  static async findAssets({
    page = 1,
    limit = 20,
    search = '',
    searchQuery = '',
    categoryId = null,
    userId = null,
    excludeId = null,
    isApproved = true,
    isActive = true,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    tags = null
  }) {
    const skip = (page - 1) * limit;
    
    // Normalizar sortBy para campos do banco
    let orderByField = sortBy;
    let orderByDirection = sortOrder;
    
    // Mapear aliases para campos reais
    if (sortBy === 'newest' || sortBy === 'latest') {
      orderByField = 'createdAt';
      orderByDirection = 'desc';
    } else if (sortBy === 'oldest') {
      orderByField = 'createdAt';
      orderByDirection = 'asc';
    } else if (sortBy === 'popular' || sortBy === 'downloads') {
      orderByField = 'downloadCount';
      orderByDirection = 'desc';
    } else if (sortBy === 'trending') {
      // Trending = mais downloads recentemente
      orderByField = 'downloadCount';
      orderByDirection = 'desc';
    } else if (sortBy === 'name') {
      orderByField = 'title';
      orderByDirection = 'asc';
    } else if (sortBy === 'createdAt') {
      // Já está correto
      orderByField = 'createdAt';
    }
    
    const where = {
      ...(isActive !== null && isActive !== undefined && { isActive }),
      ...(isApproved !== null && isApproved !== undefined && { isApproved }),
      ...(categoryId && { categoryId: parseInt(categoryId) }),
      ...(userId && { userId: parseInt(userId) }),
      ...(excludeId && { id: { not: excludeId } }),
      ...((search || searchQuery) && {
        OR: [
          { title: { contains: search || searchQuery } },
          { description: { contains: search || searchQuery } }
        ]
      }),
      ...(tags && tags.length > 0 && {
        OR: tags.map(tag => ({
          tags: { contains: tag }
        }))
      })
    };

    const orderBy = {};
    orderBy[orderByField] = orderByDirection;

    // Primeira consulta: buscar assets e contar total
    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true
            }
          },
          category: {
            select: {
              id: true,
              name: true,
              icon: true
            }
          },
          _count: {
            select: {
              downloads: true,
              favorites: true,
              reviews: { where: { isApproved: true } }
            }
          }
        },
        skip,
        take: limit,
        orderBy
      }),
      prisma.asset.count({ where })
    ]);

    // Segunda consulta: buscar ratings APENAS se houver assets (otimização)
    let reviewsMap = new Map();
    
    if (assets.length > 0) {
      const assetIds = assets.map(asset => asset.id);
      
      const reviewsData = await prisma.assetReview.groupBy({
        by: ['assetId'],
        where: {
          assetId: { in: assetIds },
          isApproved: true
        },
        _avg: {
          rating: true
        },
        _count: {
          rating: true
        }
      });

      // Criar um mapa para acesso rápido aos dados de review
      reviewsData.forEach(review => {
        reviewsMap.set(review.assetId, {
          averageRating: Number((review._avg.rating || 0).toFixed(2)),
          reviewCount: review._count.rating
        });
      });
    }

    // Combinar dados dos assets com reviews (BATCH PROCESSING)
    const assetsWithRating = assets.map(asset => {
      // Normalize tags
      const tags = normalizeTags(asset.tags);
      
      // Normalize URLs (imageUrls + thumbnailUrl) - CENTRALIZADO
      const { imageUrls, thumbnailUrl } = normalizeAssetUrls(asset);
      
      return {
        ...asset,
        tags,
        imageUrls,
        thumbnailUrl,
        averageRating: reviewsMap.get(asset.id)?.averageRating || 0,
        reviewCount: reviewsMap.get(asset.id)?.reviewCount || 0
      };
    });

    return convertBigIntToNumber({
      assets: assetsWithRating,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  }

  // Incrementar contador de downloads
  static async incrementDownloadCount(assetId, userId = null, ipAddress = null, userAgent = null) {
    return await prisma.$transaction(async (tx) => {
      // Registrar download
      await tx.assetDownload.create({
        data: {
          assetId,
          userId,
          ipAddress,
          userAgent
        }
      });

      // Incrementar contador
      return await tx.asset.update({
        where: { id: assetId },
        data: {
          downloadCount: {
            increment: 1
          }
        }
      });
    });
  }

  // Adicionar/remover favorito
  static async toggleFavorite(userId, assetId) {
    const existing = await prisma.userFavorite.findUnique({
      where: {
        unique_user_asset: {
          userId,
          assetId
        }
      }
    });

    if (existing) {
      // Remover favorito
      await prisma.userFavorite.delete({
        where: { id: existing.id }
      });
      return { action: 'removed', isFavorited: false };
    } else {
      // Adicionar favorito
      await prisma.userFavorite.create({
        data: {
          userId,
          assetId
        }
      });
      return { action: 'added', isFavorited: true };
    }
  }

  // Verificar se asset está favoritado pelo usuário
  static async isFavoritedByUser(userId, assetId) {
    const favorite = await prisma.userFavorite.findUnique({
      where: {
        unique_user_asset: {
          userId,
          assetId
        }
      }
    });
    return !!favorite;
  }

  // Toggle bookmark (save for later)
  static async toggleBookmark(userId, assetId) {
    const existing = await prisma.userBookmark.findUnique({
      where: {
        unique_user_asset_bookmark: {
          userId,
          assetId
        }
      }
    });

    if (existing) {
      // Remove bookmark
      await prisma.userBookmark.delete({
        where: { id: existing.id }
      });
      
      // Get updated bookmark count
      const bookmarkCount = await prisma.userBookmark.count({
        where: { assetId }
      });
      
      return { action: 'removed', isBookmarked: false, bookmarkCount };
    } else {
      // Add bookmark
      await prisma.userBookmark.create({
        data: {
          userId,
          assetId
        }
      });
      
      // Get updated bookmark count
      const bookmarkCount = await prisma.userBookmark.count({
        where: { assetId }
      });
      
      return { action: 'added', isBookmarked: true, bookmarkCount };
    }
  }

  // Check if asset is bookmarked by user
  static async isBookmarkedByUser(userId, assetId) {
    const bookmark = await prisma.userBookmark.findUnique({
      where: {
        unique_user_asset_bookmark: {
          userId,
          assetId
        }
      }
    });
    return !!bookmark;
  }

  // Adicionar/atualizar review
  static async createOrUpdateReview(reviewData) {
    const { userId, assetId, rating, comment } = reviewData;
    
    const existingReview = await prisma.assetReview.findUnique({
      where: {
        unique_user_asset_review: {
          userId,
          assetId
        }
      }
    });

    const isUpdate = !!existingReview;

    const review = await prisma.assetReview.upsert({
      where: {
        unique_user_asset_review: {
          userId,
          assetId
        }
      },
      update: {
        rating,
        comment,
        updatedAt: new Date()
      },
      create: {
        userId,
        assetId,
        rating,
        comment
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true
          }
        }
      }
    });

    return { review: convertBigIntToNumber(review), isUpdate };
  }

  // Buscar reviews de um asset
  static async getAssetReviews(assetId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.assetReview.findMany({
        where: {
          assetId,
          isApproved: true
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.assetReview.count({
        where: {
          assetId,
          isApproved: true
        }
      })
    ]);

    return convertBigIntToNumber({
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  }

  // Adicionar review
  static async addReview(userId, assetId, rating, comment = null) {
    return await prisma.assetReview.upsert({
      where: {
        unique_user_asset_review: {
          userId,
          assetId
        }
      },
      update: {
        rating,
        comment,
        updatedAt: new Date()
      },
      create: {
        userId,
        assetId,
        rating,
        comment
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true
          }
        }
      }
    });
  }

  // Aprovar/rejeitar asset (admin)
  static async updateApprovalStatus(assetId, isApproved, adminId) {
    return await prisma.$transaction(async (tx) => {
      // Atualizar status do asset
      const asset = await tx.asset.update({
        where: { id: assetId },
        data: { isApproved }
      });

      // Registrar log admin
      await tx.adminLog.create({
        data: {
          adminId,
          action: isApproved ? 'APPROVE_ASSET' : 'REJECT_ASSET',
          targetType: 'asset',
          targetId: assetId,
          details: JSON.stringify({
            assetTitle: asset.title,
            previousStatus: !isApproved,
            newStatus: isApproved
          })
        }
      });

      return asset;
    });
  }

  // Buscar assets pendentes de aprovação
  static async findPendingAssets(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where: {
          isActive: true,
          isApproved: false
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              accountType: true
            }
          },
          category: {
            select: {
              id: true,
              name: true,
              icon: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' } // Mais antigos primeiro
      }),
      prisma.asset.count({
        where: {
          isActive: true,
          isApproved: false
        }
      })
    ]);

    // Processar assets para garantir tipos corretos
    const processedAssets = assets.map(asset => {
      const processed = convertBigIntToNumber(asset);
      
      // Garantir que tags e imageUrls sejam arrays
      processed.tags = normalizeTags(processed.tags);
      processed.imageUrls = normalizeImageUrls(processed.imageUrls);
      
      return processed;
    });

    return {
      assets: processedAssets,
      pagination: {
        page,
        limit,
        total: Number(total),
        pages: Math.ceil(Number(total) / limit)
      }
    };
  }

  // Assets populares (mais downloads)
  static async getPopularAssets(limit = 10) {
    return await prisma.asset.findMany({
      where: {
        isActive: true,
        isApproved: true
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            icon: true
          }
        }
      },
      orderBy: { downloadCount: 'desc' },
      take: limit
    });
  }

  // Assets recentes
  static async getRecentAssets(limit = 10) {
    const assets = await prisma.asset.findMany({
      where: {
        isActive: true,
        isApproved: true
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            icon: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    
    return convertBigIntToNumber(assets);
  }

  // Estatísticas gerais
  static async getStats() {
    const [
      totalAssets,
      totalApproved,
      totalPending,
      totalDownloads,
      totalUsers,
      recentUploads
    ] = await Promise.all([
      prisma.asset.count({ where: { isActive: true } }),
      prisma.asset.count({ where: { isActive: true, isApproved: true } }),
      prisma.asset.count({ where: { isActive: true, isApproved: false } }),
      prisma.assetDownload.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.asset.count({
        where: {
          isActive: true,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Últimos 7 dias
          }
        }
      })
    ]);

    return convertBigIntToNumber({
      totalAssets,
      totalApproved,
      totalPending,
      totalDownloads,
      totalUsers,
      recentUploads
    });
  }

  // Record asset download
  static async recordDownload(downloadData) {
    try {
      // Update download count
      await prisma.asset.update({
        where: { id: downloadData.assetId },
        data: {
          downloadCount: {
            increment: 1
          }
        }
      });

      // Optionally, you can also create a download record for analytics
      // (This would require a downloads table in your schema)
      
      return true;
    } catch (error) {
      console.error('Error recording download:', error);
      throw error;
    }
  }

  // Permanently delete asset (hard delete)
  static async deleteAsset(assetId, adminId = null) {
    return await prisma.$transaction(async (tx) => {
      // First, fetch asset information for logging before deletion
      const asset = await tx.asset.findUnique({
        where: { id: assetId },
        select: {
          id: true,
          title: true,
          fileName: true,
          googleDriveId: true,
          user: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });

      if (!asset) {
        throw new Error('Asset not found');
      }

      // Delete related records in correct order due to foreign key constraints
      
      // Delete asset reviews
      await tx.assetReview.deleteMany({
        where: { assetId }
      });

      // Delete asset downloads
      await tx.assetDownload.deleteMany({
        where: { assetId }
      });

      // Delete user favorites
      await tx.userFavorite.deleteMany({
        where: { assetId }
      });

      // Delete admin logs related to this asset
      await tx.adminLog.deleteMany({
        where: {
          targetType: 'asset',
          targetId: assetId
        }
      });

      // Finally, delete the asset itself
      await tx.asset.delete({
        where: { id: assetId }
      });

      // Log the deletion action if admin ID is provided
      if (adminId) {
        await tx.adminLog.create({
          data: {
            adminId,
            action: 'HARD_DELETE_ASSET',
            targetType: 'asset',
            targetId: assetId,
            details: JSON.stringify({
              assetTitle: asset.title,
              fileName: asset.fileName,
              googleDriveId: asset.googleDriveId,
              assetOwner: asset.user.username,
              deletionType: 'permanent'
            })
          }
        });
      }

      return {
        success: true,
        assetTitle: asset.title,
        fileName: asset.fileName,
        googleDriveId: asset.googleDriveId
      };
    });
  }

  // Soft delete asset (keep in database but mark inactive)
  static async softDeleteAsset(assetId, adminId = null) {
    return await prisma.$transaction(async (tx) => {
      // Fetch asset information for logging
      const asset = await tx.asset.findUnique({
        where: { id: assetId },
        select: {
          id: true,
          title: true,
          isActive: true,
          user: {
            select: {
              username: true
            }
          }
        }
      });

      if (!asset) {
        throw new Error('Asset not found');
      }

      if (!asset.isActive) {
        throw new Error('Asset is already inactive');
      }

      // Soft delete by marking as inactive
      const updatedAsset = await tx.asset.update({
        where: { id: assetId },
        data: { isActive: false }
      });

      // Log the action if admin ID is provided
      if (adminId) {
        await tx.adminLog.create({
          data: {
            adminId,
            action: 'SOFT_DELETE_ASSET',
            targetType: 'asset',
            targetId: assetId,
            details: JSON.stringify({
              assetTitle: asset.title,
              assetOwner: asset.user.username,
              deletionType: 'soft'
            })
          }
        });
      }

      return updatedAsset;
    });
  }

  // Update asset approval status (admin action)
  static async updateAssetApproval(assetId, isApproved, adminId = null) {
    try {
      // Update asset approval status
      const updatedAsset = await prisma.asset.update({
        where: { id: assetId },
        data: { 
          isApproved: isApproved
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          },
          category: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      // Invalidate caches
      const AdvancedCacheService = require('./advancedCacheService');
      await AdvancedCacheService.invalidateAssetsCaches();

      // Log admin action if adminId provided
      if (adminId) {
        try {
          await prisma.adminLog.create({
            data: {
              adminId,
              action: isApproved ? 'APPROVE_ASSET' : 'REJECT_ASSET',
              targetType: 'asset',
              targetId: assetId,
              details: JSON.stringify({
                assetTitle: updatedAsset.title,
                assetOwner: updatedAsset.user.username,
                categoryName: updatedAsset.category.name
              })
            }
          });
        } catch (logError) {
          console.warn('Failed to log admin action:', logError);
          // Don't fail the approval if logging fails
        }
      }

      return convertBigIntToNumber(updatedAsset);
    } catch (error) {
      console.error('Update asset approval error:', error);
      throw error;
    }
  }
}

module.exports = AssetService;
module.exports.normalizeAssetUrls = normalizeAssetUrls;
module.exports.normalizeTags = normalizeTags;
module.exports.normalizeImageUrls = normalizeImageUrls;
