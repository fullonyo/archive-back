const express = require('express');
const rateLimit = require('express-rate-limit');
const AssetService = require('../services/assetService');
const UserService = require('../services/userService');
const { verifyToken, canUpload, isAdmin, optionalAuth } = require('../middleware/auth');
const { validate, schemas, validateQuery, querySchemas } = require('../middleware/validation');
const { uploadConfigs, handleMulterError } = require('../config/multer');
const googleDriveService = require('../services/googleDrive');
const { cache, SimpleCache } = require('../utils/cache');

// Importar novos serviços
const AdvancedCacheService = require('../services/advancedCacheService');
const CacheHeadersMiddleware = require('../middleware/cacheHeaders');
const cdnService = require('../services/cdnService');
const DatabaseOptimizationService = require('../services/databaseOptimizationService');

const router = express.Router();

// Rate limiting específico para uploads
const uploadLimiter = rateLimit({
  windowMs: parseInt(process.env.UPLOAD_RATE_WINDOW) * 60 * 1000 || 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 500 : (parseInt(process.env.UPLOAD_RATE_LIMIT) || 10),
  message: 'Too many uploads from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Get all assets (marketplace) - USING ADVANCED CACHE
router.get('/', optionalAuth, CacheHeadersMiddleware.apiData(3), async (req, res) => {
  try {
    console.log('Assets route called with params:', req.query);
    
    const { 
      page = 1, 
      limit = 20, 
      sort = 'newest', 
      q, 
      category, 
      tags 
    } = req.query;

    console.log('Parsed params:', { page, limit, sort, q, category, tags });

    // Usar cache avançado ao invés do cache simples
    const filters = {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy: sort,
      searchQuery: q,
      categoryId: category,
      tags: tags ? tags.split(',') : undefined,
      isApproved: true,
      isActive: true
    };

    const cacheKey = `assets_${JSON.stringify(filters)}`;

    // Usar o cache avançado
    const result = await AdvancedCacheService.getCachedAssets(filters, cacheKey);

    // Preparar URLs de CDN se disponível
    if (result.assets) {
      result.assets = cdnService.prepareCDNUrls(result.assets);
    }

    return res.json({
      success: true,
      data: result,
      cached: result.cached || false,
      source: result.source || 'cache'
    });

  } catch (error) {
    console.error('Get assets error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to get assets',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get recent assets - USING ADVANCED CACHE
router.get('/recent', CacheHeadersMiddleware.apiData(2), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // Usar cache avançado com filtros corretos
    const filters = { 
      page: 1,
      limit, 
      sortBy: 'newest',
      isApproved: true, 
      isActive: true 
    };
    const cacheKey = `recent_assets_${limit}`;
    
    const result = await AdvancedCacheService.getCachedAssets(filters, cacheKey);
    
    res.json({
      success: true,
      data: result.assets || result,
      cached: result.cached || false
    });
  } catch (error) {
    console.error('Get recent assets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recent assets'
    });
  }
});

// Get stats - USING ADVANCED CACHE
router.get('/stats', CacheHeadersMiddleware.apiData(5), async (req, res) => {
  try {
    const stats = await AdvancedCacheService.getCachedStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get stats'
    });
  }
});

// Get trending assets
router.get('/trending', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    // Por enquanto, vamos retornar os assets com mais downloads
    const assets = await AssetService.findAssets({ sort: 'downloads' }, { limit });
    
    res.json({
      success: true,
      data: assets.assets || []
    });
  } catch (error) {
    console.error('Get trending assets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trending assets'
    });
  }
});

// Get recommendations
router.get('/recommendations', optionalAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // Por enquanto, retornar assets populares como recomendações
    const filters = { 
      page: 1,
      limit, 
      sortBy: 'popular',
      isApproved: true, 
      isActive: true 
    };
    const cacheKey = `recommendations_${limit}`;
    
    const result = await AdvancedCacheService.getCachedAssets(filters, cacheKey);
    
    res.json({
      success: true,
      data: result.assets || result,
      cached: result.cached || false
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recommendations'
    });
  }
});

// Get asset by ID - USING PRISMA
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const asset = await AssetService.findAssetById(parseInt(id), req.user?.id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    res.json({
      success: true,
      data: { asset }
    });
  } catch (error) {
    console.error('Get asset error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get asset'
    });
  }
});

// Upload new asset (todos os usuários autenticados) - USING PRISMA
router.post('/', verifyToken, uploadLimiter, uploadConfigs.asset, handleMulterError, validate(schemas.uploadAsset), async (req, res) => {
  try {
    console.log('=== UPLOAD ASSET REQUEST START ===');
    console.log('Headers:', req.headers);
    console.log('Body keys:', Object.keys(req.body));
    console.log('Body:', req.body);
    console.log('Files received:', req.files);
    
    // Process files from upload.any()
    if (!req.files || req.files.length === 0) {
      console.log('ERROR: No files in request');
      return res.status(400).json({
        success: false,
        message: 'Files are required'
      });
    }

    // Separate main file and images
    const mainFiles = req.files.filter(file => file.fieldname === 'file');
    const imageFiles = req.files.filter(file => file.fieldname === 'images');

    if (mainFiles.length === 0) {
      console.log('ERROR: No main file in request');
      return res.status(400).json({
        success: false,
        message: 'Main asset file is required'
      });
    }

    if (mainFiles.length > 1) {
      console.log('ERROR: Too many main files');
      return res.status(400).json({
        success: false,
        message: 'Only one main file allowed'
      });
    }

    if (imageFiles.length > 5) {
      console.log('ERROR: Too many image files');
      return res.status(400).json({
        success: false,
        message: 'Maximum 5 images allowed'
      });
    }

    const mainFile = mainFiles[0];

    console.log('Main file info:', {
      fieldname: mainFile.fieldname,
      originalname: mainFile.originalname,
      mimetype: mainFile.mimetype,
      size: mainFile.size,
      buffer: mainFile.buffer ? `Buffer length: ${mainFile.buffer.length}` : 'No buffer'
    });

    console.log('Image files:', imageFiles.map(img => ({
      originalname: img.originalname,
      mimetype: img.mimetype,
      size: img.size
    })));

    // Verificar se o arquivo principal tem conteúdo
    if (!mainFile.buffer || mainFile.buffer.length === 0) {
      console.log('ERROR: Main file buffer is empty');
      return res.status(400).json({
        success: false,
        message: 'Main file is empty or corrupted'
      });
    }

    const { title, description, category_id, tags, external_url } = req.body;
    const userId = req.user.id;

    console.log('Processing upload for user:', userId);
    console.log('Asset data:', { title, description, category_id, tags, external_url });

    // Upload main file to Google Drive
    console.log('Starting Google Drive upload for main file...');
    const driveFile = await googleDriveService.uploadFile(mainFile, mainFile.buffer);
    console.log('Main file uploaded to Google Drive:', driveFile);

    // Upload images to Google Drive (parallel upload)
    let imageUrls = [];
    if (imageFiles.length > 0) {
      console.log('Uploading', imageFiles.length, 'images to Google Drive in parallel...');
      
      // Upload all images in parallel for better performance
      const imageUploadPromises = imageFiles.map(async (imageFile, index) => {
        try {
          console.log(`Starting upload of image ${index + 1}/${imageFiles.length}: ${imageFile.originalname}`);
          const uploadedImage = await googleDriveService.uploadFile(imageFile, imageFile.buffer);
          console.log(`Image ${index + 1}/${imageFiles.length} uploaded successfully:`, uploadedImage.name);
          return uploadedImage.downloadLink;
        } catch (error) {
          console.error(`Error uploading image ${index + 1}:`, error.message);
          return null; // Return null for failed uploads
        }
      });
      
      // Wait for all image uploads to complete
      const uploadResults = await Promise.allSettled(imageUploadPromises);
      
      // Filter out failed uploads and collect successful URLs
      imageUrls = uploadResults
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);
        
      console.log(`Image uploads completed: ${imageUrls.length}/${imageFiles.length} successful`);
    }

    console.log('All image uploads completed. URLs:', imageUrls);

    // Determinar se o upload deve ser auto-aprovado baseado no role do usuário
    const userRole = req.user.role || 'USER';
    const autoApproveRoles = ['SISTEMA', 'ADMIN', 'MODERATOR']; // Roles que têm uploads auto-aprovados
    const shouldAutoApprove = autoApproveRoles.includes(userRole);
    
    console.log(`User role: ${userRole}, Auto-approve: ${shouldAutoApprove}`);

    // Create asset using service
    const assetData = {
      title,
      description,
      categoryId: parseInt(category_id),
      userId,
      fileName: driveFile.name,
      fileSize: BigInt(driveFile.size || mainFile.size),
      fileType: mainFile.mimetype,
      googleDriveId: driveFile.id,
      googleDriveUrl: driveFile.downloadLink,
      imageUrls: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
      thumbnailUrl: imageUrls.length > 0 ? imageUrls[0] : null, // First image as thumbnail
      tags: tags ? JSON.stringify(Array.isArray(tags) ? tags : [tags]) : null,
      externalUrl: external_url || null, // Add external URL if provided
      isApproved: shouldAutoApprove // Auto-approve based on user role
    };

    console.log('Creating asset in database with data:', assetData);
    const asset = await AssetService.createAsset(assetData);
    console.log('Asset created successfully with ID:', asset.id);
    console.log('Asset approval status:', asset.isApproved);
    console.log('Asset category:', asset.categoryId);
    console.log('Asset images:', asset.imageUrls);

    // Limpar cache após upload bem-sucedido
    console.log('Clearing assets cache after new upload');
    try {
      await AdvancedCacheService.invalidateAssetsCaches();
      await AdvancedCacheService.invalidateCategoriesCache();
      console.log('Advanced cache invalidated successfully');
    } catch (cacheError) {
      console.warn('Error invalidating advanced cache, falling back to simple cache:', cacheError);
      cache.clear();
    }

    // Determinar mensagem de resposta baseada no status de aprovação
    const responseMessage = asset.isApproved 
      ? `Asset enviado e aprovado automaticamente!`
      : `Asset enviado com sucesso! Aguardando aprovação da moderação.`;

    res.status(201).json({
      success: true,
      message: responseMessage,
      data: { 
        asset,
        needsApproval: !asset.isApproved,
        userRole: userRole,
        autoApproved: shouldAutoApprove
      }
    });
    console.log('=== UPLOAD ASSET REQUEST COMPLETE ===');
  } catch (error) {
    console.error('=== UPLOAD ASSET ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload asset'
    });
  }
});

// Download asset - USING PRISMA
router.get('/:id/download', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const asset = await AssetService.findAssetById(parseInt(id));
    
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    // Record download
    const downloadData = {
      assetId: parseInt(id),
      userId: req.user?.id || null,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };

    await AssetService.recordDownload(downloadData);

    // Generate proper download URL for files (not images)
    const downloadUrl = asset.googleDriveUrl.replace('export=view', 'export=download');

    res.json({
      success: true,
      data: {
        download_url: downloadUrl,
        title: asset.title,
        filename: asset.fileName
      }
    });
  } catch (error) {
    console.error('Download asset error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process download'
    });
  }
});

// Add/remove favorite - USING PRISMA
router.post('/:id/favorite', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const asset = await AssetService.findAssetById(parseInt(id));
    
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    const result = await AssetService.toggleFavorite(userId, parseInt(id));

    res.json({
      success: true,
      message: result.isFavorited ? 'Asset added to favorites' : 'Asset removed from favorites',
      data: { is_favorited: result.isFavorited }
    });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle favorite'
    });
  }
});

// Add review/rating - USING PRISMA
router.post('/:id/review', verifyToken, validate(schemas.reviewAsset), async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;

    const asset = await AssetService.findAssetById(parseInt(id));
    
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    // Can't review own asset
    if (asset.userId === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot review your own asset'
      });
    }

    const reviewData = {
      assetId: parseInt(id),
      userId,
      rating,
      comment
    };

    const result = await AssetService.createOrUpdateReview(reviewData);

    res.json({
      success: true,
      message: result.isUpdate ? 'Review updated successfully' : 'Review added successfully'
    });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review'
    });
  }
});

// Get asset reviews - USING PRISMA
router.get('/:id/reviews', validateQuery(querySchemas.pagination), async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const result = await AssetService.getAssetReviews(parseInt(id), {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get reviews'
    });
  }
});

// Update asset (owner or admin only) - USING PRISMA
router.put('/:id', verifyToken, validate(schemas.uploadAsset), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category_id, tags } = req.body;
    const userId = req.user.id;

    const asset = await AssetService.findAssetById(parseInt(id));
    
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    const isOwner = asset.userId === userId;
    const isAdminUser = req.user.account_type === 'admin';

    if (!isOwner && !isAdminUser) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this asset'
      });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (category_id !== undefined) updateData.categoryId = parseInt(category_id);
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [tags];

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    await AssetService.updateAsset(parseInt(id), updateData);

    res.json({
      success: true,
      message: 'Asset updated successfully'
    });
  } catch (error) {
    console.error('Update asset error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update asset'
    });
  }
});

// Delete asset (owner or admin only) - USING PRISMA
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const asset = await AssetService.findAssetById(parseInt(id));
    
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    const isOwner = asset.userId === userId;
    const isAdminUser = req.user.account_type === 'admin';

    if (!isOwner && !isAdminUser) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this asset'
      });
    }

    // Use the new deleteAsset method for permanent deletion
    await AssetService.deleteAsset(parseInt(id), isAdminUser ? req.user.id : null);

    // Clear cache after deletion
    try {
      await AdvancedCacheService.invalidateAssetsCaches();
      await AdvancedCacheService.invalidateCategoriesCache();
      console.log('Advanced cache invalidated after asset deletion');
    } catch (cacheError) {
      console.warn('Error invalidating advanced cache, falling back to simple cache:', cacheError);
      cache.clear();
    }

    res.json({
      success: true,
      message: 'Asset deleted permanently'
    });
  } catch (error) {
    console.error('Delete asset error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete asset'
    });
  }
});

// Get asset categories - USING PRISMA
router.get('/categories/list', async (req, res) => {
  try {
    const CategoryService = require('../services/categoryService');
    const categories = await CategoryService.findAllCategories();

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get categories'
    });
  }
});

// Admin: Get pending assets for approval - USING PRISMA
router.get('/admin/pending', verifyToken, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const result = await AssetService.findAssets({
      page: parseInt(page),
      limit: parseInt(limit),
      isApproved: false, // Only unapproved assets
      sortBy: 'createdAt',
      sortOrder: 'asc' // Oldest first
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get pending assets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending assets'
    });
  }
});

// Admin: Approve/reject asset - USING PRISMA
router.put('/:id/approval', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_approved } = req.body;

    if (typeof is_approved !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'is_approved must be a boolean'
      });
    }

    await AssetService.updateAssetApproval(parseInt(id), is_approved);

    // TODO: Log admin action when AdminLog service is created

    res.json({
      success: true,
      message: `Asset ${is_approved ? 'approved' : 'rejected'} successfully`
    });
  } catch (error) {
    console.error('Update approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update approval status'
    });
  }
});

// Test Google Drive configuration (Admin only)
router.get('/test-drive', verifyToken, isAdmin, async (req, res) => {
  try {
    console.log('🧪 Testing Google Drive configuration...');
    
    // Testar configuração básica
    const isConfigured = await googleDriveService.checkConfiguration();
    
    if (!isConfigured) {
      return res.status(500).json({
        success: false,
        message: 'Google Drive authentication failed',
        details: 'Service Account credentials may be invalid or APIs not enabled'
      });
    }

    // Obter informações da pasta
    let folderInfo = {};
    try {
      folderInfo = await googleDriveService.getFolderInfo();
    } catch (error) {
      folderInfo = { warning: 'Could not access folder info, files will be uploaded to root' };
    }

    // Testar upload de arquivo pequeno
    const testContent = `VRCHIEVE Test - ${new Date().toISOString()}`;
    const testBuffer = Buffer.from(testContent, 'utf8');
    
    const fileInfo = {
      originalname: 'vrchieve-test.txt',
      mimetype: 'text/plain',
      size: testBuffer.length
    };

    const uploadResult = await googleDriveService.uploadFile(fileInfo, testBuffer);
    
    // Limpar arquivo de teste
    setTimeout(async () => {
      try {
        await googleDriveService.deleteFile(uploadResult.id);
        console.log('✅ Test file cleaned up');
      } catch (error) {
        console.warn('⚠️ Could not clean up test file:', error.message);
      }
    }, 5000); // Aguardar 5 segundos antes de limpar

    res.json({
      success: true,
      message: 'Google Drive is configured and working correctly',
      data: {
        authentication: '✅ OK',
        upload: '✅ OK',
        permissions: '✅ OK',
        folder: folderInfo,
        testFile: {
          id: uploadResult.id,
          name: uploadResult.name,
          downloadLink: uploadResult.downloadLink
        },
        configuration: {
          serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PATH ? '✅ Configured' : '❌ Missing',
          sharedDrive: process.env.GOOGLE_SHARED_DRIVE_ID ? '✅ Configured' : '⚠️ Not configured',
          specificFolder: process.env.GOOGLE_DRIVE_FOLDER_ID ? '✅ Configured' : '⚠️ Will use root'
        }
      }
    });

  } catch (error) {
    console.error('❌ Google Drive test error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Google Drive test failed',
      error: error.message,
      details: 'Check server logs for detailed error information'
    });
  }
});

// Get related assets
router.get('/:id/related', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 5;
    
    // Buscar o asset principal para obter categorias
    const mainAsset = await prisma.asset.findUnique({
      where: { id: parseInt(id) },
      select: { categoryId: true, tags: true }
    });
    
    if (!mainAsset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }
    
    // Buscar assets relacionados da mesma categoria
    const filters = {
      categoryId: mainAsset.categoryId,
      excludeId: parseInt(id),
      limit,
      sortBy: 'popular',
      isApproved: true,
      isActive: true
    };
    
    const cacheKey = `related_assets_${id}_${limit}`;
    const result = await AdvancedCacheService.getCachedAssets(filters, cacheKey);
    
    res.json({
      success: true,
      data: result.assets || result,
      cached: result.cached || false
    });
  } catch (error) {
    console.error('Get related assets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get related assets'
    });
  }
});

module.exports = router;
