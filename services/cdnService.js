// CDN Simulation - Preparação para CDN real
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class CDNService {
  constructor() {
    this.localCDNPath = path.join(__dirname, '../cdn-cache');
    this.baseUrl = process.env.CDN_BASE_URL || '/cdn';
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.localCDNPath, { recursive: true });
      await fs.mkdir(path.join(this.localCDNPath, 'images'), { recursive: true });
      await fs.mkdir(path.join(this.localCDNPath, 'assets'), { recursive: true });
      await fs.mkdir(path.join(this.localCDNPath, 'thumbnails'), { recursive: true });
    } catch (error) {
      console.error('CDN Init error:', error);
    }
  }

  // Gerar URL de CDN para assets
  generateCDNUrl(assetId, type = 'image', size = 'original') {
    const hash = crypto.createHash('md5').update(`${assetId}-${type}-${size}`).digest('hex');
    
    // URL que simula CDN real
    return `${this.baseUrl}/${type}/${size}/${assetId}/${hash}`;
  }

  // Cache de imagens populares localmente (simula CDN edge)
  async cachePopularImages() {
    try {
      // Buscar top 50 assets mais baixados
      const popularAssets = await prisma.asset.findMany({
        where: { 
          isActive: true, 
          isApproved: true,
          thumbnailUrl: { not: null }
        },
        orderBy: { downloadCount: 'desc' },
        take: 50,
        select: { id: true, thumbnailUrl: true, title: true }
      });

      console.log(`🔥 Pre-caching ${popularAssets.length} popular images...`);

      for (const asset of popularAssets) {
        await this.cacheImageLocally(asset.id, asset.thumbnailUrl);
      }

      console.log('✅ Popular images cached successfully');
    } catch (error) {
      console.error('❌ Error caching popular images:', error);
    }
  }

  async cacheImageLocally(assetId, imageUrl) {
    try {
      if (!imageUrl || !imageUrl.startsWith('http')) return;

      const response = await fetch(imageUrl);
      if (!response.ok) return;

      const buffer = await response.arrayBuffer();
      const filename = `${assetId}.jpg`;
      const localPath = path.join(this.localCDNPath, 'images', filename);

      await fs.writeFile(localPath, Buffer.from(buffer));
      console.log(`✅ Cached image for asset ${assetId}`);
    } catch (error) {
      console.error(`❌ Error caching image for asset ${assetId}:`, error);
    }
  }

  // Servir imagens do cache local
  async serveLocalImage(assetId, size = 'original') {
    try {
      const filename = `${assetId}.jpg`;
      const imagePath = path.join(this.localCDNPath, 'images', filename);
      
      // Verificar se existe localmente
      const exists = await fs.access(imagePath).then(() => true).catch(() => false);
      
      if (exists) {
        return {
          path: imagePath,
          url: `/cdn/images/${filename}`,
          cached: true
        };
      }

      return null;
    } catch (error) {
      console.error('Error serving local image:', error);
      return null;
    }
  }

  // Estatísticas do cache local
  async getCacheStats() {
    try {
      const imagesDir = path.join(this.localCDNPath, 'images');
      const files = await fs.readdir(imagesDir);
      
      let totalSize = 0;
      for (const file of files) {
        const stats = await fs.stat(path.join(imagesDir, file));
        totalSize += stats.size;
      }

      return {
        totalFiles: files.length,
        totalSizeBytes: totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
      };
    } catch (error) {
      return { totalFiles: 0, totalSizeBytes: 0, totalSizeMB: '0' };
    }
  }

  // Limpeza do cache local
  async cleanupOldCache(maxAgeDays = 7) {
    try {
      const imagesDir = path.join(this.localCDNPath, 'images');
      const files = await fs.readdir(imagesDir);
      const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
      
      let deletedFiles = 0;
      
      for (const file of files) {
        const filePath = path.join(imagesDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          deletedFiles++;
        }
      }

      console.log(`🧹 Cleaned up ${deletedFiles} old cached files`);
      return deletedFiles;
    } catch (error) {
      console.error('Error cleaning up cache:', error);
      return 0;
    }
  }

  // Preparar URLs para CDN real (Cloudflare, AWS CloudFront, etc.)
  prepareCDNUrls(assets) {
    return assets.map(asset => {
      if (asset.thumbnailUrl || asset.imageUrls) {
        // Simular transformações de CDN
        asset.cdnUrls = {
          original: this.generateCDNUrl(asset.id, 'image', 'original'),
          thumbnail: this.generateCDNUrl(asset.id, 'image', 'thumbnail'),
          small: this.generateCDNUrl(asset.id, 'image', 'small'),
          medium: this.generateCDNUrl(asset.id, 'image', 'medium'),
          webp: this.generateCDNUrl(asset.id, 'image', 'webp'),
          avif: this.generateCDNUrl(asset.id, 'image', 'avif')
        };
      }
      return asset;
    });
  }

  // Invalidar cache do CDN (para quando implementar CDN real)
  async invalidateCDNCache(assetIds) {
    console.log(`🔄 Would invalidate CDN cache for assets: ${assetIds.join(', ')}`);
    
    // Para desenvolvimento, remover do cache local
    for (const assetId of assetIds) {
      try {
        const filename = `${assetId}.jpg`;
        const imagePath = path.join(this.localCDNPath, 'images', filename);
        await fs.unlink(imagePath).catch(() => {}); // Ignorar se não existir
      } catch (error) {
        console.error(`Error invalidating local cache for asset ${assetId}:`, error);
      }
    }
  }
}

// Instância singleton
const cdnService = new CDNService();

module.exports = cdnService;
