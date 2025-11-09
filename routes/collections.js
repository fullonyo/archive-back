const express = require('express');
const router = express.Router();
const CollectionService = require('../services/collectionService');
const { verifyToken } = require('../middleware/auth-prisma');
const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware para validação de erros
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * @route   POST /api/collections
 * @desc    Criar nova coleção
 * @access  Private
 */
router.post(
  '/',
  verifyToken,
  [
    body('name')
      .trim()
      .notEmpty().withMessage('Collection name is required')
      .isLength({ max: 100 }).withMessage('Collection name must be less than 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 5000 }).withMessage('Description is too long'),
    body('emoji')
      .optional()
      .isLength({ max: 10 }).withMessage('Emoji is too long'),
    body('visibility')
      .optional()
      .isIn(['PUBLIC', 'PRIVATE']).withMessage('Invalid visibility value')
  ],
  validate,
  async (req, res) => {
    try {
      const collection = await CollectionService.createCollection(req.user.id, req.body);
      
      res.status(201).json({
        success: true,
        message: 'Collection created successfully',
        data: collection
      });
    } catch (error) {
      console.error('Create collection error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create collection',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   GET /api/collections
 * @desc    Listar coleções do usuário
 * @access  Private
 */
router.get(
  '/',
  verifyToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('sortBy').optional().isIn(['newest', 'oldest', 'name', 'assets']).withMessage('Invalid sort option')
  ],
  validate,
  async (req, res) => {
    try {
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        sortBy: req.query.sortBy || 'newest'
      };

      const result = await CollectionService.getUserCollections(req.user.id, options);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get collections error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch collections',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   GET /api/collections/search
 * @desc    Buscar coleções (para modal "Save to Collection")
 * @access  Private
 */
router.get(
  '/search',
  verifyToken,
  [
    query('q').optional().trim(),
    query('assetId').optional().isInt().withMessage('Asset ID must be an integer')
  ],
  validate,
  async (req, res) => {
    try {
      const query = req.query.q || '';
      const assetId = req.query.assetId ? parseInt(req.query.assetId) : null;

      const collections = await CollectionService.searchUserCollections(
        req.user.id,
        query,
        assetId
      );
      
      res.json({
        success: true,
        data: {
          collections
        }
      });
    } catch (error) {
      console.error('Search collections error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search collections',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   GET /api/collections/:id
 * @desc    Ver detalhes de uma coleção
 * @access  Private
 */
router.get(
  '/:id',
  verifyToken,
  [
    param('id').isInt().withMessage('Collection ID must be an integer')
  ],
  validate,
  async (req, res) => {
    try {
      const collectionId = parseInt(req.params.id);
      const collection = await CollectionService.getCollectionById(collectionId, req.user.id);
      
      res.json({
        success: true,
        data: collection
      });
    } catch (error) {
      console.error('Get collection error:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch collection',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   PUT /api/collections/:id
 * @desc    Atualizar coleção
 * @access  Private
 */
router.put(
  '/:id',
  verifyToken,
  [
    param('id').isInt().withMessage('Collection ID must be an integer'),
    body('name')
      .optional()
      .trim()
      .notEmpty().withMessage('Collection name cannot be empty')
      .isLength({ max: 100 }).withMessage('Collection name must be less than 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 5000 }).withMessage('Description is too long'),
    body('emoji')
      .optional()
      .isLength({ max: 10 }).withMessage('Emoji is too long'),
    body('visibility')
      .optional()
      .isIn(['PUBLIC', 'PRIVATE']).withMessage('Invalid visibility value')
  ],
  validate,
  async (req, res) => {
    try {
      const collectionId = parseInt(req.params.id);
      const collection = await CollectionService.updateCollection(
        collectionId,
        req.user.id,
        req.body
      );
      
      res.json({
        success: true,
        message: 'Collection updated successfully',
        data: collection
      });
    } catch (error) {
      console.error('Update collection error:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update collection',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   DELETE /api/collections/:id
 * @desc    Deletar coleção
 * @access  Private
 */
router.delete(
  '/:id',
  verifyToken,
  [
    param('id').isInt().withMessage('Collection ID must be an integer')
  ],
  validate,
  async (req, res) => {
    try {
      const collectionId = parseInt(req.params.id);
      const result = await CollectionService.deleteCollection(collectionId, req.user.id);
      
      res.json(result);
    } catch (error) {
      console.error('Delete collection error:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete collection',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   POST /api/collections/:id/items
 * @desc    Adicionar asset à coleção
 * @access  Private
 */
router.post(
  '/:id/items',
  verifyToken,
  [
    param('id').isInt().withMessage('Collection ID must be an integer'),
    body('assetId').isInt().withMessage('Asset ID must be an integer')
  ],
  validate,
  async (req, res) => {
    try {
      const collectionId = parseInt(req.params.id);
      const { assetId } = req.body;
      
      const item = await CollectionService.addAssetToCollection(
        collectionId,
        assetId,
        req.user.id
      );
      
      res.status(201).json({
        success: true,
        message: 'Asset added to collection',
        data: item
      });
    } catch (error) {
      console.error('Add asset to collection error:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      if (error.message.includes('already in collection')) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to add asset to collection',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   DELETE /api/collections/:id/items/:assetId
 * @desc    Remover asset da coleção
 * @access  Private
 */
router.delete(
  '/:id/items/:assetId',
  verifyToken,
  [
    param('id').isInt().withMessage('Collection ID must be an integer'),
    param('assetId').isInt().withMessage('Asset ID must be an integer')
  ],
  validate,
  async (req, res) => {
    try {
      const collectionId = parseInt(req.params.id);
      const assetId = parseInt(req.params.assetId);
      
      const result = await CollectionService.removeAssetFromCollection(
        collectionId,
        assetId,
        req.user.id
      );
      
      res.json(result);
    } catch (error) {
      console.error('Remove asset from collection error:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to remove asset from collection',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   PUT /api/collections/:id/items/reorder
 * @desc    Reordenar items da coleção
 * @access  Private
 */
router.put(
  '/:id/items/reorder',
  verifyToken,
  [
    param('id').isInt().withMessage('Collection ID must be an integer'),
    body('items').isArray().withMessage('Items must be an array'),
    body('items.*.id').isInt().withMessage('Item ID must be an integer'),
    body('items.*.order').isInt({ min: 0 }).withMessage('Order must be a non-negative integer')
  ],
  validate,
  async (req, res) => {
    try {
      const collectionId = parseInt(req.params.id);
      const { items } = req.body;
      
      const result = await CollectionService.reorderCollectionItems(
        collectionId,
        req.user.id,
        items
      );
      
      res.json(result);
    } catch (error) {
      console.error('Reorder collection items error:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to reorder collection items',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   GET /api/collections/asset/:assetId
 * @desc    Verificar em quais coleções o asset está
 * @access  Private
 */
router.get(
  '/asset/:assetId',
  verifyToken,
  [
    param('assetId').isInt().withMessage('Asset ID must be an integer')
  ],
  validate,
  async (req, res) => {
    try {
      const assetId = parseInt(req.params.assetId);
      const collections = await CollectionService.getAssetCollections(assetId, req.user.id);
      
      res.json({
        success: true,
        data: collections
      });
    } catch (error) {
      console.error('Get asset collections error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch asset collections',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

module.exports = router;
