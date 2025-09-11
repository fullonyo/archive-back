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
        return {
          success: true,
          user: initialResponse.data,
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
  async saveVRChatConnection(userId, vrchatData) {
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
