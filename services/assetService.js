const { prisma } = require('../config/prisma');

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
  static async findAssetById(id, includeInactive = false) {
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
      asset.tags = normalizeTags(asset.tags); // Normalize tags to always be an array
      asset.imageUrls = normalizeImageUrls(asset.imageUrls); // Normalize imageUrls to always be an array
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
    if (sortBy === 'newest') {
      orderByField = 'createdAt';
      orderByDirection = 'desc';
    } else if (sortBy === 'oldest') {
      orderByField = 'createdAt';
      orderByDirection = 'asc';
    } else if (sortBy === 'popular' || sortBy === 'downloads') {
      orderByField = 'downloadCount';
      orderByDirection = 'desc';
    } else if (sortBy === 'name') {
      orderByField = 'title';
      orderByDirection = 'asc';
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

    // Segunda consulta: buscar ratings de todos os assets de uma vez (otimização)
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
    const reviewsMap = new Map();
    reviewsData.forEach(review => {
      reviewsMap.set(review.assetId, {
        averageRating: Number((review._avg.rating || 0).toFixed(2)),
        reviewCount: review._count.rating
      });
    });

    // Combinar dados dos assets com reviews
    const assetsWithRating = assets.map(asset => ({
      ...asset,
      tags: normalizeTags(asset.tags),
      imageUrls: normalizeImageUrls(asset.imageUrls),
      averageRating: reviewsMap.get(asset.id)?.averageRating || 0,
      reviewCount: reviewsMap.get(asset.id)?.reviewCount || 0
    }));

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
}

module.exports = AssetService;
