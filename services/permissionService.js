const { PrismaClient } = require('@prisma/client')
const { createAdminLog } = require('./adminLogService')

const prisma = new PrismaClient()

// Definir permissões por role (igual ao frontend)
const PERMISSION_LEVELS = {
  SISTEMA: {
    id: 'SISTEMA',
    level: 100,
    permissions: [
      'manage_users', 'approve_users', 'ban_users', 'view_user_details',
      'manage_assets', 'approve_assets', 'delete_assets', 'moderate_assets',
      'manage_categories', 'create_categories', 'delete_categories',
      'manage_permissions', 'view_admin_panel', 'view_analytics', 'manage_settings',
      'upload_assets', 'upload_premium', 'moderate_comments', 'moderate_reports'
    ]
  },
  ADMIN: {
    id: 'ADMIN',
    level: 90,
    permissions: [
      'manage_users', 'approve_users', 'ban_users', 'view_user_details',
      'manage_assets', 'approve_assets', 'delete_assets', 'moderate_assets',
      'manage_categories', 'create_categories', 'delete_categories',
      'view_admin_panel', 'view_analytics', 'manage_settings',
      'upload_assets', 'upload_premium', 'moderate_comments', 'moderate_reports'
    ]
  },
  MODERATOR: {
    id: 'MODERATOR',
    level: 80,
    permissions: [
      'view_user_details', 'moderate_assets', 'approve_assets',
      'view_admin_panel', 'upload_assets', 'moderate_comments', 'moderate_reports'
    ]
  },
  CREATOR: {
    id: 'CREATOR',
    level: 70,
    permissions: ['upload_assets', 'upload_premium']
  },
  USER: {
    id: 'USER',
    level: 10,
    permissions: ['upload_assets']
  }
}

class PermissionService {
  // Obter permissões de um usuário
  async getUserPermissions(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          permissions: true
        }
      })

      if (!user) {
        throw new Error('Usuário não encontrado')
      }

      // Permissões baseadas no role
      const rolePermissions = PERMISSION_LEVELS[user.role]?.permissions || []
      
      // Permissões específicas (override)
      const specificPermissions = user.permissions.map(p => p.permission)

      // Combinar permissões (role + específicas)
      const allPermissions = [...new Set([...rolePermissions, ...specificPermissions])]

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        rolePermissions,
        specificPermissions,
        allPermissions,
        level: PERMISSION_LEVELS[user.role]?.level || 0
      }

    } catch (error) {
      console.error('❌ Erro ao buscar permissões do usuário:', error)
      throw error
    }
  }

  // Verificar se usuário tem permissão específica
  async hasPermission(userId, permission) {
    try {
      const userPermissions = await this.getUserPermissions(userId)
      return userPermissions.allPermissions.includes(permission)
    } catch (error) {
      console.error('❌ Erro ao verificar permissão:', error)
      return false
    }
  }

  // Verificar se usuário tem nível mínimo
  async hasMinimumLevel(userId, requiredRole) {
    try {
      const userPermissions = await this.getUserPermissions(userId)
      const requiredLevel = PERMISSION_LEVELS[requiredRole]?.level || 0
      return userPermissions.level >= requiredLevel
    } catch (error) {
      console.error('❌ Erro ao verificar nível:', error)
      return false
    }
  }

  // Conceder permissão específica a um usuário
  async grantPermission(userId, permission, grantedBy) {
    try {
      // Verificar se quem está concedendo tem permissão para isso
      const canManagePermissions = await this.hasPermission(grantedBy, 'manage_permissions')
      if (!canManagePermissions) {
        throw new Error('Sem permissão para gerenciar permissões')
      }

      // Verificar se já tem a permissão
      const existingPermission = await prisma.userPermission.findUnique({
        where: {
          unique_user_permission: {
            userId,
            permission
          }
        }
      })

      if (existingPermission) {
        throw new Error('Usuário já possui esta permissão')
      }

      const userPermission = await prisma.userPermission.create({
        data: {
          userId,
          permission,
          grantedBy
        }
      })

      // Log da ação
      await createAdminLog(grantedBy, 'GRANT_PERMISSION', 'UserPermission', userPermission.id, {
        userId,
        permission
      })

      console.log(`✅ Permissão ${permission} concedida ao usuário ${userId}`)
      return userPermission

    } catch (error) {
      console.error('❌ Erro ao conceder permissão:', error)
      throw error
    }
  }

  // Remover permissão específica de um usuário
  async revokePermission(userId, permission, revokedBy) {
    try {
      // Verificar se quem está revogando tem permissão para isso
      const canManagePermissions = await this.hasPermission(revokedBy, 'manage_permissions')
      if (!canManagePermissions) {
        throw new Error('Sem permissão para gerenciar permissões')
      }

      const userPermission = await prisma.userPermission.findUnique({
        where: {
          unique_user_permission: {
            userId,
            permission
          }
        }
      })

      if (!userPermission) {
        throw new Error('Usuário não possui esta permissão específica')
      }

      await prisma.userPermission.delete({
        where: {
          id: userPermission.id
        }
      })

      // Log da ação
      await createAdminLog(revokedBy, 'REVOKE_PERMISSION', 'UserPermission', userPermission.id, {
        userId,
        permission
      })

      console.log(`✅ Permissão ${permission} removida do usuário ${userId}`)
      return true

    } catch (error) {
      console.error('❌ Erro ao remover permissão:', error)
      throw error
    }
  }

  // Alterar role de um usuário
  async changeUserRole(userId, newRole, changedBy) {
    try {
      // Verificar se quem está alterando tem permissão para isso
      const canManageUsers = await this.hasPermission(changedBy, 'manage_users')
      if (!canManageUsers) {
        throw new Error('Sem permissão para gerenciar usuários')
      }

      // Verificar se o novo role é válido
      if (!PERMISSION_LEVELS[newRole]) {
        throw new Error('Role inválido')
      }

      const user = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        throw new Error('Usuário não encontrado')
      }

      const oldRole = user.role

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: newRole }
      })

      // Log da ação
      await createAdminLog(changedBy, 'CHANGE_USER_ROLE', 'User', userId, {
        oldRole,
        newRole,
        userEmail: user.email
      })

      console.log(`✅ Role do usuário ${userId} alterado de ${oldRole} para ${newRole}`)
      return updatedUser

    } catch (error) {
      console.error('❌ Erro ao alterar role do usuário:', error)
      throw error
    }
  }

  // Listar usuários com suas permissões
  async getUsersWithPermissions(filters = {}) {
    try {
      const { role, search, page = 1, limit = 20 } = filters
      const offset = (page - 1) * limit

      const where = { isActive: true }
      
      if (role && role !== 'all') {
        where.role = role
      }

      // Add search filter
      if (search) {
        where.OR = [
          { username: { contains: search } },
          { email: { contains: search } }
        ]
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            accountType: true,
            isVerified: true,
            isActive: true,
            createdAt: true,
            lastLogin: true,
            permissions: {
              select: {
                permission: true,
                grantedAt: true,
                granter: {
                  select: {
                    username: true
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip: offset,
          take: limit
        }),
        prisma.user.count({ where })
      ])

      // Adicionar permissões calculadas
      const usersWithCalculatedPermissions = users.map(user => {
        const rolePermissions = PERMISSION_LEVELS[user.role]?.permissions || []
        const specificPermissions = user.permissions.map(p => p.permission)
        const allPermissions = [...new Set([...rolePermissions, ...specificPermissions])]

        return {
          ...user,
          rolePermissions,
          specificPermissions,
          allPermissions,
          level: PERMISSION_LEVELS[user.role]?.level || 0
        }
      })

      return {
        users: usersWithCalculatedPermissions,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }

    } catch (error) {
      console.error('❌ Erro ao listar usuários com permissões:', error)
      throw error
    }
  }
}

module.exports = new PermissionService()
module.exports.PERMISSION_LEVELS = PERMISSION_LEVELS
