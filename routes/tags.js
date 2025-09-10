const express = require('express');
const { PrismaClient } = require('@prisma/client');
const CacheHeadersMiddleware = require('../middleware/cacheHeaders');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/tags/popular
 * @desc    Get most popular tags globally
 * @access  Public
 */
router.get('/popular', CacheHeadersMiddleware.apiData(30), async (req, res) => {
  try {
    const { limit = 30 } = req.query;

    // Buscar todos os assets com tags
    const assets = await prisma.asset.findMany({
      where: {
        isApproved: true,
        isActive: true,
        tags: {
          not: null
        }
      },
      select: {
        tags: true,
        categoryId: true
      }
    });

    // Processar e contar tags
    const tagCount = new Map();
    
    assets.forEach(asset => {
      if (!asset.tags) return;
      
      let tags = [];
      try {
        // Tentar parse como JSON primeiro
        const parsed = JSON.parse(asset.tags);
        if (Array.isArray(parsed)) {
          tags = parsed;
        }
      } catch {
        // Se falhar, tratar como string separada por vírgula
        tags = asset.tags.split(',').map(tag => tag.trim());
      }
      
      tags.forEach(tag => {
        if (tag && tag.length > 0) {
          const normalizedTag = tag.toLowerCase().trim();
          tagCount.set(normalizedTag, (tagCount.get(normalizedTag) || 0) + 1);
        }
      });
    });

    // Converter para array e ordenar por popularidade
    const popularTags = Array.from(tagCount.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      tags: popularTags,
      total: popularTags.length
    });

  } catch (error) {
    console.error('Error fetching popular tags:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar tags populares'
    });
  }
});

/**
 * @route   GET /api/tags/search
 * @desc    Search tags globally
 * @access  Public
 */
router.get('/search', CacheHeadersMiddleware.apiData(10), async (req, res) => {
  try {
    const { q: searchTerm, limit = 15 } = req.query;

    if (!searchTerm || searchTerm.length < 2) {
      return res.json({
        success: true,
        tags: [],
        search_term: searchTerm
      });
    }

    // Buscar assets que contenham o termo de busca nas tags
    const assets = await prisma.asset.findMany({
      where: {
        isApproved: true,
        isActive: true,
        tags: {
          contains: searchTerm
        }
      },
      select: {
        tags: true
      }
    });

    // Processar tags e filtrar por termo de busca
    const matchingTags = new Set();
    
    assets.forEach(asset => {
      if (!asset.tags) return;
      
      let tags = [];
      try {
        const parsed = JSON.parse(asset.tags);
        if (Array.isArray(parsed)) {
          tags = parsed;
        }
      } catch {
        tags = asset.tags.split(',').map(tag => tag.trim());
      }
      
      tags.forEach(tag => {
        if (tag && tag.toLowerCase().includes(searchTerm.toLowerCase())) {
          matchingTags.add(tag.trim());
        }
      });
    });

    const results = Array.from(matchingTags)
      .slice(0, parseInt(limit))
      .map(name => ({ name, count: null })); // count null para resultados de busca

    res.json({
      success: true,
      tags: results,
      search_term: searchTerm
    });

  } catch (error) {
    console.error('Error searching tags:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar tags'
    });
  }
});

/**
 * @route   GET /api/tags/stats
 * @desc    Get tag statistics
 * @access  Public
 */
router.get('/stats', CacheHeadersMiddleware.apiData(60), async (req, res) => {
  try {
    // Contar total de assets com tags
    const totalAssetsWithTags = await prisma.asset.count({
      where: {
        isApproved: true,
        isActive: true,
        tags: {
          not: null
        }
      }
    });

    // Buscar todas as tags para estatísticas
    const assets = await prisma.asset.findMany({
      where: {
        isApproved: true,
        isActive: true,
        tags: {
          not: null
        }
      },
      select: {
        tags: true
      }
    });

    const allTags = new Set();
    
    assets.forEach(asset => {
      if (!asset.tags) return;
      
      let tags = [];
      try {
        const parsed = JSON.parse(asset.tags);
        if (Array.isArray(parsed)) {
          tags = parsed;
        }
      } catch {
        tags = asset.tags.split(',').map(tag => tag.trim());
      }
      
      tags.forEach(tag => {
        if (tag && tag.length > 0) {
          allTags.add(tag.toLowerCase().trim());
        }
      });
    });

    res.json({
      success: true,
      stats: {
        total_unique_tags: allTags.size,
        total_assets_with_tags: totalAssetsWithTags,
        avg_tags_per_asset: totalAssetsWithTags > 0 ? allTags.size / totalAssetsWithTags : 0
      }
    });

  } catch (error) {
    console.error('Error fetching tag stats:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas de tags'
    });
  }
});

module.exports = router;
