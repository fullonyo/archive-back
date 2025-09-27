const express = require('express');
const bcryptjs = require('bcryptjs');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');
const accessRequestService = require('../services/accessRequestService');
const permissionService = require('../services/permissionService');
const userService = require('../services/userService');
const { PERMISSION_LEVELS } = require('../services/permissionService');
const { AdminLogService } = require('../services/adminLogService');
const { PrismaClient } = require('@prisma/client');
const AssetService = require('../services/assetService');

// Importar cache service para padronização
const AdvancedCacheService = require('../services/advancedCacheService');
const CacheHeadersMiddleware = require('../middleware/cacheHeaders');

const prisma = new PrismaClient();

// ===== MIDDLEWARE DE PERMISSÕES =====

// Middleware para verificar permissões administrativas
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      const hasPermission = await permissionService.hasPermission(req.user.id, permission);
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Sem permissão para esta ação'
        });
      }
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar permissões'
      });
    }
  };
};

// ===== ROTAS DE PERMISSÕES =====

/**
 * @route   GET /api/admin/permissions/me
 * @desc    Get current user permissions and level - USING PRISMA
 * @access  Private (Auth required)
 */
router.get('/permissions/me', verifyToken, async (req, res) => {
  try {
    console.log('🔐 [ADMIN] Buscando permissões para usuário:', req.user);
    
    // Buscar usuário diretamente do banco para garantir dados atualizados
    const freshUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        accountType: true,
        isActive: true
      }
    });
    
    if (!freshUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Map role to permissions (simplified version)
    const rolePermissions = {
      SISTEMA: [
        'manage_users', 'approve_users', 'ban_users', 'view_user_details',
        'manage_assets', 'approve_assets', 'delete_assets', 'moderate_assets',
        'manage_categories', 'create_categories', 'delete_categories',
        'manage_permissions', 'view_admin_panel', 'view_analytics', 'manage_settings',
        'upload_assets', 'upload_premium', 'moderate_comments', 'moderate_reports'
      ],
      ADMIN: [
        'manage_users', 'approve_users', 'ban_users', 'view_user_details',
        'manage_assets', 'approve_assets', 'delete_assets', 'moderate_assets',
        'manage_categories', 'create_categories', 'delete_categories',
        'view_admin_panel', 'view_analytics', 'manage_settings',
        'upload_assets', 'upload_premium', 'moderate_comments', 'moderate_reports'
      ],
      MODERATOR: [
        'view_user_details', 'moderate_assets', 'approve_assets',
        'view_admin_panel', 'upload_assets', 'moderate_comments', 'moderate_reports'
      ],
      CREATOR: ['upload_assets', 'upload_premium'],
      USER: ['upload_assets']
    };
    
    const userRole = freshUser.role || 'USER';
    const permissions = rolePermissions[userRole] || rolePermissions.USER;
    
    res.json({
      success: true,
      data: {
        level: userRole,
        permissions: permissions,
        user: { ...req.user, role: userRole }
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN] Erro ao buscar permissões:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ===== ROTAS DE SOLICITAÇÕES DE ACESSO =====

/**
 * @route   POST /api/admin/access-requests
 * @desc    Create access request (Public) - USING PRISMA
 * @access  Public
 */
router.post('/access-requests', async (req, res) => {
  try {
    const { name, email, discord, password, reason } = req.body;

    // Validações básicas
    if (!name || !email || !password || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: name, email, password, reason'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Senha deve ter pelo menos 6 caracteres'
      });
    }

    const request = await accessRequestService.createAccessRequest({
      name,
      email,
      discord,
      password,
      reason
    });

    res.status(201).json({
      success: true,
      message: 'Solicitação de acesso enviada com sucesso',
      data: {
        id: request.id,
        email: request.email,
        status: request.status,
        createdAt: request.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Erro ao criar solicitação:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

/**
 * @route   GET /api/admin/access-requests
 * @desc    Get all access requests with pagination - USING PRISMA
 * @access  Private (Admin)
 */
router.get('/access-requests', verifyToken, requirePermission('view_admin_panel'), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const result = await accessRequestService.getAccessRequests({
      status,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: result.requests,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('❌ Erro ao listar solicitações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route   GET /api/admin/access-requests/stats
 * @desc    Get access requests statistics - USING PRISMA
 * @access  Private (Admin)
 */
router.get('/access-requests/stats', verifyToken, requirePermission('view_admin_panel'), async (req, res) => {
  try {
    const stats = await accessRequestService.getAccessRequestStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route   GET /api/admin/access-requests/:id
 * @desc    Get specific access request details - USING PRISMA
 * @access  Private (Admin)
 */
router.get('/access-requests/:id', verifyToken, requirePermission('view_admin_panel'), async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    
    if (isNaN(requestId)) {
      return res.status(400).json({
        success: false,
        message: 'ID da solicitação inválido'
      });
    }

    const request = await accessRequestService.getAccessRequestById(requestId);
    
    res.json({
      success: true,
      data: request
    });

  } catch (error) {
    console.error('❌ Erro ao buscar solicitação:', error);
    res.status(404).json({
      success: false,
      message: error.message || 'Solicitação não encontrada'
    });
  }
});

/**
 * @route   POST /api/admin/access-requests/:id/approve
 * @desc    Approve access request (Admin only) - USING PRISMA
 * @access  Private (Admin)
 */
router.post('/access-requests/:id/approve', verifyToken, requirePermission('approve_users'), async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { username, role = 'USER', accountType = 'FREE' } = req.body;

    if (isNaN(requestId)) {
      return res.status(400).json({
        success: false,
        message: 'ID da solicitação inválido'
      });
    }

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Nome de usuário é obrigatório'
      });
    }

    const result = await accessRequestService.approveAccessRequest(requestId, req.user.id, {
      username,
      role,
      accountType
    });

    res.json({
      success: true,
      message: 'Solicitação aprovada e usuário criado',
      data: {
        request: result.request,
        user: {
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          role: result.user.role
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro ao aprovar solicitação:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

/**
 * @route   POST /api/admin/access-requests/:id/reject
 * @desc    Reject access request (Admin only) - USING PRISMA
 * @access  Private (Admin)
 */
router.post('/access-requests/:id/reject', verifyToken, requirePermission('approve_users'), async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { reason } = req.body;

    if (isNaN(requestId)) {
      return res.status(400).json({
        success: false,
        message: 'ID da solicitação inválido'
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Motivo da rejeição é obrigatório'
      });
    }

    const request = await accessRequestService.rejectAccessRequest(requestId, req.user.id, reason);

    res.json({
      success: true,
      message: 'Solicitação rejeitada',
      data: request
    });

  } catch (error) {
    console.error('❌ Erro ao rejeitar solicitação:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

// ===== ROTAS DE GERENCIAMENTO DE USUÁRIOS =====

/**
 * @route   GET /api/admin/users
 * @desc    Get users with permissions and pagination - USING PRISMA
 * @access  Private (Admin)
 */
router.get('/users', verifyToken, requirePermission('view_user_details'), async (req, res) => {
  try {
    const { role, page = 1, limit = 20, search } = req.query;
    
    const result = await permissionService.getUsersWithPermissions({
      role,
      search,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: result.users,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('❌ Erro ao listar usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get specific user details - USING PRISMA
 * @access  Private (Admin)
 */
router.get('/users/:id', verifyToken, requirePermission('view_user_details'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'ID do usuário inválido'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        accountType: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
        _count: {
          select: {
            assets: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        ...user,
        assetCount: user._count.assets
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route   GET /api/admin/users/:id/permissions
 * @desc    Get user permissions - USING PRISMA
 * @access  Private (Admin)
 */
router.get('/users/:id/permissions', verifyToken, requirePermission('view_user_details'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'ID do usuário inválido'
      });
    }

    const permissions = await permissionService.getUserPermissions(userId);
    
    res.json({
      success: true,
      data: permissions
    });

  } catch (error) {
    console.error('❌ Erro ao buscar permissões:', error);
    res.status(404).json({
      success: false,
      message: error.message || 'Usuário não encontrado'
    });
  }
});

/**
 * @route   GET /api/admin/users/:id/profile
 * @desc    Get detailed user profile with stats - USING PRISMA
 * @access  Private (Admin)
 */
router.get('/users/:id/profile', verifyToken, requirePermission('view_user_details'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'ID do usuário inválido'
      });
    }

    // Buscar dados completos do usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        accountType: true,
        avatarUrl: true,
        bio: true,
        socialLinks: true,
        isVerified: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        googleId: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Buscar estatísticas básicas
    const [uploadsCount, downloadsCount, favoritesCount, reviewsCount] = await Promise.all([
      prisma.asset.count({ where: { userId, isActive: true } }),
      prisma.assetDownload.count({ where: { userId } }),
      prisma.userFavorite.count({ where: { userId } }),
      prisma.assetReview.count({ where: { userId } })
    ]);

    // Buscar rating médio
    const reviews = await prisma.assetReview.findMany({
      where: { asset: { userId } },
      select: { rating: true }
    });

    const averageRating = reviews.length > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
      : 0;

    // Combinar dados
    const userWithStats = {
      ...user,
      stats: {
        totalUploads: uploadsCount,
        totalDownloads: downloadsCount,
        totalFavorites: favoritesCount,
        totalReviews: reviewsCount,
        averageRating: Number(averageRating.toFixed(2))
      }
    };
    
    res.json({
      success: true,
      data: userWithStats
    });

  } catch (error) {
    console.error('❌ Erro ao buscar perfil do usuário:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro ao buscar perfil do usuário'
    });
  }
});

/**
 * @route   GET /api/admin/users/:id/assets
 * @desc    Get user assets for admin view - USING PRISMA
 * @access  Private (Admin)
 */
router.get('/users/:id/assets', verifyToken, requirePermission('view_user_details'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { page = 1, limit = 20 } = req.query;
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'ID do usuário inválido'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Buscar assets do usuário (incluindo inativos para admin)
    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where: { userId },
        select: {
          id: true,
          title: true,
          description: true,
          isActive: true,
          isApproved: true,
          downloadCount: true,
          createdAt: true,
          category: {
            select: {
              name: true
            }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.asset.count({ where: { userId } })
    ]);
    
    res.json({
      success: true,
      data: assets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar assets do usuário:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro ao buscar assets do usuário'
    });
  }
});

/**
 * @route   PUT /api/admin/users/:id/role
 * @desc    Update user role (Admin only) - USING PRISMA
 * @access  Private (Admin)
 */
router.put('/users/:id/role', verifyToken, requirePermission('manage_users'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { role } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'ID do usuário inválido'
      });
    }

    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Role é obrigatório'
      });
    }

    const user = await permissionService.changeUserRole(userId, role, req.user.id);

    res.json({
      success: true,
      message: 'Role alterado com sucesso',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Erro ao alterar role:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

// ===== ROTAS DE LOGS ADMINISTRATIVOS =====

/**
 * @route   GET /api/admin/logs
 * @desc    Get admin logs with pagination - USING PRISMA
 * @access  Private (Admin)
 */
router.get('/logs', verifyToken, requirePermission('view_admin_panel'), async (req, res) => {
  try {
    const { adminId, action, targetType, page = 1, limit = 50 } = req.query;
    
    const result = await AdminLogService.getAdminLogs({
      adminId: adminId ? parseInt(adminId) : undefined,
      action,
      targetType,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('❌ Erro ao buscar logs:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route   GET /api/admin/logs/stats
 * @desc    Get admin logs statistics - USING PRISMA
 * @access  Private (Admin)
 */
router.get('/logs/stats', verifyToken, requirePermission('view_analytics'), async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const stats = await AdminLogService.getAdminLogStats(timeframe);
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas de logs:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ===== ROTAS DE GERENCIAMENTO DE CONTAS =====

/**
 * @route   GET /api/admin/accounts
 * @desc    Get accounts for management (Admin only) - USING PRISMA
 * @access  Private (Admin)
 */
router.get('/accounts', verifyToken, requirePermission('manage_users'), async (req, res) => {
  try {
    const { role, page = 1, limit = 20, search } = req.query;
    
    const result = await permissionService.getUsersWithPermissions({
      role,
      search,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: result.users,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('❌ Erro ao listar contas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route   POST /api/admin/accounts
 * @desc    Create new user account (Admin only) - USING PRISMA
 * @access  Private (Admin)
 */
router.post('/accounts', verifyToken, requirePermission('manage_users'), async (req, res) => {
  try {
    const { username, email, role = 'USER', accountType = 'FREE', isActive = true } = req.body;
    
    // Validações básicas
    if (!username || !email) {
      return res.status(400).json({
        success: false,
        message: 'Nome de usuário e email são obrigatórios'
      });
    }

    // Verificar se o email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Este email já está em uso'
      });
    }

    // Verificar se o username já existe
    const existingUsername = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });

    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'Este nome de usuário já está em uso'
      });
    }

    // Gerar senha temporária
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcryptjs.hash(tempPassword, 12);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash: hashedPassword,
        role,
        accountType,
        isActive
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        accountType: true,
        isActive: true,
        createdAt: true
      }
    });

    // Log da ação
    await prisma.adminLog.create({
      data: {
        adminId: req.user.id,
        action: 'CREATE_USER',
        targetType: 'user',
        targetId: user.id,
        details: JSON.stringify({
          createdUser: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          },
          tempPassword
        })
      }
    });

    res.status(201).json({
      success: true,
      message: 'Conta criada com sucesso',
      data: {
        ...user,
        tempPassword // Incluir senha temporária na resposta
      }
    });

  } catch (error) {
    console.error('❌ Erro ao criar conta:', error);
    if (error.message.includes('unique constraint')) {
      return res.status(400).json({
        success: false,
        message: 'Já existe uma conta com estes dados'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route   PUT /api/admin/accounts/:id
 * @desc    Update user account (Admin only) - USING PRISMA
 * @access  Private (Admin)
 */
router.put('/accounts/:id', verifyToken, requirePermission('manage_users'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { username, email, role, accountType, isActive } = req.body;
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'ID do usuário inválido'
      });
    }
    
    // Não permitir editar o próprio usuário para evitar problemas de permissão
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Não é possível editar sua própria conta'
      });
    }

    // Verificar se o usuário existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, role: true, email: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Não permitir editar usuários com nível igual ou superior
    const currentUserLevel = PERMISSION_LEVELS[req.user.role]?.level || 0;
    const targetUserLevel = PERMISSION_LEVELS[user.role]?.level || 0;

    if (targetUserLevel >= currentUserLevel) {
      return res.status(403).json({
        success: false,
        message: 'Não é possível editar usuário com nível igual ou superior'
      });
    }

    // Se está tentando alterar a role, verificar se o novo role é válido
    if (role && role !== user.role) {
      if (!PERMISSION_LEVELS[role]) {
        return res.status(400).json({
          success: false,
          message: 'Role inválida'
        });
      }

      // Não permitir definir role superior à própria
      const newRoleLevel = PERMISSION_LEVELS[role]?.level || 0;
      if (newRoleLevel >= currentUserLevel) {
        return res.status(403).json({
          success: false,
          message: 'Não é possível definir role igual ou superior à sua'
        });
      }
    }

    // Verificar se o email já está em uso (se foi alterado)
    if (email && email !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Este email já está em uso'
        });
      }
    }

    // Verificar se o username já está em uso (se foi alterado)
    if (username && username !== user.username) {
      const existingUser = await prisma.user.findUnique({
        where: { username },
        select: { id: true }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Este nome de usuário já está em uso'
        });
      }
    }

    // Atualizar o usuário
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(username && { username }),
        ...(email && { email }),
        ...(role && { role }),
        ...(accountType && { accountType }),
        ...(isActive !== undefined && { isActive })
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        accountType: true,
        isActive: true,
        createdAt: true,
        lastLogin: true
      }
    });

    // Log da ação
    await prisma.adminLog.create({
      data: {
        adminId: req.user.id,
        action: 'UPDATE_USER',
        targetType: 'user',
        targetId: userId,
        details: JSON.stringify({
          updatedUser: {
            id: updatedUser.id,
            username: updatedUser.username,
            role: updatedUser.role
          },
          changes: { username, email, role, accountType, isActive }
        })
      }
    });

    res.json({
      success: true,
      message: 'Conta atualizada com sucesso',
      data: updatedUser
    });

  } catch (error) {
    console.error('❌ Erro ao editar conta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route   DELETE /api/admin/accounts/:id
 * @desc    Delete user account (Admin only) - Soft delete - USING PRISMA
 * @access  Private (Admin)
 */
router.delete('/accounts/:id', verifyToken, requirePermission('manage_users'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'ID do usuário inválido'
      });
    }
    
    // Não permitir deletar o próprio usuário
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Não é possível deletar sua própria conta'
      });
    }

    // Verificar se o usuário existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, role: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Não permitir deletar usuários com nível igual ou superior
    const currentUserLevel = PERMISSION_LEVELS[req.user.role]?.level || 0;
    const targetUserLevel = PERMISSION_LEVELS[user.role]?.level || 0;

    if (targetUserLevel >= currentUserLevel) {
      return res.status(403).json({
        success: false,
        message: 'Não é possível deletar usuário com nível igual ou superior'
      });
    }

    // Deletar o usuário (soft delete)
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false }
    });

    // Log da ação
    await prisma.adminLog.create({
      data: {
        adminId: req.user.id,
        action: 'DELETE_USER',
        targetType: 'user',
        targetId: userId,
        details: JSON.stringify({
          deletedUser: {
            id: user.id,
            username: user.username,
            role: user.role
          }
        })
      }
    });

    res.json({
      success: true,
      message: 'Conta deletada com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao deletar conta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route   PUT /api/admin/accounts/:id/status
 * @desc    Toggle user account status (Admin only) - USING PRISMA
 * @access  Private (Admin)
 */
router.put('/accounts/:id/status', verifyToken, requirePermission('manage_users'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { isActive } = req.body;
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'ID do usuário inválido'
      });
    }

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Status deve ser um valor booleano'
      });
    }
    
    // Não permitir alterar o próprio usuário
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Não é possível alterar sua própria conta'
      });
    }

    // Verificar se o usuário existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, role: true, isActive: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Não permitir alterar usuários com nível igual ou superior
    const currentUserLevel = PERMISSION_LEVELS[req.user.role]?.level || 0;
    const targetUserLevel = PERMISSION_LEVELS[user.role]?.level || 0;

    if (targetUserLevel >= currentUserLevel) {
      return res.status(403).json({
        success: false,
        message: 'Não é possível alterar usuário com nível igual ou superior'
      });
    }

    // Atualizar status
    await prisma.user.update({
      where: { id: userId },
      data: { isActive }
    });

    // Log da ação
    await prisma.adminLog.create({
      data: {
        adminId: req.user.id,
        action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
        targetType: 'user',
        targetId: userId,
        details: JSON.stringify({
          user: {
            id: user.id,
            username: user.username,
            role: user.role
          },
          newStatus: isActive
        })
      }
    });

    res.json({
      success: true,
      message: `Conta ${isActive ? 'ativada' : 'desativada'} com sucesso`,
      data: { isActive }
    });

  } catch (error) {
    console.error('❌ Erro ao alterar status da conta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ===== ROTAS DE GERENCIAMENTO DE ASSETS =====

/**
 * @route   GET /api/admin/assets/stats
 * @desc    Get assets statistics - USING PRISMA
 * @access  Private (Admin)
 */
router.get('/assets/stats', verifyToken, requirePermission('view_admin_panel'), async (req, res) => {
  try {
    const [total, approved, pending, rejected, inactive] = await Promise.all([
      prisma.asset.count(),
      prisma.asset.count({ where: { isApproved: true, isActive: true } }),
      prisma.asset.count({ where: { isApproved: false, isActive: true } }),
      prisma.asset.count({ where: { isApproved: false, isActive: false } }),
      prisma.asset.count({ where: { isActive: false } })
    ]);

    res.json({
      success: true,
      data: {
        total: Number(total),
        approved: Number(approved),
        pending: Number(pending),
        rejected: Number(rejected),
        inactive: Number(inactive),
        approvalRate: total > 0 ? ((approved / total) * 100).toFixed(2) : 0
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas de assets:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route   GET /api/admin/assets/pending
 * @desc    Get assets pending approval with pagination - USING PRISMA
 * @access  Private (Admin)
 */
router.get('/assets/pending', verifyToken, requirePermission('approve_assets'), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const result = await AssetService.findPendingAssets(parseInt(page), parseInt(limit));

    res.json({
      success: true,
      data: result.assets,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('❌ Erro ao buscar assets pendentes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route   GET /api/admin/assets
 * @desc    Get all assets with filters and pagination - USING PRISMA
 * @access  Private (Admin)
 */
router.get('/assets', verifyToken, requirePermission('manage_assets'), async (req, res) => {
  try {
    const { page = 1, limit = 20, isApproved, isActive, categoryId, userId, search } = req.query;
    
    const filters = {};
    
    // Add filters if provided
    if (isApproved !== undefined) {
      filters.isApproved = isApproved === 'true';
    }
    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }
    if (categoryId) {
      filters.categoryId = parseInt(categoryId);
    }
    if (userId) {
      filters.userId = parseInt(userId);
    }
    if (search) {
      filters.OR = [
        { title: { contains: search } },
        { description: { contains: search } }
      ];
    }

    const result = await AssetService.findAssets({
      ...filters,
      page: parseInt(page),
      limit: parseInt(limit),
      isApproved: filters.isApproved, // Pode ser true, false ou undefined
      isActive: filters.isActive // Pode ser true, false ou undefined
    });

    res.json({
      success: true,
      data: result.assets,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('❌ Erro ao buscar assets:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route   GET /api/admin/assets/:id
 * @desc    Get specific asset details for admin - USING PRISMA
 * @access  Private (Admin)
 */
router.get('/assets/:id', verifyToken, requirePermission('view_admin_panel'), async (req, res) => {
  try {
    const assetId = parseInt(req.params.id);
    
    if (isNaN(assetId)) {
      return res.status(400).json({
        success: false,
        message: 'ID do asset inválido'
      });
    }

    const asset = await AssetService.findAssetById(assetId, true); // includeInactive = true para admin

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset não encontrado'
      });
    }

    res.json({
      success: true,
      data: asset
    });

  } catch (error) {
    console.error('❌ Erro ao buscar asset:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route   PUT /api/admin/assets/:id/approve
 * @desc    Approve asset (Admin only) - USING PRISMA
 * @access  Private (Admin)
 */
router.put('/assets/:id/approve', verifyToken, requirePermission('approve_assets'), async (req, res) => {
  try {
    const assetId = parseInt(req.params.id);
    
    if (isNaN(assetId)) {
      return res.status(400).json({
        success: false,
        message: 'ID do asset inválido'
      });
    }

    // Verificar se o asset existe
    const existingAsset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, title: true, isApproved: true, isActive: true }
    });

    if (!existingAsset) {
      return res.status(404).json({
        success: false,
        message: 'Asset não encontrado'
      });
    }

    if (!existingAsset.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Não é possível aprovar um asset inativo'
      });
    }

    if (existingAsset.isApproved) {
      return res.status(400).json({
        success: false,
        message: 'Asset já está aprovado'
      });
    }

    // Aprovar o asset
    await AssetService.updateApprovalStatus(assetId, true, req.user.id);

    // Clear cache after approval to show updated data
    try {
      await AdvancedCacheService.invalidateAssetsCaches();
      await AdvancedCacheService.invalidateCategoriesCache();
      console.log('Cache invalidated after asset approval');
    } catch (cacheError) {
      console.warn('Error invalidating cache after approval:', cacheError);
    }

    res.json({
      success: true,
      message: 'Asset aprovado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao aprovar asset:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route   PUT /api/admin/assets/:id/reject
 * @desc    Reject asset (Admin only) - USING PRISMA
 * @access  Private (Admin)
 */
router.put('/assets/:id/reject', verifyToken, requirePermission('approve_assets'), async (req, res) => {
  try {
    const assetId = parseInt(req.params.id);
    const { reason } = req.body;
    
    if (isNaN(assetId)) {
      return res.status(400).json({
        success: false,
        message: 'ID do asset inválido'
      });
    }

    // Verificar se o asset existe
    const existingAsset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, title: true, isApproved: true, isActive: true }
    });

    if (!existingAsset) {
      return res.status(404).json({
        success: false,
        message: 'Asset não encontrado'
      });
    }

    if (!existingAsset.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Não é possível rejeitar um asset inativo'
      });
    }

    if (!existingAsset.isApproved) {
      return res.status(400).json({
        success: false,
        message: 'Asset já está rejeitado'
      });
    }

    // Rejeitar o asset
    await AssetService.updateApprovalStatus(assetId, false, req.user.id);

    // Log com motivo da rejeição se fornecido
    if (reason) {
      await prisma.adminLog.create({
        data: {
          adminId: req.user.id,
          action: 'REJECT_ASSET_WITH_REASON',
          targetType: 'asset',
          targetId: assetId,
          details: JSON.stringify({
            assetTitle: existingAsset.title,
            rejectionReason: reason
          })
        }
      });
    }

    // Clear cache after rejection to show updated data
    try {
      await AdvancedCacheService.invalidateAssetsCaches();
      await AdvancedCacheService.invalidateCategoriesCache();
      console.log('Cache invalidated after asset rejection');
    } catch (cacheError) {
      console.warn('Error invalidating cache after rejection:', cacheError);
    }

    res.json({
      success: true,
      message: 'Asset rejeitado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao rejeitar asset:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route   DELETE /api/admin/assets/:id
 * @desc    Delete asset (Admin only) - Hard delete - USING PRISMA
 * @access  Private (Admin)
 */
router.delete('/assets/:id', verifyToken, requirePermission('delete_assets'), async (req, res) => {
  try {
    const assetId = parseInt(req.params.id);
    
    if (isNaN(assetId)) {
      return res.status(400).json({
        success: false,
        message: 'ID do asset inválido'
      });
    }

    // Verificar se o asset existe antes de tentar deletar
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, title: true, user: { select: { username: true } } }
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset não encontrado'
      });
    }

    // Permanently delete the asset using the new service method
    const result = await AssetService.deleteAsset(assetId, req.user.id);

    // Clear cache after deletion
    try {
      await AdvancedCacheService.invalidateAssetsCaches();
      await AdvancedCacheService.invalidateCategoriesCache();
      console.log('Advanced cache invalidated after asset deletion');
    } catch (cacheError) {
      console.warn('Error invalidating advanced cache:', cacheError);
    }

    res.json({
      success: true,
      message: 'Asset deletado permanentemente com sucesso',
      data: {
        deletedAsset: {
          title: result.assetTitle,
          fileName: result.fileName
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro ao deletar asset:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

module.exports = router;
