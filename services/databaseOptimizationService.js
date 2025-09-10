// Otimizações Avançadas de Database para Alto Tráfego
const AssetService = require('./assetService');
const CategoryService = require('./categoryService');
const UserService = require('./userService');

class DatabaseOptimizationService {
  // Query pré-compiladas para operações frequentes
  static preparedQueries = {};

  // Pagination otimizada com cursor para grandes datasets
  static async getAssetsPaginated({ 
    cursor, 
    limit = 20, 
    categoryId, 
    sortBy = 'createdAt',
    searchQuery,
    userId 
  }) {
    // Construir where clause dinamicamente
    const where = {
      isActive: true,
      isApproved: true,
      ...(categoryId && { categoryId: parseInt(categoryId) }),
      ...(userId && { userId }),
      ...(searchQuery && {
        OR: [
          { title: { contains: searchQuery, mode: 'insensitive' } },
          { description: { contains: searchQuery, mode: 'insensitive' } }
        ]
      })
    };

    // Usar cursor pagination para performance
    const queryOptions = {
      where,
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true }
        },
        category: {
          select: { id: true, name: true, slug: true }
        },
        _count: {
          select: {
            reviews: true,
            downloads: true,
            favorites: true
          }
        }
      },
      take: limit + 1, // +1 para verificar se há próxima página
      orderBy: this.getSortOrder(sortBy)
    };

    // Adicionar cursor se fornecido
    if (cursor) {
      queryOptions.cursor = { id: cursor };
      queryOptions.skip = 1; // Pular o cursor
    }

    const assets = await prisma.asset.findMany(queryOptions);
    
    // Verificar se há próxima página
    const hasNextPage = assets.length > limit;
    if (hasNextPage) {
      assets.pop(); // Remover o item extra
    }

    // Calcular rating médio em batch
    const assetIds = assets.map(a => a.id);
    const ratings = await this.getAverageRatingsBatch(assetIds);

    // Aplicar ratings aos assets
    const assetsWithRatings = assets.map(asset => ({
      ...asset,
      averageRating: ratings[asset.id] || 0,
      nextCursor: hasNextPage ? assets[assets.length - 1]?.id : null
    }));

    return {
      assets: assetsWithRatings,
      hasNextPage,
      nextCursor: hasNextPage ? assets[assets.length - 1]?.id : null
    };
  }

  // Batch processing para ratings
  static async getAverageRatingsBatch(assetIds) {
    if (!assetIds.length) return {};

    const ratings = await prisma.review.groupBy({
      by: ['assetId'],
      where: {
        assetId: { in: assetIds }
      },
      _avg: {
        rating: true
      }
    });

    // Converter para objeto hash para lookup rápido
    return ratings.reduce((acc, rating) => {
      acc[rating.assetId] = Math.round(rating._avg.rating * 10) / 10; // 1 decimal
      return acc;
    }, {});
  }

  // Query otimizada para homepage com minimal joins
  static async getHomepageData() {
    // Executar queries em paralelo usando os services existentes
    const [
      recentAssets,
      popularAssets,
      categories,
      stats
    ] = await Promise.all([
      // Recent assets - últimos 10
      AssetService.findAssets({ sortBy: 'createdAt', sortOrder: 'desc' }, { limit: 10 }),

      // Popular assets - top 10 por downloads  
      AssetService.findAssets({ sortBy: 'downloadCount', sortOrder: 'desc' }, { limit: 10 }),

      // Categories
      CategoryService.findAllCategories(),

      // Stats gerais
      AssetService.getStats()
    ]);

    return {
      recentAssets: recentAssets.assets || recentAssets,
      popularAssets: popularAssets.assets || popularAssets,
      categories,
      stats
    };
  }

  // Stats globais otimizadas
  static async getGlobalStats() {
    // Usar o service existente
    return await AssetService.getStats();
  }

  // Search otimizado com índices
  static async searchAssets({ query, filters, page = 1, limit = 20 }) {
    // Usar o service existente
    const searchFilters = {
      search: query,
      categoryId: filters.categoryId,
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      isApproved: true,
      isActive: true
    };

    return await AssetService.findAssets(searchFilters);
  }

  // User profile otimizado
  static async getUserProfile(userId) {
    // Usar services existentes
    try {
      const user = await UserService.findById(userId);
      const userAssets = await AssetService.findAssets({ 
        userId, 
        isActive: true 
      }, { limit: 20 });

      return {
        user,
        assets: userAssets.assets || userAssets,
        totalDownloadsReceived: 0 // TODO: implementar se necessário
      };
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      throw error;
    }
  }

  // Helpers para ordenação
  static getSortOrder(sortBy) {
    const sortMap = {
      'newest': { createdAt: 'desc' },
      'oldest': { createdAt: 'asc' },
      'popular': { downloadCount: 'desc' },
      'views': { viewCount: 'desc' },
      'rating': { 
        reviews: {
          _count: 'desc' // Ordenar por quantidade de reviews como proxy
        }
      },
      'name': { title: 'asc' }
    };

    return sortMap[sortBy] || sortMap.newest;
  }

  static getSearchOrderBy(query) {
    // Para busca, priorizar relevância (título exato primeiro)
    return [
      { title: { search: query } }, // Se suportar fulltext
      { downloadCount: 'desc' }, // Depois por popularidade
      { createdAt: 'desc' } // Depois por recência
    ];
  }

  // Análise de performance
  static async analyzeSlowQueries() {
    // Log de queries lentas (implementar com Prisma middleware)
    console.log('🔍 Analyzing database performance...');
    
    // Simular análise de queries mais comuns
    const commonQueries = [
      'Asset listing with pagination',
      'Search with filters',
      'User profile with assets',
      'Category assets',
      'Homepage data'
    ];

    return {
      analyzed: commonQueries.length,
      recommendations: [
        'Add index on (categoryId, isActive, isApproved)',
        'Add index on (userId, isActive)',
        'Add fulltext index on (title, description)',
        'Consider materialized view for stats',
        'Implement query result caching'
      ]
    };
  }
}

module.exports = DatabaseOptimizationService;
