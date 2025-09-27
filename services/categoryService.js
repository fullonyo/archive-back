const { prisma } = require('../config/prisma');

/**
 * Category Service - Operações relacionadas a categorias de assets
 */
class CategoryService {
  // Buscar todas as categorias ativas
  static async findAllCategories() {
    return await prisma.assetCategory.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            assets: {
              where: {
                isActive: true,
                isApproved: true
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  // Buscar categoria por ID
  static async findCategoryById(id) {
    return await prisma.assetCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            assets: {
              where: {
                isActive: true,
                isApproved: true
              }
            }
          }
        }
      }
    });
  }

  // Buscar categoria por nome
  static async findCategoryByName(name) {
    return await prisma.assetCategory.findUnique({
      where: { name }
    });
  }

  // Criar nova categoria
  static async createCategory(categoryData) {
    try {
      return await prisma.assetCategory.create({
        data: categoryData
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new Error('Category with this name already exists');
      }
      throw error;
    }
  }

  // Atualizar categoria
  static async updateCategory(id, updateData) {
    try {
      return await prisma.assetCategory.update({
        where: { id },
        data: updateData
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new Error('Category not found');
      }
      if (error.code === 'P2002') {
        throw new Error('Category with this name already exists');
      }
      throw error;
    }
  }

  // Soft delete categoria
  static async deactivateCategory(id, adminId) {
    return await prisma.$transaction(async (tx) => {
      // Verificar se categoria existe
      const category = await tx.assetCategory.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              assets: { where: { isActive: true } }
            }
          }
        }
      });

      if (!category) {
        throw new Error('Category not found');
      }

      // Desativar categoria
      const updatedCategory = await tx.assetCategory.update({
        where: { id },
        data: { isActive: false }
      });

      // Registrar log admin
      await tx.adminLog.create({
        data: {
          adminId,
          action: 'DEACTIVATE_CATEGORY',
          targetType: 'category',
          targetId: id,
          details: {
            categoryName: category.name,
            assetsCount: category._count.assets
          }
        }
      });

      return updatedCategory;
    });
  }

  // Reativar categoria
  static async activateCategory(id, adminId) {
    return await prisma.$transaction(async (tx) => {
      // Verificar se categoria existe
      const category = await tx.assetCategory.findUnique({
        where: { id }
      });

      if (!category) {
        throw new Error('Category not found');
      }

      // Reativar categoria
      const updatedCategory = await tx.assetCategory.update({
        where: { id },
        data: { isActive: true }
      });

      // Registrar log admin
      await tx.adminLog.create({
        data: {
          adminId,
          action: 'ACTIVATE_CATEGORY',
          targetType: 'category',
          targetId: id,
          details: {
            categoryName: category.name
          }
        }
      });

      return updatedCategory;
    });
  }

  // Buscar categorias com paginação (para admin)
  static async findCategoriesWithPagination({
    page = 1,
    limit = 20,
    includeInactive = false
  }) {
    const skip = (page - 1) * limit;
    
    const where = includeInactive ? {} : { isActive: true };

    const [categories, total] = await Promise.all([
      prisma.assetCategory.findMany({
        where,
        include: {
          _count: {
            select: {
              assets: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.assetCategory.count({ where })
    ]);

    return {
      categories,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Estatísticas da categoria
  static async getCategoryStats(categoryId) {
    const category = await prisma.assetCategory.findUnique({
      where: { id: categoryId },
      include: {
        assets: {
          where: { isActive: true },
          select: {
            isApproved: true,
            downloadCount: true,
            createdAt: true
          }
        }
      }
    });

    if (!category) {
      throw new Error('Category not found');
    }

    const totalAssets = category.assets.length;
    const approvedAssets = category.assets.filter(asset => asset.isApproved).length;
    const pendingAssets = totalAssets - approvedAssets;
    const totalDownloads = category.assets.reduce((sum, asset) => sum + asset.downloadCount, 0);
    
    // Assets dos últimos 30 dias
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentAssets = category.assets.filter(asset => 
      new Date(asset.createdAt) >= thirtyDaysAgo
    ).length;

    return {
      categoryName: category.name,
      totalAssets,
      approvedAssets,
      pendingAssets,
      totalDownloads,
      recentAssets
    };
  }

  // Assets mais populares por categoria
  static async getPopularAssetsByCategory(categoryId, limit = 10) {
    return await prisma.asset.findMany({
      where: {
        categoryId,
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
        _count: {
          select: {
            downloads: true,
            favorites: true
          }
        }
      },
      orderBy: { downloadCount: 'desc' },
      take: limit
    });
  }

  // Validar nome único de categoria
  static async isNameUnique(name, excludeId = null) {
    const where = { name };
    if (excludeId) {
      where.NOT = { id: excludeId };
    }

    const existing = await prisma.assetCategory.findFirst({
      where,
      select: { id: true }
    });

    return !existing;
  }

  // Seed categorias padrão
  static async seedDefaultCategories() {
    const defaultCategories = [
      {
        name: 'avatar',
        description: 'Complete avatar packages and models',
        icon: 'user'
      },
      {
        name: 'clothing',
        description: 'Clothing and fashion accessories',
        icon: 'shirt'
      },
      {
        name: 'accessory',
        description: 'Hair, jewelry, and other accessories',
        icon: 'star'
      },
      {
        name: 'world',
        description: 'Virtual world environments and scenes',
        icon: 'globe'
      },
      {
        name: 'props',
        description: 'Props, furniture, and decorative objects',
        icon: 'cube'
      },
      {
        name: 'tools-systems',
        description: 'Tools and Systems for development and utilities',
        icon: 'wrench-screwdriver'
      }
    ];

    const results = [];
    
    for (const category of defaultCategories) {
      const existing = await this.findCategoryByName(category.name);
      
      if (!existing) {
        const created = await this.createCategory(category);
        results.push(created);
      } else {
        results.push(existing);
      }
    }

    return results;
  }
}

module.exports = CategoryService;
