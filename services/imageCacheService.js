// Sistema de Cache para Imagens - CRÍTICO para performance
const NodeCache = require('node-cache');
const sharp = require('sharp'); // Para otimização de imagens

// Cache específico para imagens (TTL mais longo)
const imageCache = new NodeCache({ 
  stdTTL: 3600, // 1 hora
  maxKeys: 1000, // Máximo 1000 imagens em cache
  useClones: false 
});

// Cache para thumbnails otimizados
const thumbnailCache = new NodeCache({ 
  stdTTL: 7200, // 2 horas (thumbnails mudam menos)
  maxKeys: 2000 
});

class ImageCacheService {
  // Cache inteligente para imagens com redimensionamento
  static async getOptimizedImage(imageUrl, width = null, height = null, quality = 80) {
    const cacheKey = `img_${imageUrl}_${width}x${height}_q${quality}`;
    
    // Verificar cache primeiro
    let cachedImage = imageCache.get(cacheKey);
    if (cachedImage) {
      return cachedImage;
    }

    try {
      // Se não está em cache, processar imagem
      const response = await fetch(imageUrl);
      const buffer = await response.buffer();
      
      let processedImage = sharp(buffer);
      
      // Redimensionar se especificado
      if (width || height) {
        processedImage = processedImage.resize(width, height, {
          fit: 'cover',
          withoutEnlargement: true
        });
      }
      
      // Otimizar qualidade
      const optimizedBuffer = await processedImage
        .jpeg({ quality, progressive: true })
        .toBuffer();
      
      const result = {
        buffer: optimizedBuffer,
        contentType: 'image/jpeg',
        size: optimizedBuffer.length,
        cached: false
      };
      
      // Armazenar no cache
      imageCache.set(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Image optimization error:', error);
      // Fallback para imagem original
      return { error: 'Failed to optimize image' };
    }
  }

  // Cache para thumbnails com múltiplos tamanhos
  static async getThumbnails(imageUrl) {
    const thumbnailKey = `thumb_${imageUrl}`;
    
    let cached = thumbnailCache.get(thumbnailKey);
    if (cached) return cached;

    // Gerar múltiplos tamanhos
    const sizes = [
      { name: 'small', width: 150, height: 150 },
      { name: 'medium', width: 300, height: 300 },
      { name: 'large', width: 600, height: 600 }
    ];

    const thumbnails = {};
    
    for (const size of sizes) {
      try {
        const optimized = await this.getOptimizedImage(
          imageUrl, 
          size.width, 
          size.height, 
          75 // Qualidade menor para thumbnails
        );
        
        if (!optimized.error) {
          thumbnails[size.name] = {
            buffer: optimized.buffer,
            width: size.width,
            height: size.height,
            size: optimized.size
          };
        }
      } catch (error) {
        console.error(`Thumbnail generation failed for ${size.name}:`, error);
      }
    }

    thumbnailCache.set(thumbnailKey, thumbnails);
    return thumbnails;
  }

  // Pré-carregar imagens populares
  static async preloadPopularImages() {
    try {
      // Buscar assets mais acessados
      const popularAssets = await prisma.asset.findMany({
        where: { isActive: true, isApproved: true },
        orderBy: { downloadCount: 'desc' },
        take: 50, // Top 50 assets
        select: { thumbnailUrl: true, imageUrls: true }
      });

      console.log('Pre-loading popular images...');
      
      for (const asset of popularAssets) {
        // Pré-carregar thumbnail
        if (asset.thumbnailUrl) {
          await this.getThumbnails(asset.thumbnailUrl);
        }
        
        // Pré-carregar primeiras imagens
        if (asset.imageUrls && Array.isArray(asset.imageUrls)) {
          for (let i = 0; i < Math.min(2, asset.imageUrls.length); i++) {
            await this.getThumbnails(asset.imageUrls[i]);
          }
        }
      }
      
      console.log('✅ Popular images pre-loaded');
    } catch (error) {
      console.error('Pre-loading failed:', error);
    }
  }
}

module.exports = ImageCacheService;
