const axios = require('axios')
const { PrismaClient } = require('@prisma/client')

class VRChatService {
  constructor() {
    // Inicializa Prisma com verificação
    try {
      this.prisma = new PrismaClient()
      console.log('✅ VRChat Service: Prisma client initialized')
    } catch (error) {
      console.error('❌ VRChat Service: Failed to initialize Prisma client:', error)
      this.prisma = null
    }
    
    this.baseURL = 'https://api.vrchat.cloud/api/1'
    this.userAgent = 'VRCHIEVE/2.1.3 (Archive Nyo Integration)'
    this.lastRequestTime = 0
    this.minDelayBetweenRequests = 15000 // 15 segundos entre requests
    this.rateLimitRetryDelay = 30000 // 30 segundos para rate limit
    
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      headers: {
        'User-Agent': this.userAgent,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    })

    // Interceptor para logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        console.log(`🔗 VRChat API Request: ${config.method?.toUpperCase()} ${config.url}`)
        console.log(`🔑 Headers:`, Object.keys(config.headers || {}))
        return config
      },
      (error) => {
        console.error('❌ VRChat API Request Error:', error)
        return Promise.reject(error)
      }
    )

    this.axiosInstance.interceptors.response.use(
      (response) => {
        console.log(`✅ VRChat API Response: ${response.status} ${response.config.url}`)
        return response
      },
      (error) => {
        console.error(`❌ VRChat API Response Error: ${error.response?.status} ${error.config?.url}`)
        return Promise.reject(error)
      }
    )
  }

  async waitForRateLimit() {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    
    if (timeSinceLastRequest < this.minDelayBetweenRequests) {
      const waitTime = this.minDelayBetweenRequests - timeSinceLastRequest
      console.log(`⏳ Aguardando ${Math.round(waitTime/1000)}s para evitar rate limiting...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
    
    this.lastRequestTime = Date.now()
  }

  /**
   * Autentica usuário no VRChat usando o método oficial com cookies
   */
  async authenticateUser(username, password, twoFactorAuth = null, retryCount = 0) {
    const maxRetries = 2
    
    try {
      // Aguarda para evitar rate limiting
      await this.waitForRateLimit()
      
      // Log do tipo de credencial (email vs username)
      const isEmail = username.includes('@')
      console.log(`🔐 VRChat Auth: Using ${isEmail ? 'EMAIL' : 'USERNAME'} - ${username.substring(0, 3)}***`)
      
      // Codifica credenciais em base64
      const credentials = Buffer.from(`${username}:${password}`).toString('base64')
      
      // PASSO 1: Login inicial para obter cookie e detectar 2FA
      const initialResponse = await this.axiosInstance.get('/auth/user', {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      })
      
      console.log('🔍 VRChat Initial Response:', JSON.stringify(initialResponse.data, null, 2))
      
      // Extrai cookie da resposta
      const setCookieHeader = initialResponse.headers['set-cookie']
      let authCookie = null
      
      if (setCookieHeader) {
        const authCookieMatch = setCookieHeader.find(cookie => cookie.startsWith('auth='))
        if (authCookieMatch) {
          authCookie = authCookieMatch.split(';')[0] // Pega só a parte "auth=valor"
          console.log('🍪 Cookie extraído para 2FA')
        }
      }
      
      // Verifica se precisa de 2FA
      if (initialResponse.data.requiresTwoFactorAuth) {
        console.log('🔐 VRChat requires 2FA authentication:', initialResponse.data.requiresTwoFactorAuth)
        
        // Se não temos código 2FA, retorna para solicitar
        if (!twoFactorAuth) {
          return {
            success: false,
            requires2FA: true,
            twoFAType: initialResponse.data.requiresTwoFactorAuth,
            error: 'Código de verificação necessário',
            authCookie: authCookie // Salva cookie para próxima tentativa
          }
        }
        
        // Se temos código 2FA, verifica
        if (twoFactorAuth && authCookie) {
          console.log(`🔐 Verificando código 2FA: ${twoFactorAuth}`)
          
          try {
            // PASSO 2: Verificação 2FA com método oficial
            const twoFAResponse = await this.axiosInstance.post('/auth/twofactorauth/emailotp/verify', {
              code: twoFactorAuth
            }, {
              headers: {
                'Cookie': authCookie
              }
            })
            
            console.log('✅ Resposta 2FA:', JSON.stringify(twoFAResponse.data, null, 2))
            
            if (twoFAResponse.data.verified === true) {
              // Aguarda um pouco após verificação
              await new Promise(resolve => setTimeout(resolve, 2000))
              
              // PASSO 3: Busca dados completos do usuário
              const finalResponse = await this.axiosInstance.get('/auth/user', {
                headers: {
                  'Cookie': authCookie
                }
              })
              
              console.log('✅ Dados finais do usuário obtidos!')
              
              if (finalResponse.data.id) {
                return {
                  success: true,
                  user: finalResponse.data,
                  authCookie: authCookie,
                  message: 'Autenticação VRChat completada com sucesso!'
                }
              } else {
                return {
                  success: false,
                  requires2FA: true,
                  twoFAType: initialResponse.data.requiresTwoFactorAuth,
                  error: 'Falha ao obter dados do usuário após 2FA'
                }
              }
            } else {
              return {
                success: false,
                requires2FA: true,
                twoFAType: initialResponse.data.requiresTwoFactorAuth,
                error: 'Código de verificação inválido ou expirado'
              }
            }
            
          } catch (twoFAError) {
            console.log('❌ Erro na verificação 2FA:', twoFAError.response?.data || twoFAError.message)
            return {
              success: false,
              requires2FA: true,
              twoFAType: initialResponse.data.requiresTwoFactorAuth,
              error: 'Código de verificação inválido ou expirado'
            }
          }
        } else {
          return {
            success: false,
            requires2FA: true,
            twoFAType: initialResponse.data.requiresTwoFactorAuth,
            error: 'Cookie não disponível para verificação 2FA'
          }
        }
      }
      
      // Se chegou aqui, login bem-sucedido sem 2FA
      if (initialResponse.data.id) {
        // Extrai cookie se disponível
        const setCookieHeader = initialResponse.headers['set-cookie']
        let authCookie = null
        
        if (setCookieHeader) {
          const authCookieMatch = setCookieHeader.find(cookie => cookie.startsWith('auth='))
          if (authCookieMatch) {
            authCookie = authCookieMatch.split(';')[0]
          }
        }
        
        return {
          success: true,
          user: initialResponse.data,
          authCookie: authCookie,
          message: 'Autenticação VRChat completada com sucesso!'
        }
      } else {
        return {
          success: false,
          error: 'Falha na autenticação VRChat'
        }
      }
      
    } catch (error) {
      console.error('❌ VRChat authentication failed:', error.message)
      
      // Rate limiting - com delays maiores
      if (error.response?.status === 429) {
        if (retryCount < maxRetries) {
          const waitTime = this.rateLimitRetryDelay + (retryCount * 10000) // 30s, 40s, 50s
          console.log(`⏳ Rate limited. Aguardando ${Math.round(waitTime/1000)}s antes de retry (tentativa ${retryCount + 1}/${maxRetries + 1})`)
          
          await new Promise(resolve => setTimeout(resolve, waitTime))
          return this.authenticateUser(username, password, twoFactorAuth, retryCount + 1)
        } else {
          // Máximo de retries atingido
          return {
            success: false,
            error: 'Muitas tentativas falharam devido a rate limiting. Aguarde alguns minutos antes de tentar novamente.',
            rateLimited: true
          }
        }
      }
      
      if (error.response?.status === 401) {
        return {
          success: false,
          error: 'Credenciais inválidas. Verifique seu email/username e senha.'
        }
      }

      return {
        success: false,
        error: `Erro na autenticação VRChat: ${error.message}`
      }
    }
  }

  /**
   * Salva conexão VRChat no banco de dados
   */
  async saveVRChatConnection(userId, vrchatData, authCookie = null) {
    try {
      // Garante que Prisma está disponível
      if (!this.prisma) {
        console.log('🔄 Creating temporary Prisma client...')
        const { PrismaClient } = require('@prisma/client')
        this.prisma = new PrismaClient()
      }
      
      // Verifica se já existe uma conexão
      const existingConnection = await this.prisma.vRChatConnection.findUnique({
        where: { userId: userId }
      })

      const connectionData = {
        vrchatUserId: vrchatData.id,
        vrchatUsername: vrchatData.username || vrchatData.displayName,
        vrchatDisplayName: vrchatData.displayName,
        vrchatBio: vrchatData.bio || '',
        vrchatAvatarUrl: vrchatData.currentAvatarImageUrl || vrchatData.currentAvatarThumbnailImageUrl || '',
        vrchatProfilePicUrl: vrchatData.profilePicOverride || '',
        vrchatTags: JSON.stringify(vrchatData.tags || []),
        vrchatStatus: vrchatData.status || 'offline',
        vrchatStatusDescription: vrchatData.statusDescription || '',
        authCookie: authCookie,
        lastSyncAt: new Date()
      }

      if (existingConnection) {
        // Atualiza conexão existente
        const updated = await this.prisma.vRChatConnection.update({
          where: { userId: userId },
          data: connectionData
        })

        return {
          connection: updated,
          isNew: false
        }
      } else {
        // Cria nova conexão
        const created = await this.prisma.vRChatConnection.create({
          data: {
            userId: userId,
            ...connectionData
          }
        })

        return {
          connection: created,
          isNew: true
        }
      }

    } catch (error) {
      console.error('❌ Error saving VRChat connection:', error)
      throw new Error('Erro ao salvar conexão VRChat')
    }
  }

  /**
   * Busca conexão VRChat do usuário
   */
  async getVRChatConnection(userId) {
    try {
      console.log('🔍 Getting VRChat connection for user:', userId)
      console.log('🔍 Current prisma state:', this.prisma ? 'AVAILABLE' : 'NULL')
      
      // Garante que Prisma está disponível
      if (!this.prisma) {
        console.log('🔄 Creating temporary Prisma client for getVRChatConnection...')
        const { PrismaClient } = require('@prisma/client')
        this.prisma = new PrismaClient()
        console.log('✅ Prisma client created:', this.prisma ? 'SUCCESS' : 'FAILED')
      }
      
      // Verificação dupla
      if (!this.prisma) {
        console.error('❌ Prisma client is still null after creation attempt')
        return null
      }
      
      console.log('🔍 Prisma client available, checking model...')
      console.log('🔍 VRChat model available:', this.prisma.vRChatConnection ? 'YES' : 'NO')
      
      if (!this.prisma.vRChatConnection) {
        console.error('❌ vRChatConnection model not available in Prisma client')
        return null
      }
      
      const connection = await this.prisma.vRChatConnection.findUnique({
        where: { userId: userId }
      })

      console.log('✅ VRChat connection query completed')
      return connection
    } catch (error) {
      console.error('❌ Error getting VRChat connection:', error)
      return null
    }
  }

  /**
   * Remove conexão VRChat
   */
  async removeVRChatConnection(userId) {
    try {
      // Garante que Prisma está disponível
      if (!this.prisma) {
        console.log('🔄 Creating temporary Prisma client for removeVRChatConnection...')
        const { PrismaClient } = require('@prisma/client')
        this.prisma = new PrismaClient()
      }
      
      const deleted = await this.prisma.vRChatConnection.delete({
        where: { userId: userId }
      })

      return deleted ? true : false
    } catch (error) {
      if (error.code === 'P2025') {
        // Registro não encontrado
        return false
      }
      console.error('❌ Error removing VRChat connection:', error)
      throw new Error('Erro ao remover conexão VRChat')
    }
  }

  /**
   * Busca dados reais da API do VRChat usando cookies de autenticação
   */
  async makeAuthenticatedRequest(endpoint, authCookie) {
    try {
      await this.waitForRateLimit()
      
      const response = await this.axiosInstance.get(endpoint, {
        headers: {
          'Cookie': authCookie
        }
      })
      
      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      console.error(`❌ VRChat API Error for ${endpoint}:`, error.response?.data || error.message)
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        status: error.response?.status
      }
    }
  }

  /**
   * Busca lista de amigos reais do VRChat
   */
  async getFriends(authCookie) {
    try {
      console.log('👥 Fetching real friends list from VRChat API...')
      
      const result = await this.makeAuthenticatedRequest('/auth/user/friends', authCookie)
      
      if (!result.success) {
        console.log('❌ Failed to fetch friends:', result.error)
        return {
          success: false,
          error: result.error,
          friends: []
        }
      }
      
      console.log('✅ Friends fetched successfully:', result.data?.length || 0, 'friends')
      
      return {
        success: true,
        friends: result.data || [],
        total: result.data?.length || 0
      }
    } catch (error) {
      console.error('❌ Error fetching friends:', error)
      return {
        success: false,
        error: 'Erro ao buscar lista de amigos',
        friends: []
      }
    }
  }

  /**
   * Busca lista de amigos online
   */
  async getOnlineFriends(authCookie) {
    try {
      console.log('🟢 Fetching online friends from VRChat API...')
      
      const result = await this.makeAuthenticatedRequest('/auth/user/friends?offline=false', authCookie)
      
      if (!result.success) {
        console.log('❌ Failed to fetch online friends:', result.error)
        return {
          success: false,
          error: result.error,
          friends: []
        }
      }
      
      console.log('✅ Online friends fetched successfully:', result.data?.length || 0, 'online')
      
      return {
        success: true,
        friends: result.data || [],
        total: result.data?.length || 0
      }
    } catch (error) {
      console.error('❌ Error fetching online friends:', error)
      return {
        success: false,
        error: 'Erro ao buscar amigos online',
        friends: []
      }
    }
  }

  /**
   * Busca mundos favoritos reais
   */
  async getFavoriteWorlds(authCookie) {
    try {
      console.log('🌍 Fetching favorite worlds from VRChat API...')
      
      const result = await this.makeAuthenticatedRequest('/favorites?type=world', authCookie)
      
      if (!result.success) {
        console.log('❌ Failed to fetch favorite worlds:', result.error)
        return {
          success: false,
          error: result.error,
          worlds: []
        }
      }
      
      console.log('✅ Favorite worlds fetched successfully:', result.data?.length || 0, 'worlds')
      
      return {
        success: true,
        worlds: result.data || [],
        total: result.data?.length || 0
      }
    } catch (error) {
      console.error('❌ Error fetching favorite worlds:', error)
      return {
        success: false,
        error: 'Erro ao buscar mundos favoritos',
        worlds: []
      }
    }
  }

  /**
   * Busca avatares favoritos reais
   */
  async getFavoriteAvatars(authCookie) {
    try {
      console.log('👤 Fetching favorite avatars from VRChat API...')
      
      const result = await this.makeAuthenticatedRequest('/favorites?type=avatar', authCookie)
      
      if (!result.success) {
        console.log('❌ Failed to fetch favorite avatars:', result.error)
        return {
          success: false,
          error: result.error,
          avatars: []
        }
      }
      
      console.log('✅ Favorite avatars fetched successfully:', result.data?.length || 0, 'avatars')
      
      return {
        success: true,
        avatars: result.data || [],
        total: result.data?.length || 0
      }
    } catch (error) {
      console.error('❌ Error fetching favorite avatars:', error)
      return {
        success: false,
        error: 'Erro ao buscar avatares favoritos',
        avatars: []
      }
    }
  }

  /**
   * Busca mundos visitados recentemente
   */
  async getRecentWorlds(authCookie) {
    try {
      console.log('🕒 Fetching recent worlds from VRChat API...')
      
      const result = await this.makeAuthenticatedRequest('/worlds/recent', authCookie)
      
      if (!result.success) {
        console.log('❌ Failed to fetch recent worlds:', result.error)
        return {
          success: false,
          error: result.error,
          worlds: []
        }
      }
      
      console.log('✅ Recent worlds fetched successfully:', result.data?.length || 0, 'worlds')
      
      return {
        success: true,
        worlds: result.data || [],
        total: result.data?.length || 0
      }
    } catch (error) {
      console.error('❌ Error fetching recent worlds:', error)
      return {
        success: false,
        error: 'Erro ao buscar mundos recentes',
        worlds: []
      }
    }
  }

  /**
   * Busca perfil atual do usuário
   */
  async getCurrentUser(authCookie) {
    try {
      console.log('👤 Fetching current user from VRChat API...')
      
      const result = await this.makeAuthenticatedRequest('/auth/user', authCookie)
      
      if (!result.success) {
        console.log('❌ Failed to fetch current user:', result.error)
        return {
          success: false,
          error: result.error,
          user: null
        }
      }
      
      console.log('✅ Current user fetched successfully')
      
      return {
        success: true,
        user: result.data
      }
    } catch (error) {
      console.error('❌ Error fetching current user:', error)
      return {
        success: false,
        error: 'Erro ao buscar dados do usuário',
        user: null
      }
    }
  }

  /**
   * Salva cookie de autenticação para uso em requests futuros
   */
  async saveAuthCookie(userId, authCookie) {
    try {
      // Garante que Prisma está disponível
      if (!this.prisma) {
        console.log('🔄 Creating temporary Prisma client for saveAuthCookie...')
        const { PrismaClient } = require('@prisma/client')
        this.prisma = new PrismaClient()
      }
      
      // Atualiza ou cria registro com cookie
      const updated = await this.prisma.vRChatConnection.update({
        where: { userId: userId },
        data: {
          authCookie: authCookie,
          lastSyncAt: new Date()
        }
      })

      console.log('✅ Auth cookie saved successfully')
      return updated
    } catch (error) {
      console.error('❌ Error saving auth cookie:', error)
      throw new Error('Erro ao salvar cookie de autenticação')
    }
  }

  /**
   * Busca cookie de autenticação salvo
   */
  async getAuthCookie(userId) {
    try {
      // Garante que Prisma está disponível
      if (!this.prisma) {
        console.log('🔄 Creating temporary Prisma client for getAuthCookie...')
        const { PrismaClient } = require('@prisma/client')
        this.prisma = new PrismaClient()
      }
      
      const connection = await this.prisma.vRChatConnection.findUnique({
        where: { userId: userId },
        select: { authCookie: true }
      })

      return connection?.authCookie || null
    } catch (error) {
      console.error('❌ Error getting auth cookie:', error)
      return null
    }
  }

  /**
   * Busca mundos por critérios específicos
   */
  async searchWorlds(authCookie, { q, tag, user, n = 60, offset = 0, sort = 'popularity', order = 'descending' }) {
    try {
      console.log('🔍 Searching worlds from VRChat API...')
      
      // Constrói query string
      const params = new URLSearchParams()
      if (q) params.append('search', q)
      if (tag) params.append('tag', tag)
      if (user) params.append('user', user)
      params.append('n', n.toString())
      params.append('offset', offset.toString())
      params.append('sort', sort)
      params.append('order', order)
      
      const endpoint = `/worlds?${params.toString()}`
      const result = await this.makeAuthenticatedRequest(endpoint, authCookie)
      
      if (!result.success) {
        console.log('❌ Failed to search worlds:', result.error)
        return {
          success: false,
          error: result.error,
          worlds: []
        }
      }
      
      console.log('✅ Worlds search completed successfully:', result.data?.length || 0, 'worlds found')
      
      return {
        success: true,
        worlds: result.data || [],
        total: result.data?.length || 0
      }
    } catch (error) {
      console.error('❌ Error searching worlds:', error)
      return {
        success: false,
        error: 'Erro ao buscar mundos',
        worlds: []
      }
    }
  }

  /**
   * Busca mundos em destaque
   */
  async getFeaturedWorlds(authCookie) {
    try {
      console.log('⭐ Fetching featured worlds from VRChat API...')
      
      const result = await this.makeAuthenticatedRequest('/worlds?featured=true&sort=order&n=60', authCookie)
      
      if (!result.success) {
        console.log('❌ Failed to fetch featured worlds:', result.error)
        return {
          success: false,
          error: result.error,
          worlds: []
        }
      }
      
      console.log('✅ Featured worlds fetched successfully:', result.data?.length || 0, 'worlds')
      
      return {
        success: true,
        worlds: result.data || [],
        total: result.data?.length || 0
      }
    } catch (error) {
      console.error('❌ Error fetching featured worlds:', error)
      return {
        success: false,
        error: 'Erro ao buscar mundos em destaque',
        worlds: []
      }
    }
  }

  /**
   * Busca detalhes específicos de um mundo
   */
  async getWorldDetails(authCookie, worldId) {
    try {
      console.log('🌍 Fetching world details from VRChat API for:', worldId)
      
      const result = await this.makeAuthenticatedRequest(`/worlds/${worldId}`, authCookie)
      
      if (!result.success) {
        console.log('❌ Failed to fetch world details:', result.error)
        return {
          success: false,
          error: result.error,
          world: null
        }
      }
      
      console.log('✅ World details fetched successfully:', result.data?.name || 'Unknown world')
      
      return {
        success: true,
        world: result.data
      }
    } catch (error) {
      console.error('❌ Error fetching world details:', error)
      return {
        success: false,
        error: 'Erro ao buscar detalhes do mundo',
        world: null
      }
    }
  }

  /**
   * Buscar instâncias ativas de um mundo específico
   */
  async getWorldInstances(authCookie, worldId) {
    try {
      console.log('🌐 Fetching world instances from VRChat API for:', worldId)
      
      const result = await this.makeAuthenticatedRequest(`/worlds/${worldId}/instances`, authCookie)
      
      if (!result.success) {
        console.log('❌ Failed to fetch world instances:', result.error)
        return {
          success: false,
          error: result.error,
          instances: []
        }
      }
      
      console.log('✅ World instances fetched successfully:', result.data?.length || 0, 'instances')
      
      return {
        success: true,
        instances: result.data || [],
        total: result.data?.length || 0
      }
    } catch (error) {
      console.error('❌ Error fetching world instances:', error)
      return {
        success: false,
        error: 'Erro ao buscar instâncias do mundo',
        instances: []
      }
    }
  }

  /**
   * Busca mundos populares
   */
  async getPopularWorlds(authCookie, n = 60) {
    try {
      console.log('🔥 Fetching popular worlds from VRChat API...')
      
      const result = await this.makeAuthenticatedRequest(`/worlds?sort=popularity&order=descending&n=${n}`, authCookie)
      
      if (!result.success) {
        console.log('❌ Failed to fetch popular worlds:', result.error)
        return {
          success: false,
          error: result.error,
          worlds: []
        }
      }
      
      console.log('✅ Popular worlds fetched successfully:', result.data?.length || 0, 'worlds')
      
      return {
        success: true,
        worlds: result.data || [],
        total: result.data?.length || 0
      }
    } catch (error) {
      console.error('❌ Error fetching popular worlds:', error)
      return {
        success: false,
        error: 'Erro ao buscar mundos populares',
        worlds: []
      }
    }
  }

  /**
   * Sincroniza favoritos (placeholder para implementação futura)
   */
  async syncFavorites(userId, authCookie) {
    // Implementação futura para sincronizar favoritos
    return {
      worlds: [],
      avatars: [],
      total: 0,
      message: 'Sincronização de favoritos em desenvolvimento'
    }
  }
}

// Export singleton instance com reinicialização automática
let vrchatServiceInstance = null

function getVRChatService() {
  if (!vrchatServiceInstance) {
    vrchatServiceInstance = new VRChatService()
  }
  return vrchatServiceInstance
}

// Força reinicialização se necessário
function resetVRChatService() {
  vrchatServiceInstance = null
  return getVRChatService()
}

module.exports = getVRChatService()
module.exports.reset = resetVRChatService
