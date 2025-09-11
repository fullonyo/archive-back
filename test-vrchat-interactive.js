const axios = require('axios')
const readline = require('readline')

// Configuração da API VRChat
const VRCHAT_API_BASE = 'https://api.vrchat.cloud/api/1'

// Credenciais de teste
const username = 'maycombeta2@gmail.com'
const password = '@Nicolich122'

// Cliente HTTP configurado
const client = axios.create({
  baseURL: VRCHAT_API_BASE,
  timeout: 30000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'VRCHIEVE/1.0 (https://vrchieve.com)'
  }
})

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve)
  })
}

async function testVRChatAPI() {
  console.log('🔗 Teste VRChat API - Fluxo 2FA Interativo')
  console.log('═'.repeat(60))
  
  try {
    const credentials = Buffer.from(`${username}:${password}`).toString('base64')
    
    console.log('\n📝 TESTE: Verificando status da conta')
    console.log('Username:', username)
    
    // Primeira tentativa - verificar se precisa de 2FA
    const response = await client.get('/auth/user', {
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    })
    
    console.log('✅ Status:', response.status)
    console.log('📄 Response:', JSON.stringify(response.data, null, 2))
    
    if (response.data.requiresTwoFactorAuth) {
      console.log('\n🔐 2FA Necessário! Tipos:', response.data.requiresTwoFactorAuth)
    }
    
  } catch (error) {
    console.log('\n📊 Analisando resposta:')
    console.log('Status:', error.response?.status)
    console.log('Data:', JSON.stringify(error.response?.data, null, 2))
    
    if (error.response?.status === 429) {
      console.log('\n⏳ Rate limiting ativo. Sua conta tem 2FA habilitado!')
      console.log('Mensagem:', error.response.data?.error?.message)
      
      if (error.response.data?.error?.message?.includes('email')) {
        console.log('\n📧 Um código foi enviado para seu email!')
        
        // Aguardar código do usuário
        const code = await askQuestion('\n🔐 Digite o código 2FA do seu email: ')
        
        if (code && code.length === 6) {
          console.log('\n📝 Testando com código 2FA:', code)
          
          try {
            const response2FA = await client.get('/auth/user', {
              headers: {
                'Authorization': `Basic ${credentials}`,
                'VRChat-2FA-Code': code.trim()
              }
            })
            
            console.log('\n🎉 SUCESSO COM 2FA!')
            console.log('Status:', response2FA.status)
            console.log('Data:', JSON.stringify(response2FA.data, null, 2))
            
            if (response2FA.data.id) {
              console.log('\n👤 Dados do Usuário:')
              console.log('- ID:', response2FA.data.id)
              console.log('- Username:', response2FA.data.username)
              console.log('- Display Name:', response2FA.data.displayName)
              console.log('- Status:', response2FA.data.status)
              console.log('- Avatar:', response2FA.data.currentAvatarImageUrl)
              
              console.log('\n✅ CONFIRMADO: 2FA funciona corretamente!')
              console.log('O problema está na integração do VRCHIEVE, não na API.')
            }
            
          } catch (error2FA) {
            console.log('\n❌ Erro no teste 2FA:')
            console.log('Status:', error2FA.response?.status)
            console.log('Data:', JSON.stringify(error2FA.response?.data, null, 2))
            
            if (error2FA.response?.status === 401) {
              console.log('\n🔍 Possíveis causas:')
              console.log('- Código inválido/expirado')
              console.log('- Rate limiting ainda ativo')
              console.log('- Código já foi usado')
            }
          }
        } else {
          console.log('\n❌ Código inválido. Deve ter 6 dígitos.')
        }
      }
    } else if (error.response?.status === 401) {
      console.log('\n🔐 Status 401 - Verificando dados...')
      
      if (error.response.data?.requiresTwoFactorAuth) {
        console.log('✅ 2FA detectado na resposta 401!')
        console.log('Tipos:', error.response.data.requiresTwoFactorAuth)
      } else {
        console.log('❌ Credenciais podem estar incorretas')
      }
    }
  }
  
  console.log('\n═'.repeat(60))
  console.log('🏁 Teste concluído!')
  rl.close()
}

// Executar teste
testVRChatAPI().catch((error) => {
  console.error('Erro no teste:', error)
  rl.close()
})
