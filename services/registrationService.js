const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const emailService = require('./emailService');

const prisma = new PrismaClient();

class RegistrationService {
  
  // Gerar token de confirmação único
  generateConfirmationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Verificar se email já está em uso (em usuários ou registros pendentes)
  async checkEmailAvailability(email) {
    try {
      // Verificar se já existe usuário com este email
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, isActive: true, createdAt: true }
      });

      if (existingUser) {
        return {
          available: false,
          reason: 'EMAIL_ALREADY_REGISTERED',
          message: 'Este email já possui uma conta ativa',
          details: {
            registeredAt: existingUser.createdAt,
            isActive: existingUser.isActive
          }
        };
      }

      // Verificar se existe registro pendente
      const existingRegistration = await prisma.userRegistration.findUnique({
        where: { email },
        select: { 
          id: true, 
          email: true, 
          isConfirmed: true, 
          createdAt: true,
          tokenExpiresAt: true
        }
      });

      if (existingRegistration) {
        if (existingRegistration.isConfirmed) {
          return {
            available: false,
            reason: 'EMAIL_CONFIRMED_PENDING',
            message: 'Este email foi confirmado mas a conta ainda não foi criada',
            details: {
              confirmedAt: existingRegistration.createdAt
            }
          };
        }

        const isExpired = new Date() > existingRegistration.tokenExpiresAt;
        
        if (isExpired) {
          return {
            available: true,
            reason: 'REGISTRATION_EXPIRED',
            message: 'Registro anterior expirou, você pode tentar novamente',
            canRegister: true
          };
        }

        return {
          available: false,
          reason: 'PENDING_CONFIRMATION',
          message: 'Email já cadastrado aguardando confirmação',
          details: {
            registeredAt: existingRegistration.createdAt,
            expiresAt: existingRegistration.tokenExpiresAt
          },
          canResend: true
        };
      }

      return {
        available: true,
        reason: 'AVAILABLE',
        message: 'Email disponível para cadastro'
      };

    } catch (error) {
      console.error('❌ Erro ao verificar disponibilidade do email:', error);
      throw new Error('Erro ao verificar email');
    }
  }

  // Criar registro temporário
  async createPendingRegistration(data) {
    const { nickname, email, discord, password } = data;

    try {
      // Verificar disponibilidade do email com detalhes
      const emailCheck = await this.checkEmailAvailability(email);
      
      if (!emailCheck.available) {
        // Tratamento específico para cada caso
        switch (emailCheck.reason) {
          case 'EMAIL_ALREADY_REGISTERED':
            throw new Error('Este email já possui uma conta ativa. Faça login ou use a opção "Esqueci minha senha".');
            
          case 'EMAIL_CONFIRMED_PENDING':
            throw new Error('Este email foi confirmado recentemente. Aguarde alguns minutos ou entre em contato com o suporte.');
            
          case 'PENDING_CONFIRMATION':
            // Caso especial: permitir reenvio se ainda não expirou
            if (emailCheck.canResend) {
              return await this.handlePendingRegistration(email, { nickname, discord, password });
            }
            throw new Error('Este email já está cadastrado aguardando confirmação. Verifique sua caixa de entrada.');
            
          default:
            throw new Error('Este email não está disponível para cadastro.');
        }
      }

      // Se email disponível ou registro expirado, prosseguir
      if (emailCheck.reason === 'REGISTRATION_EXPIRED') {
        // Limpar registro expirado antes de criar novo
        await prisma.userRegistration.delete({
          where: { email }
        }).catch(() => {}); // Ignorar erro se não existir
      }

      // Criar novo registro pendente
      const passwordHash = await bcrypt.hash(password, 12);
      const confirmationToken = this.generateConfirmationToken();
      const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

      const registration = await prisma.userRegistration.create({
        data: {
          nickname,
          email,
          discord,
          passwordHash,
          confirmationToken,
          tokenExpiresAt
        }
      });

      // Enviar email de confirmação
      await emailService.sendConfirmationEmail(email, nickname, confirmationToken);

      console.log(`📧 Registro criado para: ${email} - Token: ${confirmationToken}`);

      return {
        id: registration.id,
        email: registration.email,
        nickname: registration.nickname,
        message: 'Email de confirmação enviado!'
      };

    } catch (error) {
      console.error('❌ Erro ao criar registro:', error);
      throw error;
    }
  }

  // Lidar com registro pendente existente
  async handlePendingRegistration(email, data) {
    const { nickname, discord, password } = data;
    
    try {
      const passwordHash = await bcrypt.hash(password, 12);
      const confirmationToken = this.generateConfirmationToken();
      const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

      const updatedRegistration = await prisma.userRegistration.update({
        where: { email },
        data: {
          nickname,
          discord,
          passwordHash,
          confirmationToken,
          tokenExpiresAt,
          createdAt: new Date() // Resetar data de criação
        }
      });

      // Enviar novo email de confirmação
      await emailService.sendConfirmationEmail(email, nickname, confirmationToken);

      console.log(`📧 Registro atualizado para: ${email} - Novo token: ${confirmationToken}`);

      return {
        id: updatedRegistration.id,
        email: updatedRegistration.email,
        nickname: updatedRegistration.nickname,
        message: 'Novo email de confirmação enviado!'
      };

    } catch (error) {
      console.error('❌ Erro ao atualizar registro pendente:', error);
      throw new Error('Erro ao atualizar registro. Tente novamente.');
    }
  }

  // Confirmar email e criar usuário final
  async confirmEmail(token) {
    try {
      // Buscar registro pelo token
      const registration = await prisma.userRegistration.findUnique({
        where: { confirmationToken: token }
      });

      if (!registration) {
        throw new Error('Token de confirmação inválido');
      }

      if (registration.isConfirmed) {
        throw new Error('Este email já foi confirmado');
      }

      if (new Date() > registration.tokenExpiresAt) {
        throw new Error('Token de confirmação expirado');
      }

      // Verificar novamente se não foi criado usuário com este email
      const existingUser = await prisma.user.findUnique({
        where: { email: registration.email }
      });

      if (existingUser) {
        throw new Error('Este email já está cadastrado');
      }

      // Criar usuário final
      const user = await prisma.user.create({
        data: {
          username: registration.nickname, // Mapear nickname para username
          email: registration.email,
          passwordHash: registration.passwordHash,
          isVerified: true, // Já verificado por email
          isActive: true,
          role: 'USER',
          accountType: 'FREE'
        }
      });

      // Marcar registro como confirmado
      await prisma.userRegistration.update({
        where: { id: registration.id },
        data: {
          isConfirmed: true,
          confirmedAt: new Date()
        }
      });

      // Enviar email de boas-vindas
      await emailService.sendWelcomeEmail(registration.email, registration.nickname);

      console.log(`✅ Usuário criado com sucesso: ${user.email} - ID: ${user.id}`);

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          isVerified: user.isVerified
        },
        message: 'Conta criada com sucesso!'
      };

    } catch (error) {
      console.error('❌ Erro ao confirmar email:', error);
      throw error;
    }
  }

  // Reenviar email de confirmação
  async resendConfirmationEmail(email) {
    try {
      const registration = await prisma.userRegistration.findUnique({
        where: { email }
      });

      if (!registration) {
        throw new Error('Registro não encontrado');
      }

      if (registration.isConfirmed) {
        throw new Error('Este email já foi confirmado');
      }

      // Gerar novo token e estender prazo
      const confirmationToken = this.generateConfirmationToken();
      const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.userRegistration.update({
        where: { email },
        data: {
          confirmationToken,
          tokenExpiresAt
        }
      });

      // Reenviar email
      await emailService.sendConfirmationEmail(email, registration.nickname, confirmationToken);

      return {
        message: 'Email de confirmação reenviado!'
      };

    } catch (error) {
      console.error('❌ Erro ao reenviar email:', error);
      throw error;
    }
  }

  // Limpar registros expirados (executar periodicamente)
  async cleanupExpiredRegistrations() {
    try {
      const result = await prisma.userRegistration.deleteMany({
        where: {
          tokenExpiresAt: {
            lt: new Date()
          },
          isConfirmed: false
        }
      });

      console.log(`🧹 Limpeza: ${result.count} registros expirados removidos`);
      return result.count;

    } catch (error) {
      console.error('❌ Erro na limpeza de registros:', error);
      throw error;
    }
  }
}

module.exports = new RegistrationService();
