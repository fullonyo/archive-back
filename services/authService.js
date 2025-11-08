const { prisma } = require('../config/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * Auth Service - Operações de autenticação usando Prisma
 */
class AuthService {
  // Gerar tokens JWT
  static generateTokens(userId) {
    const accessToken = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const refreshToken = jwt.sign(
      { userId },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );

    return { accessToken, refreshToken };
  }

  // Salvar refresh token no banco
  static async saveRefreshToken(userId, refreshToken) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 dias

    return await prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt
      }
    });
  }

  // Validar refresh token
  static async validateRefreshToken(token) {
    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true, // ✅ Incluir role
            accountType: true,
            isActive: true,
            avatarUrl: true // ✅ Incluir campo avatar (nome correto)
          }
        }
      }
    });

    if (!refreshToken || refreshToken.expiresAt < new Date()) {
      if (refreshToken) {
        // Remover token expirado
        await this.revokeRefreshToken(token);
      }
      return null;
    }

    if (!refreshToken.user.isActive) {
      return null;
    }

    return refreshToken;
  }

  // Revogar refresh token
  static async revokeRefreshToken(token) {
    try {
      await prisma.refreshToken.delete({
        where: { token }
      });
    } catch (error) {
      // Token já removido ou não existe
      console.log('Token not found or already removed:', error.message);
    }
  }

  // Revogar todos os tokens do usuário
  static async revokeAllUserTokens(userId) {
    return await prisma.refreshToken.deleteMany({
      where: { userId }
    });
  }

  // Limpar tokens expirados
  static async cleanExpiredTokens() {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    console.log(`🧹 Cleaned ${result.count} expired refresh tokens`);
    return result;
  }

  // Registrar novo usuário
  static async register(userData) {
    const { username, email, password } = userData;

    return await prisma.$transaction(async (tx) => {
      // Verificar se email ou username já existem
      const existingUser = await tx.user.findFirst({
        where: {
          OR: [
            { email },
            { username }
          ]
        },
        select: { email: true, username: true }
      });

      if (existingUser) {
        if (existingUser.email === email) {
          throw new Error('Email already exists');
        }
        if (existingUser.username === username) {
          throw new Error('Username already exists');
        }
      }

      // Hash da senha
      const passwordHash = await bcrypt.hash(password, 12);

      // Criar usuário
      const user = await tx.user.create({
        data: {
          username,
          email,
          passwordHash,
          accountType: 'FREE'
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true, // ✅ Incluir role
          accountType: true,
          isVerified: true,
          createdAt: true,
          avatarUrl: true // ✅ Incluir campo avatar (nome correto)
        }
      });

      // Gerar tokens
      const { accessToken, refreshToken } = this.generateTokens(user.id);

      // Salvar refresh token
      await this.saveRefreshToken(user.id, refreshToken);

      return {
        user,
        tokens: {
          accessToken,
          refreshToken
        }
      };
    });
  }

  // Login de usuário
  static async login(emailOrUsername, password) {
    // Buscar usuário por email ou username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrUsername },
          { username: emailOrUsername }
        ]
      },
      select: {
        id: true,
        username: true,
        email: true,
        passwordHash: true,
        role: true,
        accountType: true,
        isActive: true,
        isVerified: true,
        avatarUrl: true,
        bannerUrl: true,
        bio: true,
        country: true,
        city: true,
        socialLinks: true,
        createdAt: true
      }
    });

    if (!user || !user.isActive) {
      throw new Error('Invalid credentials');
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    console.log('✅ Login successful for user:', user.username);

    // Atualizar último login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Gerar tokens
    const { accessToken, refreshToken } = this.generateTokens(user.id);

    // Salvar refresh token
    await this.saveRefreshToken(user.id, refreshToken);

    // Remover senha do retorno
    const { passwordHash, ...userWithoutPassword } = user;
    
    // Parse socialLinks JSON se existir
    let parsedSocialLinks = null;
    if (userWithoutPassword.socialLinks) {
      try {
        parsedSocialLinks = JSON.parse(userWithoutPassword.socialLinks);
      } catch (error) {
        console.warn('Failed to parse socialLinks JSON:', error);
        parsedSocialLinks = null;
      }
    }

    return {
      user: {
        ...userWithoutPassword,
        socialLinks: parsedSocialLinks
      },
      tokens: {
        accessToken,
        refreshToken
      }
    };
  }

  // Logout (revogar tokens)
  static async logout(refreshToken) {
    if (refreshToken) {
      await this.revokeRefreshToken(refreshToken);
    }
    return { message: 'Logged out successfully' };
  }

  // Refresh access token
  static async refreshAccessToken(refreshToken) {
    const tokenData = await this.validateRefreshToken(refreshToken);
    
    if (!tokenData) {
      throw new Error('Invalid or expired refresh token');
    }

    // Gerar novo access token
    const accessToken = jwt.sign(
      { userId: tokenData.userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return {
      accessToken,
      user: tokenData.user
    };
  }

  // Verificar se usuário tem permissão
  static async hasPermission(userId, requiredRole) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { accountType: true, isActive: true }
    });

    if (!user || !user.isActive) {
      return false;
    }

    const roleHierarchy = {
      'FREE': 0,
      'PREMIUM': 1,
      'ADMIN': 2
    };

    const userLevel = roleHierarchy[user.accountType] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    return userLevel >= requiredLevel;
  }

  // Alterar senha
  static async changePassword(userId, currentPassword, newPassword) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verificar senha atual
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Hash da nova senha
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Atualizar senha no banco
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    });

    // Revogar todos os tokens do usuário (força re-login)
    await this.revokeAllUserTokens(userId);

    return { message: 'Password changed successfully' };
  }

  // Verificar token de acesso
  static async verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Verificar se usuário ainda existe e está ativo
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          email: true,
          role: true, // ✅ Incluir role
          accountType: true,
          isActive: true,
          isVerified: true,
          avatarUrl: true // ✅ Incluir campo avatar (nome correto)
        }
      });

      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      return user;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Estatísticas de autenticação
  static async getAuthStats() {
    const [
      totalActiveTokens,
      expiredTokens,
      recentLogins
    ] = await Promise.all([
      prisma.refreshToken.count({
        where: {
          expiresAt: { gte: new Date() }
        }
      }),
      prisma.refreshToken.count({
        where: {
          expiresAt: { lt: new Date() }
        }
      }),
      prisma.user.count({
        where: {
          lastLogin: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Últimos 7 dias
          }
        }
      })
    ]);

    return {
      totalActiveTokens,
      expiredTokens,
      recentLogins
    };
  }
}

module.exports = AuthService;
