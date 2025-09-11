const express = require('express')
const rateLimit = require('express-rate-limit')
const router = express.Router()
const vrchatService = require('../services/vrchatService')
const { verifyToken } = require('../middleware/auth')

// Rate limiting específico para VRChat API
const vrchatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 3, // Máximo 3 tentativas por 5 minutos
  message: {
    success: false,
    message: 'Muitas tentativas de conexão VRChat. Aguarde 5 minutos antes de tentar novamente.',
    retryAfter: 300
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Middleware de autenticação para todas as rotas
router.use(verifyToken)

/**
 * @route GET /api/vrchat/test
 * @desc Testa conectividade com API VRChat (sem auth)
 * @access Private
 */
router.get('/test', async (req, res) => {
  try {
    // Testa conectividade básica com a API do VRChat
    const response = await fetch('https://api.vrchat.cloud/api/1/config', {
      headers: {
        'User-Agent': 'VRCHIEVE/2.1.3 (Archive Nyo Integration)'
      }
    })
    
    const data = await response.json()
    
    res.json({
      success: true,
      message: 'Conectividade com VRChat API testada com sucesso',
      data: {
        status: response.status,
        apiVersion: data.apiVersion || 'unknown',
        clientApiKey: data.clientApiKey ? 'present' : 'missing'
      }
    })

  } catch (error) {
    console.error('❌ Error testing VRChat API:', error)
    res.status(500).json({
      success: false,
      message: 'Erro ao testar conectividade com VRChat API',
      error: error.message
    })
  }
})

/**
 * @route POST /api/vrchat/connect
 * @desc Conecta conta VRChat do usuário
 * @access Private
 */
router.post('/connect', vrchatLimiter, async (req, res) => {
  try {
    const { username, password, twoFactorAuth } = req.body
    const userId = req.user.id

    console.log('🔍 VRChat Connect Request:')
    console.log('📧 Username/Email:', username ? `${username.substring(0, 3)}***` : 'undefined')
    console.log('🔑 Password:', password ? '[PROVIDED]' : 'undefined')
    console.log('🔐 2FA Code:', twoFactorAuth ? `${twoFactorAuth.substring(0, 2)}***` : 'null')
    console.log('👤 User ID:', userId)

    // Validação dos dados
    if (!username || !password) {
      console.log('❌ Validation failed: Missing username or password')
      return res.status(400).json({
        success: false,
        message: 'Username e password são obrigatórios'
      })
    }

    // Autentica com VRChat
    const authResult = await vrchatService.authenticateUser(username, password, twoFactorAuth)
    
    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        message: authResult.error,
        requires2FA: authResult.requires2FA || false
      })
    }

    // Extrai cookie da autenticação
    let authCookie = null
    if (authResult.authCookie) {
      authCookie = authResult.authCookie
    }

    // Salva conexão no banco (incluindo cookie se disponível)
    const connectionResult = await vrchatService.saveVRChatConnection(userId, authResult.user, authCookie)

    res.json({
      success: true,
      message: connectionResult.isNew ? 'Conta VRChat conectada com sucesso!' : 'Conta VRChat atualizada com sucesso!',
      data: {
        vrchatUser: authResult.user,
        connection: connectionResult.connection,
        isNew: connectionResult.isNew
      }
    })

  } catch (error) {
    console.error('❌ Error connecting VRChat account:', error)
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    })
  }
})

/**
 * @route GET /api/vrchat/status
 * @desc Verifica status da conexão VRChat
 * @access Private
 */
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.id

    // Busca conexão no banco
    const connection = await vrchatService.getVRChatConnection(userId)

    if (!connection) {
      return res.json({
        success: true,
        connected: false,
        message: 'Nenhuma conta VRChat conectada'
      })
    }

    res.json({
      success: true,
      connected: true,
      data: {
        vrchatUsername: connection.vrchatUsername,
        vrchatDisplayName: connection.vrchatDisplayName,
        vrchatAvatarUrl: connection.vrchatAvatarUrl,
        vrchatStatus: connection.vrchatStatus,
        lastSyncAt: connection.lastSyncAt,
        connectedAt: connection.createdAt
      }
    })

  } catch (error) {
    console.error('❌ Error getting VRChat status:', error)
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar status da conexão'
    })
  }
})

/**
 * @route DELETE /api/vrchat/disconnect
 * @desc Desconecta conta VRChat
 * @access Private
 */
router.delete('/disconnect', async (req, res) => {
  try {
    const userId = req.user.id

    // Remove conexão
    const result = await vrchatService.removeVRChatConnection(userId)

    if (result) {
      res.json({
        success: true,
        message: 'Conta VRChat desconectada com sucesso!'
      })
    } else {
      res.status(404).json({
        success: false,
        message: 'Nenhuma conexão VRChat encontrada'
      })
    }

  } catch (error) {
    console.error('❌ Error disconnecting VRChat account:', error)
    res.status(500).json({
      success: false,
      message: 'Erro ao desconectar conta VRChat'
    })
  }
})

/**
 * @route POST /api/vrchat/sync-favorites
 * @desc Sincroniza favoritos do VRChat
 * @access Private
 */
router.post('/sync-favorites', async (req, res) => {
  try {
    const userId = req.user.id
    const { authCookie } = req.body

    if (!authCookie) {
      return res.status(400).json({
        success: false,
        message: 'Cookie de autenticação é obrigatório'
      })
    }

    // Verifica se a conexão existe
    const connection = await vrchatService.getVRChatConnection(userId)
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Nenhuma conta VRChat conectada'
      })
    }

    // Sincroniza favoritos
    const syncResult = await vrchatService.syncFavorites(userId, authCookie)

    res.json({
      success: true,
      message: 'Favoritos sincronizados com sucesso!',
      data: syncResult
    })

  } catch (error) {
    console.error('❌ Error syncing favorites:', error)
    res.status(500).json({
      success: false,
      message: 'Erro ao sincronizar favoritos'
    })
  }
})

/**
 * @route GET /api/vrchat/profile
 * @desc Busca perfil do usuário no VRChat
 * @access Private
 */
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.id

    // Busca conexão no banco
    const connection = await vrchatService.getVRChatConnection(userId)

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Nenhuma conta VRChat conectada'
      })
    }

    // Retorna dados do perfil salvos
    res.json({
      success: true,
      data: {
        vrchatUserId: connection.vrchatUserId,
        vrchatUsername: connection.vrchatUsername,
        vrchatDisplayName: connection.vrchatDisplayName,
        vrchatBio: connection.vrchatBio,
        vrchatAvatarUrl: connection.vrchatAvatarUrl,
        vrchatProfilePicUrl: connection.vrchatProfilePicUrl,
        vrchatTags: connection.vrchatTags ? JSON.parse(connection.vrchatTags) : [],
        vrchatStatus: connection.vrchatStatus,
        vrchatStatusDescription: connection.vrchatStatusDescription,
        lastSyncAt: connection.lastSyncAt,
        connectedAt: connection.createdAt
      }
    })

  } catch (error) {
    console.error('❌ Error getting VRChat profile:', error)
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar perfil VRChat'
    })
  }
})

/**
 * @route GET /api/vrchat/favorites/worlds
 * @desc Busca mundos favoritos (placeholder)
 * @access Private
 */
router.get('/favorites/worlds', async (req, res) => {
  try {
    const userId = req.user.id

    // Verifica conexão
    const connection = await vrchatService.getVRChatConnection(userId)
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Nenhuma conta VRChat conectada'
      })
    }

    // Por enquanto retorna dados mockados - futuramente implementar busca real
    res.json({
      success: true,
      message: 'Funcionalidade em desenvolvimento',
      data: {
        worlds: [],
        total: 0,
        lastSync: connection.lastSyncAt
      }
    })

  } catch (error) {
    console.error('❌ Error getting favorite worlds:', error)
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar mundos favoritos'
    })
  }
})

/**
 * @route GET /api/vrchat/favorites/avatars
 * @desc Busca avatares favoritos (placeholder)
 * @access Private
 */
router.get('/favorites/avatars', async (req, res) => {
  try {
    const userId = req.user.id

    // Verifica conexão
    const connection = await vrchatService.getVRChatConnection(userId)
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Nenhuma conta VRChat conectada'
      })
    }

    // Por enquanto retorna dados mockados - futuramente implementar busca real
    res.json({
      success: true,
      message: 'Funcionalidade em desenvolvimento',
      data: {
        avatars: [],
        total: 0,
        lastSync: connection.lastSyncAt
      }
    })

  } catch (error) {
    console.error('❌ Error getting favorite avatars:', error)
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar avatares favoritos'
    })
  }
})

/**
 * @route POST /api/vrchat/update-auth
 * @desc Atualiza cookie de autenticação para conexão existente
 * @access Private
 */
router.post('/update-auth', vrchatLimiter, async (req, res) => {
  try {
    const { username, password, twoFactorAuth } = req.body
    const userId = req.user.id

    console.log('🔄 Atualizando autenticação VRChat para usuário:', userId)

    // Verifica se já existe conexão
    const connection = await vrchatService.getVRChatConnection(userId)
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Nenhuma conta VRChat conectada. Use /connect primeiro.'
      })
    }

    // Autentica novamente para obter cookie atualizado
    const authResult = await vrchatService.authenticateUser(username, password, twoFactorAuth)
    
    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        message: authResult.error,
        requires2FA: authResult.requires2FA || false
      })
    }

    // Atualiza conexão com novo cookie
    const authCookie = authResult.authCookie
    const connectionResult = await vrchatService.saveVRChatConnection(userId, authResult.user, authCookie)

    res.json({
      success: true,
      message: 'Autenticação VRChat atualizada com sucesso!',
      data: {
        hasCookie: !!authCookie,
        lastSync: connectionResult.connection.lastSyncAt
      }
    })

  } catch (error) {
    console.error('❌ Error updating VRChat auth:', error)
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    })
  }
})

/**
 * @route GET /api/vrchat/friends
 * @desc Busca lista de amigos do VRChat
 * @access Private
 */
router.get('/friends', async (req, res) => {
  try {
    const userId = req.user.id
    
    console.log('👥 Buscando amigos para usuário:', userId)
    
    // Busca conexão no banco
    const connection = await vrchatService.getVRChatConnection(userId)
    
    console.log('🔍 Conexão encontrada:', connection ? 'SIM' : 'NÃO')
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Conta VRChat não conectada'
      })
    }

    // Verifica se temos cookie de autenticação
    const authCookie = connection.authCookie
    
    if (!authCookie) {
      console.log('❌ Cookie de autenticação não encontrado, usando dados mock expandidos')
      // Fallback para dados mock expandidos se não temos cookie
      const mockFriends = [
        {
          id: 'usr_mock1',
          displayName: 'Friend Online',
          username: 'friend_online',
          status: 'online',
          statusDescription: 'Hanging out',
          location: 'wrld_4432ea9b-729c-46e3-8eaf-846aa0a37fdd:12345~friends(usr_mock1)',
          currentAvatarImageUrl: 'https://d348imysud55la.cloudfront.net/icons/default_user_icon.png',
          tags: ['system_trust_veteran', 'system_avatar_access']
        },
        {
          id: 'usr_mock2',
          displayName: 'Friend Busy',
          username: 'friend_busy',
          status: 'busy',
          statusDescription: 'Do not disturb',
          location: 'wrld_6caf5200-70ac-4b8a-aa8d-89c0d5317530:67890~public',
          currentAvatarImageUrl: 'https://d348imysud55la.cloudfront.net/icons/default_user_icon.png',
          tags: ['system_trust_known']
        },
        {
          id: 'usr_mock3',
          displayName: 'Friend Offline',
          username: 'friend_offline',
          status: 'offline',
          statusDescription: 'Last seen 2 hours ago',
          location: 'offline',
          currentAvatarImageUrl: 'https://d348imysud55la.cloudfront.net/icons/default_user_icon.png',
          tags: ['system_trust_trusted']
        },
        {
          id: 'usr_mock4',
          displayName: 'Friend Join Me',
          username: 'friend_joinme',
          status: 'join me',
          statusDescription: 'Come hang out!',
          location: 'wrld_858dfdfc-1b48-4e1e-8a43-f0edc611e5fe:11111~friends(usr_mock4)',
          currentAvatarImageUrl: 'https://d348imysud55la.cloudfront.net/icons/default_user_icon.png',
          tags: ['system_trust_veteran']
        },
        {
          id: 'usr_mock5',
          displayName: 'Friend Active',
          username: 'friend_active',
          status: 'active',
          statusDescription: 'Exploring worlds',
          location: 'wrld_ba913a96-fac4-4048-a062-9aa5db092812:22222~public',
          currentAvatarImageUrl: 'https://d348imysud55la.cloudfront.net/icons/default_user_icon.png',
          tags: ['system_trust_known']
        },
        {
          id: 'usr_mock6',
          displayName: 'Friend Ask Me',
          username: 'friend_askme',
          status: 'ask me',
          statusDescription: 'Ask before joining',
          location: 'wrld_4cf554b4-430c-4f8f-b53e-1f294eed230b:33333~invite(usr_mock6)',
          currentAvatarImageUrl: 'https://d348imysud55la.cloudfront.net/icons/default_user_icon.png',
          tags: ['system_trust_trusted']
        },
        {
          id: 'usr_mock7',
          displayName: 'Another Offline Friend',
          username: 'friend_offline2',
          status: 'offline',
          statusDescription: 'Last seen yesterday',
          location: 'offline',
          currentAvatarImageUrl: 'https://d348imysud55la.cloudfront.net/icons/default_user_icon.png',
          tags: ['system_trust_new']
        },
        {
          id: 'usr_mock8',
          displayName: 'Friend in Unknown World',
          username: 'friend_unknown',
          status: 'online',
          statusDescription: 'Somewhere new',
          location: 'wrld_1234567890abcdef-unknown-world-id:44444~public',
          currentAvatarImageUrl: 'https://d348imysud55la.cloudfront.net/icons/default_user_icon.png',
          tags: ['system_trust_known']
        }
      ]
      
      console.log('📊 Mock friends criados:', mockFriends.length, 'amigos')
      console.log('📊 Status mock:', mockFriends.map(f => ({ name: f.displayName, status: f.status })))
      
      return res.json({
        success: true,
        data: {
          friends: mockFriends,
          total: mockFriends.length,
          mock: true
        },
        message: 'Dados mock expandidos - cookie de autenticação necessário para dados reais'
      })
    }

    // Busca dados reais da API VRChat
    console.log('🔄 Buscando dados reais da API VRChat...')
    const friendsResult = await vrchatService.getFriends(authCookie)
    
    console.log('📊 Resultado da API VRChat:', {
      success: friendsResult.success,
      total: friendsResult.total,
      friendsLength: friendsResult.friends?.length,
      error: friendsResult.error
    })
    
    if (!friendsResult.success) {
      console.log('❌ Falha ao buscar amigos reais:', friendsResult.error)
      
      // Se falha, usar dados mock com mais variedade
      console.log('🔄 Fallback para dados mock expandidos...')
      const mockFriends = [
        {
          id: 'usr_mock1',
          displayName: 'Friend Online',
          username: 'friend_online',
          status: 'online',
          statusDescription: 'In The Great Pug',
          location: 'wrld_4432ea9b-729c-46e3-8eaf-846aa0a37fdd:12345~friends(usr_mock1)',
          currentAvatarImageUrl: 'https://d348imysud55la.cloudfront.net/icons/default_user_icon.png',
          tags: ['system_trust_veteran', 'system_avatar_access']
        },
        {
          id: 'usr_mock2',
          displayName: 'Friend Busy',
          username: 'friend_busy',
          status: 'busy',
          statusDescription: 'Do not disturb',
          location: 'private',
          currentAvatarImageUrl: 'https://d348imysud55la.cloudfront.net/icons/default_user_icon.png',
          tags: ['system_trust_known']
        },
        {
          id: 'usr_mock3',
          displayName: 'Friend Offline',
          username: 'friend_offline',
          status: 'offline',
          statusDescription: 'Last seen 2 hours ago',
          location: 'offline',
          currentAvatarImageUrl: 'https://d348imysud55la.cloudfront.net/icons/default_user_icon.png',
          tags: ['system_trust_trusted']
        },
        {
          id: 'usr_mock4',
          displayName: 'Friend Join Me',
          username: 'friend_joinme',
          status: 'join me',
          statusDescription: 'Come hang out!',
          location: 'wrld_5555ea9b-729c-46e3-8eaf-846aa0a37fff:67890~friends(usr_mock4)',
          currentAvatarImageUrl: 'https://d348imysud55la.cloudfront.net/icons/default_user_icon.png',
          tags: ['system_trust_veteran']
        },
        {
          id: 'usr_mock5',
          displayName: 'Friend Active',
          username: 'friend_active',
          status: 'active',
          statusDescription: 'Exploring worlds',
          location: 'wrld_7777ea9b-729c-46e3-8eaf-846aa0a37aaa:11111~public',
          currentAvatarImageUrl: 'https://d348imysud55la.cloudfront.net/icons/default_user_icon.png',
          tags: ['system_trust_known']
        }
      ]
      
      return res.json({
        success: true,
        data: {
          friends: mockFriends,
          total: mockFriends.length,
          mock: true
        },
        message: 'Dados mock expandidos - falha na API real: ' + friendsResult.error
      })
    }

    // Log dos dados reais recebidos
    if (friendsResult.friends && friendsResult.friends.length > 0) {
      console.log('👥 Primeiro amigo real recebido:', JSON.stringify(friendsResult.friends[0], null, 2))
      console.log('📊 Status dos amigos:', friendsResult.friends.map(f => ({ name: f.displayName, status: f.status })))
    }

    res.json({
      success: true,
      data: {
        friends: friendsResult.friends,
        total: friendsResult.total,
        mock: false
      },
      message: `Lista de amigos obtida com sucesso - ${friendsResult.total} amigos reais`
    })

  } catch (error) {
    console.error('❌ Error getting VRChat friends:', error)
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar lista de amigos'
    })
  }
})

/**
 * @route GET /api/vrchat/recent-worlds
 * @desc Busca mundos visitados recentemente
 * @access Private
 */
router.get('/recent-worlds', async (req, res) => {
  try {
    const userId = req.user.id
    
    console.log('🌍 Buscando mundos recentes para usuário:', userId)
    
    // Busca conexão no banco
    const connection = await vrchatService.getVRChatConnection(userId)
    
    console.log('🔍 Conexão encontrada:', connection ? 'SIM' : 'NÃO')
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Conta VRChat não conectada'
      })
    }

    // Verifica se temos cookie de autenticação
    const authCookie = connection.authCookie
    
    if (!authCookie) {
      console.log('❌ Cookie de autenticação não encontrado, usando dados mock')
      // Fallback para dados mock
      const mockRecentWorlds = [
        {
          id: 'wrld_mock1',
          name: 'Mock World 1',
          authorName: 'MockCreator',
          imageUrl: '',
          visitedAt: new Date(Date.now() - 1000 * 60 * 30),
          capacity: 16,
          description: 'Mock world data'
        }
      ]
      
      return res.json({
        success: true,
        data: {
          worlds: mockRecentWorlds,
          total: mockRecentWorlds.length,
          mock: true
        },
        message: 'Dados mock - cookie de autenticação necessário para dados reais'
      })
    }

    // Busca dados reais da API VRChat
    const worldsResult = await vrchatService.getRecentWorlds(authCookie)
    
    if (!worldsResult.success) {
      console.log('❌ Falha ao buscar mundos reais:', worldsResult.error)
      return res.status(500).json({
        success: false,
        message: worldsResult.error
      })
    }

    res.json({
      success: true,
      data: {
        worlds: worldsResult.worlds,
        total: worldsResult.total,
        mock: false
      },
      message: 'Mundos recentes obtidos com sucesso'
    })

  } catch (error) {
    console.error('❌ Error getting recent worlds:', error)
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar mundos recentes'
    })
  }
})

/**
 * @route GET /api/vrchat/stats
 * @desc Busca estatísticas da conta VRChat
 * @access Private
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id
    
    console.log('📊 Buscando estatísticas para usuário:', userId)
    
    // Busca conexão no banco
    const connection = await vrchatService.getVRChatConnection(userId)
    
    console.log('🔍 Conexão encontrada:', connection ? 'SIM' : 'NÃO')
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Conta VRChat não conectada'
      })
    }

    // Simula estatísticas (implementar quando VRChat permitir)
    const mockStats = {
      accountCreated: '2020-01-15',
      trustRank: 'Known User',
      totalFriends: 42,
      totalWorlds: 156,
      totalAvatars: 23,
      totalPhotos: 89,
      hoursPlayed: 1234,
      joinDate: connection.createdAt,
      lastLogin: new Date()
    }

    res.json({
      success: true,
      data: mockStats,
      message: 'Estatísticas obtidas com sucesso'
    })

  } catch (error) {
    console.error('❌ Error getting VRChat stats:', error)
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas'
    })
  }
})

/**
 * @route GET /api/vrchat/instances
 * @desc Busca instâncias de mundo que o usuário pode acessar
 * @access Private
 */
router.get('/instances', async (req, res) => {
  try {
    const userId = req.user.id
    const { worldId } = req.query
    
    // Busca conexão no banco
    const connection = await vrchatService.getVRChatConnection(userId)
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Conta VRChat não conectada'
      })
    }

    // Simula instâncias (implementar quando VRChat permitir)
    const mockInstances = [
      {
        id: 'instance_example1',
        world: {
          id: worldId || 'wrld_example1',
          name: 'Amazing World'
        },
        name: 'Public #1',
        type: 'public',
        region: 'us',
        userCount: 8,
        capacity: 16,
        canJoin: true
      },
      {
        id: 'instance_example2',
        world: {
          id: worldId || 'wrld_example1',
          name: 'Amazing World'
        },
        name: 'Friends+',
        type: 'friends',
        region: 'eu',
        userCount: 3,
        capacity: 8,
        canJoin: true
      }
    ]

    res.json({
      success: true,
      data: {
        instances: mockInstances,
        total: mockInstances.length
      },
      message: 'Instâncias obtidas com sucesso'
    })

  } catch (error) {
    console.error('❌ Error getting world instances:', error)
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar instâncias'
    })
  }
})

/**
 * @route GET /api/vrchat/worlds/search
 * @desc Busca mundos por nome, tags, autor
 * @access Private
 */
router.get('/worlds/search', async (req, res) => {
  try {
    const userId = req.user.id
    const { q, tag, user, n = 60, offset = 0, sort = 'popularity', order = 'descending' } = req.query
    
    console.log('🔍 Buscando mundos:', { q, tag, user, n, offset, sort, order })
    
    // Busca conexão no banco
    const connection = await vrchatService.getVRChatConnection(userId)
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Conta VRChat não conectada'
      })
    }

    const authCookie = connection.authCookie
    
    if (!authCookie) {
      // Fallback para dados mock de mundos populares
      const mockWorlds = [
        {
          id: 'wrld_mock_search_1',
          name: 'Mock Search World 1',
          authorName: 'MockCreator',
          authorId: 'usr_mock_1',
          imageUrl: 'https://via.placeholder.com/512x288/1a1a1a/ffffff?text=Mock+World+1',
          thumbnailImageUrl: 'https://via.placeholder.com/256x144/1a1a1a/ffffff?text=Mock+World+1',
          description: 'Mundo de exemplo para demonstração da busca',
          capacity: 16,
          recommendedCapacity: 8,
          favoriteCount: 1234,
          visits: 50000,
          popularity: 85,
          heat: 92,
          releaseStatus: 'public',
          tags: ['game', 'social', 'exploration'],
          created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
          updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
          publicationDate: new Date(Date.now() - 86400000 * 30).toISOString(),
          platform: 'standalonewindows'
        },
        {
          id: 'wrld_mock_search_2', 
          name: 'Mock Creative Space',
          authorName: 'AnotherCreator',
          authorId: 'usr_mock_2',
          imageUrl: 'https://via.placeholder.com/512x288/2a2a2a/ffffff?text=Creative+Space',
          thumbnailImageUrl: 'https://via.placeholder.com/256x144/2a2a2a/ffffff?text=Creative+Space',
          description: 'Espaço criativo para arte e socialização',
          capacity: 20,
          recommendedCapacity: 10,
          favoriteCount: 2567,
          visits: 125000,
          popularity: 94,
          heat: 88,
          releaseStatus: 'public',
          tags: ['art', 'creative', 'social'],
          created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
          updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
          publicationDate: new Date(Date.now() - 86400000 * 60).toISOString(),
          platform: 'standalonewindows'
        }
      ]
      
      return res.json({
        success: true,
        data: {
          worlds: mockWorlds,
          total: mockWorlds.length,
          mock: true
        },
        message: 'Dados mock - cookie de autenticação necessário para busca real'
      })
    }

    // Busca real na API VRChat
    const searchResult = await vrchatService.searchWorlds(authCookie, { q, tag, user, n, offset, sort, order })
    
    if (!searchResult.success) {
      console.log('❌ Falha ao buscar mundos:', searchResult.error)
      return res.status(500).json({
        success: false,
        message: searchResult.error
      })
    }

    console.log('✅ Mundos encontrados:', searchResult.worlds?.length || 0)

    res.json({
      success: true,
      data: {
        worlds: searchResult.worlds || [],
        total: searchResult.total || 0,
        mock: false
      },
      message: 'Mundos encontrados com sucesso'
    })

  } catch (error) {
    console.error('❌ Error searching worlds:', error)
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar mundos'
    })
  }
})

/**
 * @route GET /api/vrchat/worlds/featured
 * @desc Busca mundos em destaque
 * @access Private
 */
router.get('/worlds/featured', async (req, res) => {
  try {
    const userId = req.user.id
    
    console.log('⭐ Buscando mundos em destaque')
    
    // Busca conexão no banco
    const connection = await vrchatService.getVRChatConnection(userId)
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Conta VRChat não conectada'
      })
    }

    const authCookie = connection.authCookie
    
    if (!authCookie) {
      // Fallback para dados mock de mundos em destaque
      const mockFeaturedWorlds = [
        {
          id: 'wrld_featured_1',
          name: 'Featured Adventure World',
          authorName: 'VRChat Team',
          authorId: 'usr_vrchat',
          imageUrl: 'https://via.placeholder.com/512x288/3a3a3a/ffffff?text=Featured+World',
          thumbnailImageUrl: 'https://via.placeholder.com/256x144/3a3a3a/ffffff?text=Featured+World',
          description: 'Um mundo incrível em destaque pela equipe VRChat',
          capacity: 24,
          recommendedCapacity: 12,
          favoriteCount: 15000,
          visits: 500000,
          popularity: 98,
          heat: 97,
          releaseStatus: 'public',
          tags: ['featured', 'adventure', 'official'],
          created_at: new Date(Date.now() - 86400000 * 14).toISOString(),
          updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
          publicationDate: new Date(Date.now() - 86400000 * 14).toISOString(),
          platform: 'standalonewindows',
          featured: true
        }
      ]
      
      return res.json({
        success: true,
        data: {
          worlds: mockFeaturedWorlds,
          total: mockFeaturedWorlds.length,
          mock: true
        },
        message: 'Dados mock - cookie de autenticação necessário para dados reais'
      })
    }

    // Busca real na API VRChat
    const featuredResult = await vrchatService.getFeaturedWorlds(authCookie)
    
    if (!featuredResult.success) {
      console.log('❌ Falha ao buscar mundos em destaque:', featuredResult.error)
      return res.status(500).json({
        success: false,
        message: featuredResult.error
      })
    }

    console.log('✅ Mundos em destaque encontrados:', featuredResult.worlds?.length || 0)

    res.json({
      success: true,
      data: {
        worlds: featuredResult.worlds || [],
        total: featuredResult.total || 0,
        mock: false
      },
      message: 'Mundos em destaque encontrados com sucesso'
    })

  } catch (error) {
    console.error('❌ Error getting featured worlds:', error)
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar mundos em destaque'
    })
  }
})

/**
 * @route GET /api/vrchat/worlds/:worldId
 * @desc Busca detalhes específicos de um mundo
 * @access Private
 */
router.get('/worlds/:worldId', async (req, res) => {
  try {
    const userId = req.user.id
    const { worldId } = req.params
    
    console.log('🌍 Buscando detalhes do mundo:', worldId)
    
    // Busca conexão no banco
    const connection = await vrchatService.getVRChatConnection(userId)
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Conta VRChat não conectada'
      })
    }

    const authCookie = connection.authCookie
    
    if (!authCookie) {
      // Fallback para dados mock de mundo específico
      const mockWorldDetails = {
        id: worldId,
        name: 'Mock World Details',
        authorName: 'MockCreator',
        authorId: 'usr_mock',
        imageUrl: 'https://via.placeholder.com/512x288/4a4a4a/ffffff?text=World+Details',
        thumbnailImageUrl: 'https://via.placeholder.com/256x144/4a4a4a/ffffff?text=World+Details',
        description: 'Detalhes completos do mundo com informações mock para demonstração',
        capacity: 16,
        recommendedCapacity: 8,
        favoriteCount: 3456,
        visits: 89000,
        popularity: 91,
        heat: 85,
        releaseStatus: 'public',
        tags: ['social', 'game', 'exploration', 'hangout'],
        created_at: new Date(Date.now() - 86400000 * 45).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        publicationDate: new Date(Date.now() - 86400000 * 45).toISOString(),
        platform: 'standalonewindows',
        instances: [
          {
            id: '12345~region(us)~nonce(abc123)',
            type: 'public',
            region: 'us',
            userCount: 8,
            capacity: 16,
            full: false,
            canRequestInvite: true
          },
          {
            id: '67890~region(eu)~nonce(def456)',
            type: 'friends',
            region: 'eu', 
            userCount: 4,
            capacity: 16,
            full: false,
            canRequestInvite: false
          }
        ]
      }
      
      return res.json({
        success: true,
        data: {
          world: mockWorldDetails,
          mock: true
        },
        message: 'Dados mock - cookie de autenticação necessário para dados reais'
      })
    }

    // Busca real na API VRChat
    const worldResult = await vrchatService.getWorldDetails(authCookie, worldId)
    
    if (!worldResult.success) {
      console.log('❌ Falha ao buscar detalhes do mundo:', worldResult.error)
      return res.status(500).json({
        success: false,
        message: worldResult.error
      })
    }

    console.log('✅ Detalhes do mundo encontrados:', worldResult.world?.name || 'Unknown')

    res.json({
      success: true,
      data: {
        world: worldResult.world,
        mock: false
      },
      message: 'Detalhes do mundo encontrados com sucesso'
    })

  } catch (error) {
    console.error('❌ Error getting world details:', error)
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar detalhes do mundo'
    })
  }
})

/**
 * @route GET /api/vrchat/worlds/:worldId/instances
 * @desc Busca instâncias ativas de um mundo específico
 * @access Private
 */
router.get('/worlds/:worldId/instances', async (req, res) => {
  try {
    const userId = req.user.id
    const { worldId } = req.params
    
    console.log('🌐 Buscando instâncias do mundo:', worldId)
    
    // Busca conexão no banco
    const connection = await vrchatService.getVRChatConnection(userId)
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Conta VRChat não conectada'
      })
    }

    const authCookie = connection.authCookie
    
    if (!authCookie) {
      // Fallback para dados mock de instâncias
      const mockInstances = [
        {
          id: '12345~region(us)~nonce(abc123)',
          name: 'Public Instance #1',
          type: 'public',
          region: 'us',
          userCount: 8,
          capacity: 16,
          full: false,
          canRequestInvite: true,
          platforms: {
            standalonewindows: 5,
            android: 3
          },
          users: [
            {
              id: 'usr_example_1',
              username: 'ExampleUser1',
              displayName: 'Example User 1',
              userIcon: 'https://via.placeholder.com/256x256/4a90e2/ffffff?text=U1',
              profilePicOverride: 'https://via.placeholder.com/256x256/4a90e2/ffffff?text=U1',
              currentAvatarImageUrl: 'https://via.placeholder.com/512x512/7ed321/ffffff?text=A1',
              status: 'active',
              tags: ['system_trust_known', 'language_eng'],
              isFriend: true
            },
            {
              id: 'usr_example_2',
              username: 'ExampleUser2',
              displayName: 'Example User 2',
              userIcon: 'https://via.placeholder.com/256x256/f5a623/ffffff?text=U2',
              profilePicOverride: 'https://via.placeholder.com/256x256/f5a623/ffffff?text=U2',
              currentAvatarImageUrl: 'https://via.placeholder.com/512x512/50e3c2/ffffff?text=A2',
              status: 'join me',
              tags: ['system_trust_trusted', 'language_eng'],
              isFriend: false
            }
          ],
          friends: [
            {
              id: 'usr_friend_1',
              username: 'FriendInInstance',
              displayName: 'Friend In Instance',
              status: 'active'
            }
          ],
          shortName: 'Public #1',
          secureName: 'PublicInstance1',
          worldId: worldId,
          ownerId: 'usr_example_1',
          tags: ['public', 'social'],
          createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hora atrás
          queueEnabled: false,
          queueSize: 0
        },
        {
          id: '67890~region(eu)~nonce(def456)',
          name: 'Friends Only Instance',
          type: 'friends',
          region: 'eu',
          userCount: 4,
          capacity: 16,
          full: false,
          canRequestInvite: false,
          platforms: {
            standalonewindows: 3,
            android: 1
          },
          users: [],
          friends: [
            {
              id: 'usr_friend_2',
              username: 'BestFriend',
              displayName: 'Best Friend',
              status: 'active'
            },
            {
              id: 'usr_friend_3',
              username: 'AnotherFriend',
              displayName: 'Another Friend',
              status: 'join me'
            }
          ],
          shortName: 'Friends #1',
          secureName: 'FriendsInstance1',
          worldId: worldId,
          ownerId: 'usr_friend_2',
          tags: ['friends', 'private'],
          createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 horas atrás
          queueEnabled: false,
          queueSize: 0
        },
        {
          id: '11111~region(us)~nonce(ghi789)',
          name: 'Invite Only VIP',
          type: 'invite',
          region: 'us',
          userCount: 12,
          capacity: 16,
          full: false,
          canRequestInvite: true,
          platforms: {
            standalonewindows: 8,
            android: 2,
            queststandalone: 2
          },
          users: [],
          friends: [],
          shortName: 'VIP Invite',
          secureName: 'VIPInviteInstance',
          worldId: worldId,
          ownerId: 'usr_vip_owner',
          tags: ['invite', 'vip', 'event'],
          createdAt: new Date(Date.now() - 1800000).toISOString(), // 30 min atrás
          queueEnabled: true,
          queueSize: 3
        }
      ]
      
      return res.json({
        success: true,
        data: {
          instances: mockInstances,
          total: mockInstances.length,
          mock: true
        },
        message: 'Dados mock - cookie de autenticação necessário para instâncias reais'
      })
    }

    // Busca real na API VRChat
    const instancesResult = await vrchatService.getWorldInstances(authCookie, worldId)
    
    if (!instancesResult.success) {
      console.log('❌ Falha ao buscar instâncias:', instancesResult.error)
      return res.status(500).json({
        success: false,
        message: instancesResult.error
      })
    }

    console.log('✅ Instâncias encontradas:', instancesResult.instances?.length || 0)

    res.json({
      success: true,
      data: {
        instances: instancesResult.instances || [],
        total: instancesResult.total || 0,
        mock: false
      }
    })

  } catch (error) {
    console.error('❌ Erro ao buscar instâncias do mundo:', error)
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    })
  }
})

module.exports = router
