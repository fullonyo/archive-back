const { prisma } = require('../config/prisma');

/**
 * User Service - Todas as operações relacionadas a usuários
 */
class UserService {
  // Criar novo usuário
  static async createUser(userData) {
    try {
      const user = await prisma.user.create({
        data: {
          username: userData.username,
          email: userData.email,
          passwordHash: userData.passwordHash,
          accountType: userData.accountType || 'FREE'
        },
        select: {
          id: true,
          username: true,
          email: true,
          accountType: true,
          isVerified: true,
          isActive: true,
          createdAt: true
        }
      });
      return user;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new Error('User with this email or username already exists');
      }
      throw error;
    }
  }

  // Buscar usuário por email
  static async findUserByEmail(email) {
    return await prisma.user.findUnique({
      where: { email },
      include: {
        _count: {
          select: {
            assets: true,
            downloads: true,
            favorites: true,
            reviews: true
          }
        }
      }
    });
  }

  // Buscar usuário por ID
  static async findUserById(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        accountType: true,
        avatarUrl: true,
        bannerUrl: true,
        bio: true,
        country: true,
        city: true,
        socialLinks: true,
        isVerified: true,
        isActive: true,
        createdAt: true,
        lastLogin: true
      }
    });
    
    if (!user) return null;
    
    // Parse socialLinks JSON se existir
    let parsedSocialLinks = null;
    if (user.socialLinks) {
      try {
        parsedSocialLinks = JSON.parse(user.socialLinks);
      } catch (error) {
        console.warn('Failed to parse socialLinks JSON:', error);
        parsedSocialLinks = null;
      }
    }
    
    // Convert avatarUrl to avatar for consistency with ranking endpoints
    return {
      ...user,
      avatar: user.avatarUrl,
      avatarUrl: undefined,
      socialLinks: parsedSocialLinks
    };
  }

  // Buscar usuário por username
  static async findUserByUsername(username) {
    return await prisma.user.findUnique({
      where: { username }
    });
  }

  // Verificar se email existe
  static async emailExists(email) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });
    return !!user;
  }

  // Verificar se username existe
  static async usernameExists(username) {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });
    return !!user;
  }

  // Atualizar último login
  static async updateLastLogin(userId) {
    return await prisma.user.update({
      where: { id: userId },
      data: { lastLogin: new Date() }
    });
  }

  // Atualizar perfil do usuário
  static async updateProfile(userId, profileData) {
    return await prisma.user.update({
      where: { id: userId },
      data: profileData,
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        bannerUrl: true,
        bio: true,
        country: true,
        city: true,
        socialLinks: true,
        updatedAt: true
      }
    });
  }

  // Atualizar usuário (método genérico)
  static async updateUser(userId, userData) {
    console.log('🔄 UserService: Updating user', userId, 'with data:', userData);
    
    // Converter socialLinks para JSON string se for um objeto
    const processedData = { ...userData };
    if (processedData.socialLinks && typeof processedData.socialLinks === 'object') {
      processedData.socialLinks = JSON.stringify(processedData.socialLinks);
    }
    
    const result = await prisma.user.update({
      where: { id: userId },
      data: processedData
    });
    console.log('✅ UserService: User updated successfully');
    return result;
  }

  // Soft delete usuário
  static async deactivateUser(userId) {
    return await prisma.$transaction(async (tx) => {
      // Desativar usuário
      await tx.user.update({
        where: { id: userId },
        data: { isActive: false }
      });

      // Desativar assets do usuário
      await tx.asset.updateMany({
        where: { userId },
        data: { isActive: false }
      });
    });
  }

  // Buscar usuários com paginação
  static async findUsers({ page = 1, limit = 20, search = '', accountType = null }) {
    const skip = (page - 1) * limit;
    
    const where = {
      isActive: true,
      ...(search && {
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(accountType && { accountType })
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          accountType: true,
          isVerified: true,
          createdAt: true,
          _count: {
            select: {
              assets: { where: { isActive: true } },
              downloads: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Estatísticas do usuário
  static async getUserStats(userId) {
    const stats = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        _count: {
          select: {
            assets: { where: { isActive: true } },
            reviews: true
          }
        },
        assets: {
          where: { isActive: true },
          select: {
            downloadCount: true,
            _count: {
              select: {
                favorites: true // Curtidas recebidas em cada asset
              }
            },
            reviews: {
              where: { isApproved: true },
              select: { rating: true }
            }
          }
        }
      }
    });

    if (!stats) return null;

    // Calcular rating médio
    let totalRating = 0;
    let totalReviews = 0;
    
    stats.assets.forEach(asset => {
      asset.reviews.forEach(review => {
        totalRating += review.rating;
        totalReviews++;
      });
    });

    const averageRating = totalReviews > 0 ? totalRating / totalReviews : 0;
    
    // Calcular totais
    const totalDownloads = stats.assets.reduce((sum, asset) => sum + asset.downloadCount, 0);
    const totalFavorites = stats.assets.reduce((sum, asset) => sum + asset._count.favorites, 0); // Curtidas recebidas nos assets

    return {
      totalUploads: stats._count.assets,
      totalDownloads,
      totalFavorites, // Curtidas recebidas
      totalReviews: totalReviews,
      averageRating: Number(averageRating.toFixed(1))
    };
  }

  // Ranking: Top Uploaders
  static async getTopUploaders(limit = 10) {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            assets: { where: { isActive: true } },
            downloads: true,
            favorites: true
          }
        },
        assets: {
          where: { isActive: true },
          select: {
            downloadCount: true,
            reviews: {
              where: { isApproved: true },
              select: { rating: true }
            }
          }
        }
      },
      orderBy: {
        assets: { _count: 'desc' }
      },
      take: limit
    });

    return users.map(user => ({
      id: user.id,
      username: user.username,
      avatar: user.avatarUrl,
      accountType: user.accountType,
      createdAt: user.createdAt,
      stats: {
        uploads: user._count.assets,
        downloads: user.assets.reduce((sum, asset) => sum + asset.downloadCount, 0),
        likes: user._count.favorites,
        rating: user.assets.length > 0 ? 
          user.assets.reduce((sum, asset) => {
            const avgRating = asset.reviews.length > 0 ? 
              asset.reviews.reduce((rSum, r) => rSum + r.rating, 0) / asset.reviews.length : 0;
            return sum + avgRating;
          }, 0) / user.assets.length : 0
      }
    }));
  }

  // Ranking: Top por Downloads
  static async getTopByDownloads(limit = 10) {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            assets: { where: { isActive: true } },
            downloads: true,
            favorites: true
          }
        },
        assets: {
          where: { isActive: true },
          select: {
            downloadCount: true,
            reviews: {
              where: { isApproved: true },
              select: { rating: true }
            }
          }
        }
      }
    });

    // Calcular downloads totais e ordenar
    const usersWithStats = users.map(user => {
      const totalDownloads = user.assets.reduce((sum, asset) => sum + asset.downloadCount, 0);
      return {
        id: user.id,
        username: user.username,
        avatar: user.avatarUrl,
        accountType: user.accountType,
        createdAt: user.createdAt,
        totalDownloads,
        stats: {
          uploads: user._count.assets,
          downloads: totalDownloads,
          likes: user._count.favorites,
          rating: user.assets.length > 0 ? 
            user.assets.reduce((sum, asset) => {
              const avgRating = asset.reviews.length > 0 ? 
                asset.reviews.reduce((rSum, r) => rSum + r.rating, 0) / asset.reviews.length : 0;
              return sum + avgRating;
            }, 0) / user.assets.length : 0
        }
      };
    });

    return usersWithStats
      .sort((a, b) => b.totalDownloads - a.totalDownloads)
      .slice(0, limit);
  }

  // Ranking: Top por Likes
  static async getTopByLikes(limit = 10) {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            assets: { where: { isActive: true } },
            downloads: true,
            favorites: true
          }
        },
        assets: {
          where: { isActive: true },
          select: {
            downloadCount: true,
            reviews: {
              where: { isApproved: true },
              select: { rating: true }
            }
          }
        }
      },
      orderBy: {
        favorites: { _count: 'desc' }
      },
      take: limit
    });

    return users.map(user => ({
      id: user.id,
      username: user.username,
      avatar: user.avatarUrl,
      accountType: user.accountType,
      createdAt: user.createdAt,
      stats: {
        uploads: user._count.assets,
        downloads: user.assets.reduce((sum, asset) => sum + asset.downloadCount, 0),
        likes: user._count.favorites,
        rating: user.assets.length > 0 ? 
          user.assets.reduce((sum, asset) => {
            const avgRating = asset.reviews.length > 0 ? 
              asset.reviews.reduce((rSum, r) => rSum + r.rating, 0) / asset.reviews.length : 0;
            return sum + avgRating;
          }, 0) / user.assets.length : 0
      }
    }));
  }

  // Ranking: Top por Rating
  static async getTopByRating(limit = 10) {
    const users = await prisma.user.findMany({
      where: { 
        isActive: true,
        assets: { some: { isActive: true } } // Só usuários com assets
      },
      include: {
        _count: {
          select: {
            assets: { where: { isActive: true } },
            downloads: true,
            favorites: true
          }
        },
        assets: {
          where: { isActive: true },
          select: {
            downloadCount: true,
            reviews: {
              where: { isApproved: true },
              select: { rating: true }
            }
          }
        }
      }
    });

    // Calcular rating médio e ordenar
    const usersWithRating = users.map(user => {
      let totalRating = 0;
      let totalReviews = 0;
      
      user.assets.forEach(asset => {
        asset.reviews.forEach(review => {
          totalRating += review.rating;
          totalReviews++;
        });
      });

      const averageRating = totalReviews > 0 ? totalRating / totalReviews : 0;
      
      return {
        id: user.id,
        username: user.username,
        avatar: user.avatarUrl,
        accountType: user.accountType,
        createdAt: user.createdAt,
        averageRating,
        totalReviews,
        stats: {
          uploads: user._count.assets,
          downloads: user.assets.reduce((sum, asset) => sum + asset.downloadCount, 0),
          likes: user._count.favorites,
          rating: Number(averageRating.toFixed(1))
        }
      };
    });

    return usersWithRating
      .filter(user => user.totalReviews >= 3) // Mínimo 3 reviews para aparecer no ranking
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, limit);
  }

  // Obter favoritos do usuário
  static async getUserFavorites(userId, { page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;

    const [favorites, total] = await Promise.all([
      prisma.userFavorite.findMany({
        where: { userId },
        include: {
          asset: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatarUrl: true
                }
              },
              category: {
                select: {
                  id: true,
                  name: true,
                  icon: true
                }
              },
              _count: {
                select: {
                  downloads: true,
                  favorites: true,
                  reviews: true
                }
              }
            }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.userFavorite.count({ where: { userId } })
    ]);

    return {
      favorites: favorites.map(fav => ({
        id: fav.id,
        favoriteDate: fav.createdAt,
        asset: fav.asset
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Obter assets do usuário
  static async getUserAssets(userId, { page = 1, limit = 20, includeUnapproved = false, includeInactive = false }) {
    const skip = (page - 1) * limit;

    const whereCondition = { 
      userId
    };

    // Se includeInactive for false, só mostrar assets ativos
    if (!includeInactive) {
      whereCondition.isActive = true;
    }

    // Se includeUnapproved for false, só mostrar assets aprovados
    if (!includeUnapproved) {
      whereCondition.isApproved = true;
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where: whereCondition,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              icon: true
            }
          },
          _count: {
            select: {
              downloads: true,
              favorites: true,
              reviews: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.asset.count({ 
        where: whereCondition 
      })
    ]);

    return {
      assets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = UserService;

module.exports = UserService;
