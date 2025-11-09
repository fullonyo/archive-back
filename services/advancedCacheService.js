// Cache Avançado para Dados Críticos
const NodeCache = require('node-cache');
const { cache } = require('../utils/cache');
const AssetService = require('./assetService');
const CategoryService = require('./categoryService');
const UserService = require('./userService');
const redisCacheService = require('./redisCacheService');

// Caches especializados por tipo de dado
const caches = {
  assets: new NodeCache({ stdTTL: 300, maxKeys: 1000 }), // 5 minutos
  categories: new NodeCache({ stdTTL: 1800, maxKeys: 100 }), // 30 minutos (mudam pouco)
  users: new NodeCache({ stdTTL: 600, maxKeys: 500 }), // 10 minutos
  stats: new NodeCache({ stdTTL: 300, maxKeys: 50 }), // 5 minutos
  search: new NodeCache({ stdTTL: 180, maxKeys: 200 }) // 3 minutos (busca muda rápido)
};

class AdvancedCacheService {
  // Cache inteligente para listas de assets com invalidação por tags
  static async getCachedAssets(filters, cacheKey) {
    try {
      // Usar Redis cache primeiro, fallback para in-memory
      const cachedResult = await redisCacheService.getOrSet(
        cacheKey,
        async () => {
          // Se não está em cache, buscar do banco
          return await AssetService.findAssets(filters);
        },
        this.getTTLForFilters(filters)
      );

      return {
        ...cachedResult.data,
        cached: cachedResult.cached,
        source: cachedResult.cached ? 'cache' : 'database'
      };
    } catch (error) {
      console.error('Error in getCachedAssets:', error);
      // Fallback direto para database
      const result = await AssetService.findAssets(filters);
      return { ...result, cached: false, source: 'database-fallback' };
    }
  }

  // Determinar TTL baseado no tipo de consulta
  static getTTLForFilters(filters) {
    let ttl = 300; // 5 minutos padrão
    
    if (filters.categoryId) ttl = 600; // 10 min para categoria específica
    if (filters.searchQuery) ttl = 180; // 3 min para busca
    if (filters.sortBy === 'newest') ttl = 120; // 2 min para "mais novos"
    if (filters.collections) ttl = 300; // 5 min para coleções
    
    return ttl;
  }

  // Cache para categorias (dados que mudam pouco)
  static async getCachedCategories() {
    const cacheKey = 'all_categories';
    
    try {
      const cachedResult = await redisCacheService.getOrSet(
        cacheKey,
        async () => await CategoryService.findAllCategories(),
        1800 // 30 minutos
      );

      return cachedResult.data;
    } catch (error) {
      console.error('Error in getCachedCategories:', error);
      // Fallback direto
      return await CategoryService.findAllCategories();
    }
  }

  // Cache para estatísticas globais
  static async getCachedStats() {
    const cacheKey = 'global_stats';
    
    try {
      const cachedResult = await redisCacheService.getOrSet(
        cacheKey,
        async () => await this.calculateStats(),
        300 // 5 minutos
      );

      return cachedResult.data;
    } catch (error) {
      console.error('Error in getCachedStats:', error);
      // Fallback direto
      return await this.calculateStats();
    }
  }

  static async calculateStats() {
    // Usar o service existente
    return await AssetService.getStats();
  }

  // Cache para top uploaders (dados custosos)
  static async getCachedTopUploaders(limit = 5) {
    const cacheKey = `top_uploaders_${limit}`;
    
    let cached = caches.users.get(cacheKey);
    if (cached) return cached;

    // Por enquanto, retornar array vazio - implementar quando necessário
    const topUploaders = [];

    // Cache por 10 minutos
    caches.users.set(cacheKey, topUploaders, 600);
    
    return topUploaders;
  }

  // Cache para busca com autocomplete
  static async getCachedSearchSuggestions(query) {
    const cacheKey = `search_${query.toLowerCase()}`;
    
    let cached = caches.search.get(cacheKey);
    if (cached) return cached;

    // Usar o service de busca existente
    try {
      const searchResults = await AssetService.findAssets({ 
        search: query,
        isActive: true,
        isApproved: true
      }, { limit: 10 });

      const titles = searchResults.assets?.map(asset => asset.title) || [];
      
      // Cache por 3 minutos (busca muda rápido)
      caches.search.set(cacheKey, titles, 180);
      
      return titles;
    } catch (error) {
      console.error('Error in search suggestions:', error);
      return [];
    }
  }

  // Invalidação inteligente de cache
  static async invalidateAssetsCaches() {
    if (process.env.NODE_ENV === 'development') {
      console.log('🧹 Invalidating assets caches...');
    }
    
    try {
      // Invalidar no Redis por padrão
      await redisCacheService.delPattern('assets_*');
      await redisCacheService.delPattern('recent_assets_*');
      await redisCacheService.del('global_stats');
      
      // Fallback para in-memory
      caches.assets.flushAll();
      caches.stats.flushAll();
      caches.search.flushAll();
    } catch (error) {
      console.error('Error invalidating assets cache:', error);
      // Fallback apenas
      caches.assets.flushAll();
      caches.stats.flushAll();
      caches.search.flushAll();
    }
  }

  static async invalidateCategoriesCache() {
    if (process.env.NODE_ENV === 'development') {
      console.log('🧹 Invalidating categories cache...');
    }
    
    try {
      await redisCacheService.del('all_categories');
      caches.categories.flushAll();
    } catch (error) {
      console.error('Error invalidating categories cache:', error);
      caches.categories.flushAll();
    }
  }

  static async invalidateUsersCaches() {
    if (process.env.NODE_ENV === 'development') {
      console.log('🧹 Invalidating users caches...');
    }
    
    try {
      await redisCacheService.delPattern('top_uploaders_*');
      await redisCacheService.del('global_stats');
      
      caches.users.flushAll();
      caches.stats.flushAll();
    } catch (error) {
      console.error('Error invalidating users cache:', error);
      caches.users.flushAll();
      caches.stats.flushAll();
    }
  }

  // Invalidar cache de coleções de um usuário
  static async invalidateCollectionsCache(userId) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🧹 Invalidating collections cache for user ${userId}...`);
    }
    
    try {
      // Invalidar cache de listagem de coleções do usuário
      await redisCacheService.delPattern(`collections_user_${userId}_*`);
      // Invalidar cache de busca de coleções
      await redisCacheService.delPattern(`collections_search_${userId}_*`);
      // Invalidar cache de asset collections
      await redisCacheService.delPattern(`asset_collections_*`);
      
      // In-memory fallback
      caches.users.del(`collections_user_${userId}`);
    } catch (error) {
      console.error('Error invalidating collections cache:', error);
      caches.users.flushAll();
    }
  }

  // Warming up do cache na inicialização (otimizado para menos conexões)
  static async warmUpCache() {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔥 Warming up cache (optimized)...');
    }
    
    try {
      // Pre-carregar apenas dados essenciais, um de cada vez para evitar sobrecarga
      if (process.env.NODE_ENV === 'development') {
        console.log('📂 Loading categories...');
      }
      await this.getCachedCategories();
      
      // Pequena pausa entre operações
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Loading basic stats...');
      }
      await this.getCachedStats();
      
      // O resto será carregado sob demanda
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Essential cache warmed up successfully');
        console.log('💡 Additional data will be cached on-demand');
      }
      
    } catch (error) {
      console.error('❌ Cache warm up failed:', error);
    }
  }

  // Estatísticas do cache
  static async getCacheStats() {
    try {
      const redisStats = await redisCacheService.getStats();
      const inMemoryStats = {
        assets: { keys: caches.assets.keys().length, stats: caches.assets.getStats() },
        categories: { keys: caches.categories.keys().length, stats: caches.categories.getStats() },
        users: { keys: caches.users.keys().length, stats: caches.users.getStats() },
        stats: { keys: caches.stats.keys().length, stats: caches.stats.getStats() },
        search: { keys: caches.search.keys().length, stats: caches.search.getStats() }
      };

      return {
        redis: redisStats,
        inMemory: inMemoryStats,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        redis: { error: error.message },
        inMemory: {
          assets: { keys: caches.assets.keys().length },
          categories: { keys: caches.categories.keys().length },
          users: { keys: caches.users.keys().length },
          stats: { keys: caches.stats.keys().length },
          search: { keys: caches.search.keys().length }
        },
        timestamp: new Date()
      };
    }
  }
}

module.exports = AdvancedCacheService;
