const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const emailService = require('./emailService')

const prisma = new PrismaClient()

class PasswordResetService {
  // Gerar token de reset de senha
  generateResetToken() {
    return crypto.randomBytes(32).toString('hex')
  }

  // Solicitar reset de senha
  async requestPasswordReset(email) {
    try {
      // Verificar se o usuário existe
      const user = await prisma.user.findUnique({
        where: { email }
      })

      if (!user) {
        throw new Error('Usuário não encontrado')
      }

      if (!user.isActive) {
        throw new Error('Conta inativa')
      }

      // Gerar token de reset
      const resetToken = this.generateResetToken()
      const resetTokenExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000) // 1 hora

      // Salvar token no banco
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiry
        }
      })

      // Enviar email de reset
      await emailService.sendPasswordResetEmail(user.email, user.username, resetToken)

      return {
        success: true,
        message: 'Email de redefinição de senha enviado com sucesso'
      }

    } catch (error) {
      console.error('Erro ao solicitar reset de senha:', error)
      throw error
    }
  }

  // Verificar se o token de reset é válido
  async verifyResetToken(token) {
    try {
      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: {
            gt: new Date()
          }
        }
      })

      return user
    } catch (error) {
      console.error('Erro ao verificar token de reset:', error)
      return null
    }
  }

  // Redefinir senha
  async resetPassword(token, newPassword) {
    try {
      // Verificar token
      const user = await this.verifyResetToken(token)

      if (!user) {
        throw new Error('Token inválido ou expirado')
      }

      // Hash da nova senha
      const hashedPassword = await bcrypt.hash(newPassword, 12)

      // Atualizar senha e limpar token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null
        }
      })

      // Enviar email de confirmação
      await emailService.sendPasswordChangedEmail(user.email, user.username)

      return {
        success: true,
        message: 'Senha redefinida com sucesso'
      }

    } catch (error) {
      console.error('Erro ao redefinir senha:', error)
      throw error
    }
  }

  // Limpar tokens expirados (job de limpeza)
  async cleanupExpiredTokens() {
    try {
      const result = await prisma.user.updateMany({
        where: {
          resetTokenExpiry: {
            lt: new Date()
          }
        },
        data: {
          resetToken: null,
          resetTokenExpiry: null
        }
      })

      console.log(`Limpeza: ${result.count} tokens de reset expirados removidos`)
      return result.count

    } catch (error) {
      console.error('Erro na limpeza de tokens expirados:', error)
      throw error
    }
  }
}

module.exports = new PasswordResetService()
