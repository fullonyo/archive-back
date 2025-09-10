// Redis Cache Service - Cache Distribuído para Produção
const redis = require('redis');
const NodeCache = require('node-cache');

class RedisCacheService {
  constructor() {
    this.isRedisEnabled = process.env.NODE_ENV === 'production' && process.env.REDIS_URL;
    this.fallbackCache = new NodeCache({ stdTTL: 600, maxKeys: 1000 });
    
    if (this.isRedisEnabled) {
      this.initRedis();
    } else {
      console.log('🔄 Redis not configured, using in-memory cache fallback');
    }
  }

  async initRedis() {
    try {
      // Configuração Redis para produção
      this.client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            console.error('🔴 Redis connection refused');
            return new Error('Redis connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            console.error('🔴 Redis retry time exhausted');
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            console.error('🔴 Redis max retries reached');
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.client.on('error', (err) => {
        console.error('🔴 Redis Client Error:', err);
        this.isRedisEnabled = false; // Fallback para in-memory
      });

      this.client.on('connect', () => {
        console.log('🟢 Redis connected successfully');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis ready for operations');
      });

      await this.client.connect();
    } catch (error) {
      console.error('❌ Redis initialization failed:', error);
      this.isRedisEnabled = false;
    }
  }

  // Método universal para get (Redis ou fallback)
  async get(key) {
    try {
      if (this.isRedisEnabled && this.client?.isReady) {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
      } else {
        // Fallback para cache em memória
        return this.fallbackCache.get(key) || null;
      }
    } catch (error) {
      console.error('❌ Cache get error:', error);
      // Fallback em caso de erro
      return this.fallbackCache.get(key) || null;
    }
  }

  // Método universal para set (Redis ou fallback)
  async set(key, value, ttlSeconds = 300) {
    try {
      const stringValue = JSON.stringify(value);
      
      if (this.isRedisEnabled && this.client?.isReady) {
        await this.client.setEx(key, ttlSeconds, stringValue);
      } else {
        // Fallback para cache em memória
        this.fallbackCache.set(key, value, ttlSeconds);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Cache set error:', error);
      // Fallback em caso de erro
      this.fallbackCache.set(key, value, ttlSeconds);
      return false;
    }
  }

  // Método para invalidar cache
  async del(key) {
    try {
      if (this.isRedisEnabled && this.client?.isReady) {
        await this.client.del(key);
      }
      this.fallbackCache.del(key);
      return true;
    } catch (error) {
      console.error('❌ Cache delete error:', error);
      this.fallbackCache.del(key);
      return false;
    }
  }

  // Invalidar múltiplas chaves por padrão
  async delPattern(pattern) {
    try {
      if (this.isRedisEnabled && this.client?.isReady) {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
      } else {
        // Para fallback, deletar chaves que coincidem com padrão
        const allKeys = this.fallbackCache.keys();
        const keysToDelete = allKeys.filter(key => 
          new RegExp(pattern.replace('*', '.*')).test(key)
        );
        keysToDelete.forEach(key => this.fallbackCache.del(key));
      }
      return true;
    } catch (error) {
      console.error('❌ Cache pattern delete error:', error);
      return false;
    }
  }

  // Método para verificar se uma chave existe
  async exists(key) {
    try {
      if (this.isRedisEnabled && this.client?.isReady) {
        return await this.client.exists(key) === 1;
      } else {
        return this.fallbackCache.has(key);
      }
    } catch (error) {
      console.error('❌ Cache exists error:', error);
      return this.fallbackCache.has(key);
    }
  }

  // Incrementar contador (útil para rate limiting)
  async incr(key, ttlSeconds = 3600) {
    try {
      if (this.isRedisEnabled && this.client?.isReady) {
        const value = await this.client.incr(key);
        if (value === 1) {
          await this.client.expire(key, ttlSeconds);
        }
        return value;
      } else {
        // Simular incremento no fallback
        const current = this.fallbackCache.get(key) || 0;
        const newValue = current + 1;
        this.fallbackCache.set(key, newValue, ttlSeconds);
        return newValue;
      }
    } catch (error) {
      console.error('❌ Cache increment error:', error);
      const current = this.fallbackCache.get(key) || 0;
      const newValue = current + 1;
      this.fallbackCache.set(key, newValue, ttlSeconds);
      return newValue;
    }
  }

  // Estatísticas do cache
  async getStats() {
    try {
      const stats = {
        type: this.isRedisEnabled ? 'Redis' : 'In-Memory',
        connected: this.isRedisEnabled ? this.client?.isReady : true
      };

      if (this.isRedisEnabled && this.client?.isReady) {
        const info = await this.client.info('memory');
        const keyspace = await this.client.info('keyspace');
        
        stats.memory = info;
        stats.keyspace = keyspace;
      } else {
        stats.keys = this.fallbackCache.keys().length;
        stats.stats = this.fallbackCache.getStats();
      }

      return stats;
    } catch (error) {
      console.error('❌ Cache stats error:', error);
      return {
        type: 'In-Memory (fallback)',
        keys: this.fallbackCache.keys().length,
        error: error.message
      };
    }
  }

  // Flush all cache
  async flushAll() {
    try {
      if (this.isRedisEnabled && this.client?.isReady) {
        await this.client.flushAll();
      }
      this.fallbackCache.flushAll();
      console.log('🧹 All cache cleared');
      return true;
    } catch (error) {
      console.error('❌ Cache flush error:', error);
      this.fallbackCache.flushAll();
      return false;
    }
  }

  // Método para cache com callback (padrão Redis)
  async getOrSet(key, fetchFunction, ttlSeconds = 300) {
    try {
      // Tentar buscar do cache primeiro
      let cached = await this.get(key);
      if (cached !== null) {
        return { data: cached, cached: true };
      }

      // Se não está em cache, executar função e cachear resultado
      const result = await fetchFunction();
      await this.set(key, result, ttlSeconds);
      
      return { data: result, cached: false };
    } catch (error) {
      console.error('❌ Cache getOrSet error:', error);
      // Em caso de erro, executar função sem cache
      const result = await fetchFunction();
      return { data: result, cached: false, error: error.message };
    }
  }

  // Fechar conexão Redis
  async disconnect() {
    if (this.isRedisEnabled && this.client) {
      try {
        await this.client.disconnect();
        console.log('👋 Redis disconnected');
      } catch (error) {
        console.error('❌ Redis disconnect error:', error);
      }
    }
  }

  // Health check
  async healthCheck() {
    try {
      if (this.isRedisEnabled && this.client?.isReady) {
        await this.client.ping();
        return { status: 'healthy', type: 'Redis' };
      } else {
        return { status: 'healthy', type: 'In-Memory' };
      }
    } catch (error) {
      return { status: 'unhealthy', type: 'Redis', error: error.message };
    }
  }
}

// Instância singleton
const redisCacheService = new RedisCacheService();

module.exports = redisCacheService;
