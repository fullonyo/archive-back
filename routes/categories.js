const express = require('express');
const CategoryService = require('../services/categoryService');
const AssetService = require('../services/assetService');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Importar novos serviços
const AdvancedCacheService = require('../services/advancedCacheService');
const CacheHeadersMiddleware = require('../middleware/cacheHeaders');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/categories
 * @desc    Get all categories (with hierarchy) - USING ADVANCED CACHE
 * @access  Public
 */
router.get('/', CacheHeadersMiddleware.apiData(30), async (req, res) => {
  try {
    const { include_assets = false, parent_id = null } = req.query;

    // Usar cache avançado para categorias
    const categories = await AdvancedCacheService.getCachedCategories();

    // Mapear os dados para o formato esperado pelo frontend
    const formattedCategories = categories.map(category => ({
      id: category.id,
      name: category.name,
      display_name: getDisplayNameForCategory(category.name),
      description: category.description,
      icon: getIconForCategory(category.name),
      color: getColorForCategory(category.name),
      parent_id: null, // TODO: implementar hierarquia
      asset_count: include_assets === 'true' ? (category._count?.assets || 0) : 0,
      isActive: category.isActive
    }));

    // Remover duplicatas, mantendo a categoria com mais assets ou melhor configuração
    const uniqueCategories = removeDuplicateCategories(formattedCategories);

    res.json(uniqueCategories);
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route   GET /api/categories/:id
 * @desc    Get specific category with subcategories and assets - USING PRISMA
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, sort = 'newest' } = req.query;

    // Find category
    const category = await CategoryService.findCategoryById(parseInt(id));
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Categoria não encontrada'
      });
    }

    // Get subcategories - por enquanto, retornar array vazio
    // TODO: Implementar hierarquia de categorias quando necessário
    const subcategories = [];

    // Get assets for the category
    const filters = {
      categoryId: parseInt(id),
      sort
    };

    const assetsResult = await AssetService.findAssets(filters, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: {
        category,
        subcategories,
        assets: assetsResult.assets,
        pagination: assetsResult.pagination
      }
    });
  } catch (error) {
    console.error('Category detail fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route   POST /api/categories
 * @desc    Create new category (Admin only) - USING PRISMA
 * @access  Private (Admin)
 */
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const {
      name,
      displayName,
      description,
      icon = 'cube',
      color = 'gray',
      parentId = null,
      sortOrder = 0
    } = req.body;

    // Validations
    if (!name || !displayName || !description) {
      return res.status(400).json({
        success: false,
        message: 'Nome, nome de exibição e descrição são obrigatórios'
      });
    }

    const categoryData = {
      name,
      displayName,
      description,
      icon,
      color,
      parentId: parentId ? parseInt(parentId) : null,
      sortOrder: parseInt(sortOrder)
    };

    const category = await CategoryService.create(categoryData);

    res.status(201).json({
      success: true,
      message: 'Categoria criada com sucesso',
      data: category
    });
  } catch (error) {
    console.error('Category creation error:', error);
    if (error.message.includes('unique constraint')) {
      return res.status(400).json({
        success: false,
        message: 'Já existe uma categoria com este nome'
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

/**
 * @route   PUT /api/categories/:id
 * @desc    Update category (Admin only) - USING PRISMA
 * @access  Private (Admin)
 */
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      displayName,
      description,
      icon,
      color,
      parentId,
      sortOrder,
      isActive
    } = req.body;

    // Check if category exists
    const existingCategory = await CategoryService.findById(parseInt(id));
    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: 'Categoria não encontrada'
      });
    }

    // Build update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (displayName !== undefined) updateData.displayName = displayName;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (parentId !== undefined) updateData.parentId = parentId ? parseInt(parentId) : null;
    if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder);
    if (isActive !== undefined) updateData.isActive = isActive;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum campo para atualizar'
      });
    }

    await CategoryService.update(parseInt(id), updateData);

    res.json({
      success: true,
      message: 'Categoria atualizada com sucesso'
    });
  } catch (error) {
    console.error('Category update error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

/**
 * @route   DELETE /api/categories/:id
 * @desc    Delete category (Admin only) - Soft delete - USING PRISMA
 * @access  Private (Admin)
 */
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category exists
    const existingCategory = await CategoryService.findById(parseInt(id));
    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: 'Categoria não encontrada'
      });
    }

    // Check if there are assets using this category
    const assetCount = await AssetService.countAssetsByCategory(parseInt(id));
    if (assetCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Não é possível excluir esta categoria. Há ${assetCount} asset(s) associado(s)`
      });
    }

    // Soft delete
    await CategoryService.softDelete(parseInt(id));

    res.json({
      success: true,
      message: 'Categoria removida com sucesso'
    });
  } catch (error) {
    console.error('Category deletion error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

// Helper function to build category tree
function buildCategoryTree(categories) {
  const categoryMap = {};
  const rootCategories = [];

  // Create category map
  categories.forEach(category => {
    categoryMap[category.id] = { ...category, children: [] };
  });

  // Build tree
  categories.forEach(category => {
    if (category.parentId === null) {
      rootCategories.push(categoryMap[category.id]);
    } else if (categoryMap[category.parentId]) {
      categoryMap[category.parentId].children.push(categoryMap[category.id]);
    }
  });

  return rootCategories;
}

// Helper function to get color for category
function getColorForCategory(categoryName) {
  const colorMap = {
    'avatar': 'indigo',
    'clothing': 'purple', 
    'accessory': 'pink',
    'world': 'blue',
    'props': 'green',
    'shader': 'orange'
  };
  
  return colorMap[categoryName] || 'gray';
}

// Helper function to get display name for category
function getDisplayNameForCategory(categoryName) {
  const displayMap = {
    'avatar': 'Avatars',
    'clothing': 'Clothing',
    'accessory': 'Accessories', 
    'world': 'Worlds',
    'props': 'Props & Objects',
    'shader': 'Shaders & Materials'
  };
  
  return displayMap[categoryName] || (categoryName.charAt(0).toUpperCase() + categoryName.slice(1));
}

// Helper function to get icon for category
function getIconForCategory(categoryName) {
  const iconMap = {
    'avatar': 'user-circle',
    'avatars': 'user-circle',
    'clothing': 'sparkles',
    'clothes': 'sparkles',
    'accessory': 'star',
    'accessories': 'star',
    'world': 'globe-alt',
    'worlds': 'globe-alt',
    'props': 'cube',
    'shader': 'wrench-screwdriver'
  };
  
  return iconMap[categoryName] || 'cube';
}

// Helper function to remove duplicate categories
function removeDuplicateCategories(categories) {
  const categoryMap = new Map();
  
  // Group categories by similar names
  const groupKeys = {
    'avatar': ['avatar', 'avatars'],
    'clothing': ['clothing', 'clothes'],
    'accessory': ['accessory', 'accessories'],
    'world': ['world', 'worlds'],
    'props': ['props'],
    'shader': ['shader'],
    'other': ['other']
  };
  
  // Create reverse mapping
  const nameToGroup = {};
  for (const [group, names] of Object.entries(groupKeys)) {
    names.forEach(name => {
      nameToGroup[name] = group;
    });
  }
  
  // Group categories by their category type
  const grouped = {};
  categories.forEach(category => {
    const groupKey = nameToGroup[category.name] || category.name;
    
    if (!grouped[groupKey]) {
      grouped[groupKey] = [];
    }
    grouped[groupKey].push(category);
  });
  
  // For each group, select the best category
  const result = [];
  for (const [groupKey, categoryGroup] of Object.entries(grouped)) {
    if (categoryGroup.length === 1) {
      result.push(categoryGroup[0]);
    } else {
      // Select the category with most assets, or better icon, or newer
      const bestCategory = categoryGroup.reduce((best, current) => {
        // Prefer categories with assets
        if (current.asset_count > best.asset_count) return current;
        if (current.asset_count < best.asset_count) return best;
        
        // Prefer categories with better icons (not 'cube')
        if (current.icon !== 'cube' && best.icon === 'cube') return current;
        if (current.icon === 'cube' && best.icon !== 'cube') return best;
        
        // Prefer categories with better colors (not 'gray')
        if (current.color !== 'gray' && best.color === 'gray') return current;
        if (current.color === 'gray' && best.color !== 'gray') return best;
        
        // Prefer newer (higher ID)
        return current.id > best.id ? current : best;
      });
      
      result.push(bestCategory);
    }
  }
  
  return result.sort((a, b) => a.display_name.localeCompare(b.display_name));
}

/**
 * @route   GET /api/categories/:id/tags/popular
 * @desc    Get popular tags for a specific category
 * @access  Public
 */
router.get('/:id/tags/popular', CacheHeadersMiddleware.apiData(15), async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const { limit = 20 } = req.query;

    // Buscar assets da categoria para extrair tags
    const assets = await prisma.asset.findMany({
      where: {
        categoryId: categoryId,
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
      category_id: categoryId,
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
 * @route   GET /api/categories/:id/tags/search
 * @desc    Search tags within a specific category
 * @access  Public
 */
router.get('/:id/tags/search', CacheHeadersMiddleware.apiData(5), async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const { q: searchTerm, limit = 10 } = req.query;

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
        categoryId: categoryId,
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
      search_term: searchTerm,
      category_id: categoryId
    });

  } catch (error) {
    console.error('Error searching tags:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar tags'
    });
  }
});

module.exports = router;