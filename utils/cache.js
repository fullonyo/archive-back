// Cache simples em memória para consultas frequentes
class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.timeouts = new Map();
  }

  set(key, value, ttlMs = 60000) { // 1 minuto por padrão
    // Limpar timeout anterior se existir
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
    }

    // Definir valor no cache
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });

    // Definir timeout para expiração
    const timeout = setTimeout(() => {
      this.cache.delete(key);
      this.timeouts.delete(key);
    }, ttlMs);

    this.timeouts.set(key, timeout);
  }

  get(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    return cached.value;
  }

  has(key) {
    return this.cache.has(key);
  }

  delete(key) {
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
      this.timeouts.delete(key);
    }
    return this.cache.delete(key);
  }

  clear() {
    // Limpar todos os timeouts
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    
    this.cache.clear();
    this.timeouts.clear();
  }

  size() {
    return this.cache.size;
  }

  // Gerar chave de cache baseada em parâmetros
  static generateKey(prefix, params) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    
    return `${prefix}:${sortedParams}`;
  }
}

// Instância global do cache
const cache = new SimpleCache();

module.exports = {
  cache,
  SimpleCache
};
