const { PrismaClient } = require('@prisma/client')
const bcryptjs = require('bcryptjs')
const { createAdminLog } = require('./adminLogService')

const prisma = new PrismaClient()

class AccessRequestService {
  // Criar nova solicitação de acesso
  async createAccessRequest(data) {
    try {
      const { name, email, discord, password, reason } = data

      // Verificar se já existe uma solicitação com este email
      const existingRequest = await prisma.userAccessRequest.findUnique({
        where: { email }
      })

      if (existingRequest) {
        throw new Error('Já existe uma solicitação para este email')
      }

      // Verificar se já existe um usuário com este email
      const existingUser = await prisma.user.findUnique({
        where: { email }
      })

      if (existingUser) {
        throw new Error('Usuário já existe com este email')
      }

      // Hash da senha
      const passwordHash = await bcryptjs.hash(password, 12)

      // Criar solicitação
      const request = await prisma.userAccessRequest.create({
        data: {
          name,
          email,
          discord,
          passwordHash,
          reason,
          status: 'PENDING'
        }
      })

      console.log('✅ Solicitação de acesso criada:', request.id)
      return request

    } catch (error) {
      console.error('❌ Erro ao criar solicitação de acesso:', error)
      throw error
    }
  }

  // Listar solicitações com filtros
  async getAccessRequests(filters = {}) {
    try {
      const { status, page = 1, limit = 20 } = filters
      const offset = (page - 1) * limit

      const where = {}
      if (status && status !== 'all') {
        where.status = status.toUpperCase()
      }

      const [requests, total] = await Promise.all([
        prisma.userAccessRequest.findMany({
          where,
          include: {
            reviewer: {
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
        prisma.userAccessRequest.count({ where })
      ])

      return {
        requests,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }

    } catch (error) {
      console.error('❌ Erro ao buscar solicitações:', error)
      throw error
    }
  }

  // Obter estatísticas de solicitações
  async getAccessRequestStats() {
    try {
      const [pending, approved, rejected, total] = await Promise.all([
        prisma.userAccessRequest.count({ where: { status: 'PENDING' } }),
        prisma.userAccessRequest.count({ where: { status: 'APPROVED' } }),
        prisma.userAccessRequest.count({ where: { status: 'REJECTED' } }),
        prisma.userAccessRequest.count()
      ])

      return {
        pending,
        approved,
        rejected,
        total
      }

    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error)
      throw error
    }
  }

  // Aprovar solicitação
  async approveAccessRequest(requestId, reviewerId, userData = {}) {
    try {
      const request = await prisma.userAccessRequest.findUnique({
        where: { id: requestId }
      })

      if (!request) {
        throw new Error('Solicitação não encontrada')
      }

      if (request.status !== 'PENDING') {
        throw new Error('Solicitação já foi processada')
      }

      // Usar transação para garantir consistência
      const result = await prisma.$transaction(async (tx) => {
        // Atualizar status da solicitação
        const updatedRequest = await tx.userAccessRequest.update({
          where: { id: requestId },
          data: {
            status: 'APPROVED',
            reviewedBy: reviewerId,
            reviewedAt: new Date()
          }
        })

        // Criar usuário
        const user = await tx.user.create({
          data: {
            username: userData.username || request.name.toLowerCase().replace(/\s+/g, '_'),
            email: request.email,
            passwordHash: request.passwordHash,
            role: userData.role || 'USER',
            accountType: userData.accountType || 'FREE',
            isVerified: true,
            isActive: true
          }
        })

        // Log da ação
        await createAdminLog(reviewerId, 'APPROVE_ACCESS_REQUEST', 'UserAccessRequest', requestId, {
          newUserId: user.id,
          userEmail: user.email,
          userRole: user.role
        })

        return { request: updatedRequest, user }
      })

      console.log('✅ Solicitação aprovada e usuário criado:', result.user.id)
      return result

    } catch (error) {
      console.error('❌ Erro ao aprovar solicitação:', error)
      throw error
    }
  }

  // Rejeitar solicitação
  async rejectAccessRequest(requestId, reviewerId, rejectionReason) {
    try {
      const request = await prisma.userAccessRequest.findUnique({
        where: { id: requestId }
      })

      if (!request) {
        throw new Error('Solicitação não encontrada')
      }

      if (request.status !== 'PENDING') {
        throw new Error('Solicitação já foi processada')
      }

      const updatedRequest = await prisma.userAccessRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          rejectionReason
        }
      })

      // Log da ação
      await createAdminLog(reviewerId, 'REJECT_ACCESS_REQUEST', 'UserAccessRequest', requestId, {
        rejectionReason,
        userEmail: request.email
      })

      console.log('✅ Solicitação rejeitada:', requestId)
      return updatedRequest

    } catch (error) {
      console.error('❌ Erro ao rejeitar solicitação:', error)
      throw error
    }
  }

  // Obter detalhes de uma solicitação
  async getAccessRequestById(requestId) {
    try {
      const request = await prisma.userAccessRequest.findUnique({
        where: { id: requestId },
        include: {
          reviewer: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true
            }
          }
        }
      })

      if (!request) {
        throw new Error('Solicitação não encontrada')
      }

      return request

    } catch (error) {
      console.error('❌ Erro ao buscar solicitação:', error)
      throw error
    }
  }

  // Deletar solicitação (apenas para limpeza)
  async deleteAccessRequest(requestId, adminId) {
    try {
      const request = await prisma.userAccessRequest.findUnique({
        where: { id: requestId }
      })

      if (!request) {
        throw new Error('Solicitação não encontrada')
      }

      await prisma.userAccessRequest.delete({
        where: { id: requestId }
      })

      // Log da ação
      await createAdminLog(adminId, 'DELETE_ACCESS_REQUEST', 'UserAccessRequest', requestId, {
        userEmail: request.email,
        originalStatus: request.status
      })

      console.log('✅ Solicitação deletada:', requestId)
      return true

    } catch (error) {
      console.error('❌ Erro ao deletar solicitação:', error)
      throw error
    }
  }
}

module.exports = new AccessRequestService()
