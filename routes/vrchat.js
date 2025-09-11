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

    // Salva conexão no banco
    const connectionResult = await vrchatService.saveVRChatConnection(userId, authResult.user)

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

module.exports = router
