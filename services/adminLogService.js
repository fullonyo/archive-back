const { PrismaClient } = require('../generated/prisma')

const prisma = new PrismaClient()

class AdminLogService {
  // Criar log de ação administrativa
  async createAdminLog(adminId, action, targetType = null, targetId = null, details = null, ipAddress = null) {
    try {
      const log = await prisma.adminLog.create({
        data: {
          adminId,
          action,
          targetType,
          targetId,
          details,
          ipAddress
        }
      })

      console.log(`📝 Admin Log criado: ${action} por usuário ${adminId}`)
      return log

    } catch (error) {
      console.error('❌ Erro ao criar admin log:', error)
      throw error
    }
  }

  // Buscar logs com filtros
  async getAdminLogs(filters = {}) {
    try {
      const { adminId, action, targetType, page = 1, limit = 50 } = filters
      const offset = (page - 1) * limit

      const where = {}
      if (adminId) where.adminId = adminId
      if (action) where.action = action
      if (targetType) where.targetType = targetType

      const [logs, total] = await Promise.all([
        prisma.adminLog.findMany({
          where,
          include: {
            admin: {
              select: {
                id: true,
                username: true,
                email: true,
                role: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip: offset,
          take: limit
        }),
        prisma.adminLog.count({ where })
      ])

      return {
        logs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }

    } catch (error) {
      console.error('❌ Erro ao buscar admin logs:', error)
      throw error
    }
  }

  // Obter estatísticas de ações administrativas
  async getAdminLogStats(timeframe = '30d') {
    try {
      const now = new Date()
      let startDate

      switch (timeframe) {
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case '30d':
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
      }

      const [totalActions, actionsByType, activeAdmins] = await Promise.all([
        prisma.adminLog.count({
          where: {
            createdAt: {
              gte: startDate
            }
          }
        }),
        prisma.adminLog.groupBy({
          by: ['action'],
          where: {
            createdAt: {
              gte: startDate
            }
          },
          _count: {
            action: true
          },
          orderBy: {
            _count: {
              action: 'desc'
            }
          }
        }),
        prisma.adminLog.groupBy({
          by: ['adminId'],
          where: {
            createdAt: {
              gte: startDate
            }
          },
          _count: {
            adminId: true
          }
        })
      ])

      return {
        timeframe,
        totalActions,
        actionsByType: actionsByType.map(item => ({
          action: item.action,
          count: item._count.action
        })),
        activeAdmins: activeAdmins.length
      }

    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas de admin logs:', error)
      throw error
    }
  }
}

// Exportar função auxiliar para criar logs rapidamente
const createAdminLog = async (adminId, action, targetType = null, targetId = null, details = null, ipAddress = null) => {
  const service = new AdminLogService()
  return service.createAdminLog(adminId, action, targetType, targetId, details, ipAddress)
}

module.exports = {
  AdminLogService: new AdminLogService(),
  createAdminLog
}
