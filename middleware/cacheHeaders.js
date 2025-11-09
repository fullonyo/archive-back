// Middleware de Cache HTTP para Assets e Dados Estáticos
const etag = require('etag');

class CacheHeadersMiddleware {
  // Cache agressivo para assets estáticos (imagens, arquivos)
  static staticAssets(req, res, next) {
    // Para downloads de assets (imagens, arquivos .vrca)
    if (req.path.includes('/download/') || req.path.includes('/image/')) {
      // Cache por 1 dia no browser, 7 dias no CDN
      res.set({
        'Cache-Control': 'public, max-age=86400, s-maxage=604800', // 1 dia browser, 7 dias CDN
        'Expires': new Date(Date.now() + 86400000).toUTCString(), // 1 dia
        'Vary': 'Accept-Encoding'
      });
    }
    next();
  }

  // Cache moderado para dados da API
  static apiData(minutes = 5) {
    return (req, res, next) => {
      // Cache para dados que mudam moderadamente
      res.set({
        'Cache-Control': `public, max-age=${minutes * 60}, must-revalidate`,
        'Vary': 'Accept-Encoding, Authorization'
      });
      next();
    };
  }

  // Cache com ETag para verificação inteligente
  static withETag(req, res, next) {
    const originalSend = res.send;
    
    res.send = function(data) {
      if (data && typeof data === 'object') {
        const tag = etag(JSON.stringify(data));
        res.set('ETag', tag);
        
        // Verificar If-None-Match
        if (req.get('If-None-Match') === tag) {
          return res.status(304).end();
        }
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  }

  // Cache específico para diferentes tipos de conteúdo
  static smartCache(req, res, next) {
    const path = req.path;
    
    // Assets list - cache curto
    if (path.includes('/api/assets')) {
      res.set('Cache-Control', 'public, max-age=180'); // 3 minutos
    }
    // Categorias - cache curto para real-time updates
    else if (path.includes('/api/categories')) {
      res.set('Cache-Control', 'public, max-age=120, must-revalidate'); // 2 minutos
    }
    // Usuário logado - sem cache
    else if (path.includes('/api/user/profile')) {
      res.set('Cache-Control', 'private, no-cache, must-revalidate');
    }
    // Stats globais - cache médio
    else if (path.includes('/api/stats')) {
      res.set('Cache-Control', 'public, max-age=300'); // 5 minutos
    }
    // Busca - cache curto
    else if (path.includes('/api/search')) {
      res.set('Cache-Control', 'public, max-age=120'); // 2 minutos
    }
    
    next();
  }

  // Conditional request handling
  static conditionalGet(req, res, next) {
    // Adicionar suporte a If-Modified-Since
    const originalJson = res.json;
    
    res.json = function(data) {
      if (data && data.length && Array.isArray(data)) {
        // Para arrays, usar o item mais recente como Last-Modified
        const lastModified = data
          .map(item => item.updatedAt || item.createdAt)
          .filter(Boolean)
          .sort((a, b) => new Date(b) - new Date(a))[0];
          
        if (lastModified) {
          const lastModifiedDate = new Date(lastModified).toUTCString();
          res.set('Last-Modified', lastModifiedDate);
          
          // Verificar If-Modified-Since
          const ifModifiedSince = req.get('If-Modified-Since');
          if (ifModifiedSince && new Date(ifModifiedSince) >= new Date(lastModified)) {
            return res.status(304).end();
          }
        }
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  }

  // Cache para API de thumbnails
  static thumbnailCache(req, res, next) {
    // Thumbnails têm cache muito agressivo
    res.set({
      'Cache-Control': 'public, max-age=2592000, immutable', // 30 dias
      'Expires': new Date(Date.now() + 2592000000).toUTCString(),
      'Vary': 'Accept-Encoding'
    });
    next();
  }

  // Disable cache para desenvolvimento
  static devNoCache(req, res, next) {
    if (process.env.NODE_ENV === 'development') {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
    }
    next();
  }
}

module.exports = CacheHeadersMiddleware;
