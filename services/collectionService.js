const { prisma } = require('../config/prisma');
const AdvancedCacheService = require('./advancedCacheService');

/**
 * Helper function to convert BigInt to Number recursively
 */
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

/**
 * Collection Service
 * Gerencia coleções pessoais de assets
 */

class CollectionService {
  /**
   * Criar nova coleção
   */
  static async createCollection(userId, data) {
    const { name, description, emoji, visibility = 'PRIVATE' } = data;

    if (!name || name.trim().length === 0) {
      throw new Error('Collection name is required');
    }

    if (name.length > 100) {
      throw new Error('Collection name must be less than 100 characters');
    }

    const collection = await prisma.collection.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        emoji: emoji || '📌',
        visibility,
        userId,
        assetCount: 0
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

    // Invalidar cache do usuário
    await AdvancedCacheService.invalidateCollectionsCache(userId);

    return collection;
  }

  /**
   * Listar coleções do usuário
   */
  static async getUserCollections(userId, options = {}) {
    const { page = 1, limit = 20, sortBy = 'newest' } = options;
    const skip = (page - 1) * limit;

    // Sort options
    let orderBy = {};
    switch (sortBy) {
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'name':
        orderBy = { name: 'asc' };
        break;
      case 'assets':
        orderBy = { assetCount: 'desc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [collections, total] = await Promise.all([
      prisma.collection.findMany({
        where: { userId },
        include: {
          items: {
            take: 4, // Para preview (cover grid 2x2)
            orderBy: { addedAt: 'desc' },
            include: {
              asset: {
                select: {
                  id: true,
                  title: true,
                  thumbnailUrl: true,
                  imageUrls: true
                }
              }
            }
          }
        },
        orderBy,
        skip,
        take: limit
      }),
      prisma.collection.count({
        where: { userId }
      })
    ]);

    // Transform para incluir preview covers
    const transformedCollections = collections.map(collection => ({
      ...collection,
      coverPreviews: collection.items.map(item => {
        const thumbnail = item.asset.thumbnailUrl || 
                         (item.asset.imageUrls ? JSON.parse(item.asset.imageUrls)[0] : null);
        return thumbnail;
      }).filter(Boolean)
    }));

    return {
      collections: transformedCollections,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Buscar coleção por ID
   */
  static async getCollectionById(collectionId, userId) {
    const collection = await prisma.collection.findFirst({
      where: {
        id: collectionId,
        userId // Só pode ver suas próprias coleções
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true
          }
        },
        items: {
          orderBy: { order: 'asc' },
          include: {
            asset: {
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
                    name: true
                  }
                },
                _count: {
                  select: {
                    downloads: true,
                    favorites: true,
                    reviews: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!collection) {
      throw new Error('Collection not found or access denied');
    }

    // Transform assets para formato padrão
    const transformedItems = collection.items.map(item => {
      const asset = item.asset;
      
      return {
        ...item,
        asset: {
          ...convertBigIntToNumber(asset),
          likes: asset._count?.favorites || 0,
          downloads: asset._count?.downloads || 0,
          comments: asset._count?.reviews || 0,
          tags: asset.tags ? JSON.parse(asset.tags) : [],
          imageUrls: asset.imageUrls ? JSON.parse(asset.imageUrls) : []
        }
      };
    });

    return {
      ...collection,
      items: transformedItems
    };
  }

  /**
   * Atualizar coleção
   */
  static async updateCollection(collectionId, userId, data) {
    const { name, description, emoji, visibility } = data;

    // Verificar ownership
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, userId }
    });

    if (!collection) {
      throw new Error('Collection not found or access denied');
    }

    const updateData = {};
    if (name !== undefined) {
      if (!name.trim()) {
        throw new Error('Collection name cannot be empty');
      }
      updateData.name = name.trim();
    }
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (emoji !== undefined) updateData.emoji = emoji || '📌';
    if (visibility !== undefined) updateData.visibility = visibility;

    const updated = await prisma.collection.update({
      where: { id: collectionId },
      data: updateData,
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

    // Invalidar cache
    await AdvancedCacheService.invalidateCollectionsCache(userId);

    return updated;
  }

  /**
   * Deletar coleção
   */
  static async deleteCollection(collectionId, userId) {
    // Verificar ownership
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, userId }
    });

    if (!collection) {
      throw new Error('Collection not found or access denied');
    }

    await prisma.collection.delete({
      where: { id: collectionId }
    });

    // Invalidar cache
    await AdvancedCacheService.invalidateCollectionsCache(userId);

    return { success: true, message: 'Collection deleted successfully' };
  }

  /**
   * Adicionar asset à coleção
   */
  static async addAssetToCollection(collectionId, assetId, userId) {
    // Verificar ownership da coleção
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, userId }
    });

    if (!collection) {
      throw new Error('Collection not found or access denied');
    }

    // Verificar se asset existe
    const asset = await prisma.asset.findUnique({
      where: { id: assetId }
    });

    if (!asset) {
      throw new Error('Asset not found');
    }

    // Verificar se já está na coleção
    const existingItem = await prisma.collectionItem.findUnique({
      where: {
        collectionId_assetId: {
          collectionId,
          assetId
        }
      }
    });

    if (existingItem) {
      throw new Error('Asset already in collection');
    }

    // Adicionar item
    const item = await prisma.collectionItem.create({
      data: {
        collectionId,
        assetId,
        order: 0 // Adiciona no início
      }
    });

    // Atualizar contador
    await prisma.collection.update({
      where: { id: collectionId },
      data: {
        assetCount: { increment: 1 }
      }
    });

    // Invalidar cache
    await AdvancedCacheService.invalidateCollectionsCache(userId);

    return item;
  }

  /**
   * Remover asset da coleção
   */
  static async removeAssetFromCollection(collectionId, assetId, userId) {
    // Verificar ownership da coleção
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, userId }
    });

    if (!collection) {
      throw new Error('Collection not found or access denied');
    }

    // Verificar se item existe
    const item = await prisma.collectionItem.findUnique({
      where: {
        collectionId_assetId: {
          collectionId,
          assetId
        }
      }
    });

    if (!item) {
      throw new Error('Asset not in collection');
    }

    // Remover item
    await prisma.collectionItem.delete({
      where: {
        collectionId_assetId: {
          collectionId,
          assetId
        }
      }
    });

    // Atualizar contador
    await prisma.collection.update({
      where: { id: collectionId },
      data: {
        assetCount: { decrement: 1 }
      }
    });

    // Invalidar cache
    await AdvancedCacheService.invalidateCollectionsCache(userId);

    return { success: true, message: 'Asset removed from collection' };
  }

  /**
   * Reordenar items da coleção
   */
  static async reorderCollectionItems(collectionId, userId, itemOrders) {
    // Verificar ownership
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, userId }
    });

    if (!collection) {
      throw new Error('Collection not found or access denied');
    }

    // itemOrders = [{ id: 1, order: 0 }, { id: 2, order: 1 }, ...]
    const updatePromises = itemOrders.map(({ id, order }) =>
      prisma.collectionItem.update({
        where: { id },
        data: { order }
      })
    );

    await Promise.all(updatePromises);

    return { success: true, message: 'Collection items reordered' };
  }

  /**
   * Verificar se asset está em alguma coleção do usuário
   */
  static async getAssetCollections(assetId, userId) {
    const collections = await prisma.collection.findMany({
      where: {
        userId,
        items: {
          some: {
            assetId
          }
        }
      },
      select: {
        id: true,
        name: true,
        emoji: true
      }
    });

    return collections;
  }

  /**
   * Buscar coleções do usuário (para modal "Save to Collection")
   */
  static async searchUserCollections(userId, query = '', assetId = null) {
    const collections = await prisma.collection.findMany({
      where: {
        userId,
        ...(query && {
          name: {
            contains: query
          }
        })
      },
      select: {
        id: true,
        name: true,
        emoji: true,
        visibility: true,
        assetCount: true,
        items: assetId ? {
          where: { assetId },
          select: { id: true }
        } : false
      },
      orderBy: {
        name: 'asc'
      },
      take: 20
    });

    // Adicionar flag "isSelected" se assetId foi fornecido
    if (assetId) {
      return collections.map(col => ({
        ...col,
        isSelected: col.items && col.items.length > 0,
        items: undefined // Remover do resultado
      }));
    }

    return collections;
  }
}

module.exports = CollectionService;
