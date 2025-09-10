const { prisma } = require('../config/prisma');

/**
 * User Comment Service - Sistema completo de comentários no perfil
 */
class UserCommentService {
  /**
   * Criar comentário no perfil
   * @param {Object} commentData - Dados do comentário
   * @returns {Object} Comentário criado
   */
  static async createComment(commentData) {
    try {
      const { profileUserId, authorId, parentId, content } = commentData;

      // Verificar se o perfil existe
      const profileUser = await prisma.user.findUnique({
        where: { id: profileUserId }
      });

      if (!profileUser) {
        throw new Error('Profile user not found');
      }

      // Se for reply, verificar se o comentário pai existe
      if (parentId) {
        const parentComment = await prisma.userComment.findUnique({
          where: { id: parentId }
        });

        if (!parentComment) {
          throw new Error('Parent comment not found');
        }

        // Verificar se o comentário pai pertence ao mesmo perfil
        if (parentComment.profileUserId !== profileUserId) {
          throw new Error('Parent comment does not belong to this profile');
        }
      }

      const comment = await prisma.userComment.create({
        data: {
          profileUserId,
          authorId,
          parentId,
          content: content.trim()
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              accountType: true,
              isVerified: true
            }
          },
          _count: {
            select: {
              replies: true,
              likes: true
            }
          }
        }
      });

      return comment;
    } catch (error) {
      console.error('Error creating comment:', error);
      throw error;
    }
  }

  /**
   * Obter comentários do perfil com paginação
   * @param {Object} params - Parâmetros de busca
   * @returns {Object} Comentários paginados
   */
  static async getProfileComments({ 
    profileUserId, 
    page = 1, 
    limit = 20, 
    includeHidden = false,
    requesterId = null 
  }) {
    try {
      const skip = (page - 1) * limit;
      
      // Condições de visibilidade
      const whereCondition = {
        profileUserId,
        parentId: null, // Apenas comentários de nível superior
        isApproved: true
      };

      // Se não for o dono do perfil, não mostrar comentários ocultos
      if (!includeHidden || requesterId !== profileUserId) {
        whereCondition.isVisible = true;
      }

      const [comments, total] = await Promise.all([
        prisma.userComment.findMany({
          where: whereCondition,
          include: {
            author: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                accountType: true,
                isVerified: true
              }
            },
            replies: {
              where: {
                isApproved: true,
                ...((!includeHidden || requesterId !== profileUserId) && { isVisible: true })
              },
              include: {
                author: {
                  select: {
                    id: true,
                    username: true,
                    avatarUrl: true,
                    accountType: true,
                    isVerified: true
                  }
                },
                _count: {
                  select: {
                    likes: true
                  }
                }
              },
              orderBy: { createdAt: 'asc' },
              take: 5 // Limitar replies carregados inicialmente
            },
            _count: {
              select: {
                replies: {
                  where: {
                    isApproved: true,
                    ...((!includeHidden || requesterId !== profileUserId) && { isVisible: true })
                  }
                },
                likes: true
              }
            }
          },
          skip,
          take: limit,
          orderBy: [
            { isPinned: 'desc' },
            { createdAt: 'desc' }
          ]
        }),
        prisma.userComment.count({ 
          where: whereCondition 
        })
      ]);

      // Se requesterId for fornecido, verificar quais comentários o usuário curtiu
      if (requesterId) {
        const commentIds = [
          ...comments.map(c => c.id),
          ...comments.flatMap(c => c.replies.map(r => r.id))
        ];

        const userLikes = await prisma.userCommentLike.findMany({
          where: {
            userId: requesterId,
            commentId: { in: commentIds }
          }
        });

        const likedCommentIds = new Set(userLikes.map(like => like.commentId));

        // Adicionar flag de "liked" aos comentários
        comments.forEach(comment => {
          comment.isLiked = likedCommentIds.has(comment.id);
          comment.replies.forEach(reply => {
            reply.isLiked = likedCommentIds.has(reply.id);
          });
        });
      }

      return {
        comments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting profile comments:', error);
      throw error;
    }
  }

  /**
   * Obter replies de um comentário
   * @param {Object} params - Parâmetros
   * @returns {Object} Replies paginadas
   */
  static async getCommentReplies({ 
    commentId, 
    page = 1, 
    limit = 10,
    includeHidden = false,
    requesterId = null 
  }) {
    try {
      const skip = (page - 1) * limit;

      // Verificar se o comentário pai existe
      const parentComment = await prisma.userComment.findUnique({
        where: { id: commentId }
      });

      if (!parentComment) {
        throw new Error('Comment not found');
      }

      const whereCondition = {
        parentId: commentId,
        isApproved: true
      };

      // Se não for o dono do perfil, não mostrar replies ocultas
      if (!includeHidden || requesterId !== parentComment.profileUserId) {
        whereCondition.isVisible = true;
      }

      const [replies, total] = await Promise.all([
        prisma.userComment.findMany({
          where: whereCondition,
          include: {
            author: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                accountType: true,
                isVerified: true
              }
            },
            _count: {
              select: {
                likes: true
              }
            }
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'asc' }
        }),
        prisma.userComment.count({ 
          where: whereCondition 
        })
      ]);

      // Verificar likes do usuário
      if (requesterId) {
        const replyIds = replies.map(r => r.id);
        const userLikes = await prisma.userCommentLike.findMany({
          where: {
            userId: requesterId,
            commentId: { in: replyIds }
          }
        });

        const likedReplyIds = new Set(userLikes.map(like => like.commentId));
        replies.forEach(reply => {
          reply.isLiked = likedReplyIds.has(reply.id);
        });
      }

      return {
        replies,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting comment replies:', error);
      throw error;
    }
  }

  /**
   * Atualizar visibilidade do comentário (apenas dono do perfil)
   * @param {number} commentId - ID do comentário
   * @param {number} profileUserId - ID do dono do perfil
   * @param {boolean} isVisible - Nova visibilidade
   * @returns {Object} Comentário atualizado
   */
  static async updateCommentVisibility(commentId, profileUserId, isVisible) {
    try {
      // Verificar se o comentário pertence ao perfil do usuário
      const comment = await prisma.userComment.findUnique({
        where: { id: commentId }
      });

      if (!comment) {
        throw new Error('Comment not found');
      }

      if (comment.profileUserId !== profileUserId) {
        throw new Error('Not authorized to modify this comment');
      }

      return await prisma.userComment.update({
        where: { id: commentId },
        data: { isVisible },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              accountType: true,
              isVerified: true
            }
          }
        }
      });
    } catch (error) {
      console.error('Error updating comment visibility:', error);
      throw error;
    }
  }

  /**
   * Fixar/desfixar comentário (apenas dono do perfil)
   * @param {number} commentId - ID do comentário
   * @param {number} profileUserId - ID do dono do perfil
   * @param {boolean} isPinned - Se deve fixar ou não
   * @returns {Object} Comentário atualizado
   */
  static async pinComment(commentId, profileUserId, isPinned) {
    try {
      const comment = await prisma.userComment.findUnique({
        where: { id: commentId }
      });

      if (!comment) {
        throw new Error('Comment not found');
      }

      if (comment.profileUserId !== profileUserId) {
        throw new Error('Not authorized to pin this comment');
      }

      return await prisma.userComment.update({
        where: { id: commentId },
        data: { isPinned }
      });
    } catch (error) {
      console.error('Error pinning comment:', error);
      throw error;
    }
  }

  /**
   * Curtir/descurtir comentário
   * @param {number} commentId - ID do comentário
   * @param {number} userId - ID do usuário
   * @returns {Object} Status da curtida
   */
  static async toggleCommentLike(commentId, userId) {
    try {
      // Verificar se o comentário existe
      const comment = await prisma.userComment.findUnique({
        where: { id: commentId }
      });

      if (!comment) {
        throw new Error('Comment not found');
      }

      // Verificar se já curtiu
      const existingLike = await prisma.userCommentLike.findUnique({
        where: {
          commentId_userId: {
            commentId,
            userId
          }
        }
      });

      let isLiked;
      let likesCount;

      if (existingLike) {
        // Remover curtida
        await prisma.userCommentLike.delete({
          where: { id: existingLike.id }
        });
        isLiked = false;
      } else {
        // Adicionar curtida
        await prisma.userCommentLike.create({
          data: {
            commentId,
            userId
          }
        });
        isLiked = true;
      }

      // Contar total de curtidas
      likesCount = await prisma.userCommentLike.count({
        where: { commentId }
      });

      return {
        isLiked,
        likesCount
      };
    } catch (error) {
      console.error('Error toggling comment like:', error);
      throw error;
    }
  }

  /**
   * Deletar comentário (apenas autor ou dono do perfil)
   * @param {number} commentId - ID do comentário
   * @param {number} userId - ID do usuário fazendo a requisição
   * @returns {boolean} Sucesso
   */
  static async deleteComment(commentId, userId) {
    try {
      const comment = await prisma.userComment.findUnique({
        where: { id: commentId }
      });

      if (!comment) {
        throw new Error('Comment not found');
      }

      // Verificar permissão (autor do comentário ou dono do perfil)
      if (comment.authorId !== userId && comment.profileUserId !== userId) {
        throw new Error('Not authorized to delete this comment');
      }

      await prisma.userComment.delete({
        where: { id: commentId }
      });

      return true;
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  }

  /**
   * Obter estatísticas de comentários do perfil
   * @param {number} profileUserId - ID do perfil
   * @returns {Object} Estatísticas
   */
  static async getProfileCommentStats(profileUserId) {
    try {
      const stats = await prisma.userComment.aggregate({
        where: {
          profileUserId,
          isVisible: true,
          isApproved: true
        },
        _count: {
          id: true
        }
      });

      const totalLikes = await prisma.userCommentLike.count({
        where: {
          comment: {
            profileUserId,
            isVisible: true,
            isApproved: true
          }
        }
      });

      return {
        totalComments: stats._count.id,
        totalLikes
      };
    } catch (error) {
      console.error('Error getting comment stats:', error);
      throw error;
    }
  }
}

module.exports = UserCommentService;
