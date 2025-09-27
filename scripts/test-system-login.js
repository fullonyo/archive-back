const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const prisma = new PrismaClient()

async function loginSystemUser() {
  try {
    console.log('🔐 Fazendo login com usuário SISTEMA...')
    
    // Buscar usuário SISTEMA
    const user = await prisma.user.findUnique({
      where: { email: 'sistema@vrchieve.com' },
      select: {
        id: true,
        username: true,
        email: true,
        passwordHash: true,
        role: true,
        accountType: true,
        isActive: true,
        isVerified: true,
        avatarUrl: true
      }
    })
    
    if (!user) {
      console.error('❌ Usuário SISTEMA não encontrado!')
      return
    }
    
    console.log('👤 Dados do usuário SISTEMA:', {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      accountType: user.accountType,
      isActive: user.isActive
    })
    
    // Verificar senha
    const password = 'SISTEMA@2024!'
    const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    
    if (!isValidPassword) {
      console.error('❌ Senha inválida!')
      return
    }
    
    console.log('✅ Senha válida!')
    
    // Gerar token
    const accessToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '7d' }
    )
    
    console.log('🎟️ Token gerado:', accessToken.substring(0, 50) + '...')
    
    // Verificar token
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET || 'default-secret')
    console.log('🔍 Token decodificado:', decoded)
    
    // Simular verificação do middleware
    const verifiedUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        accountType: true,
        isActive: true,
        isVerified: true,
        avatarUrl: true
      }
    })
    
    console.log('✅ Usuário verificado pelo token:', verifiedUser)
    
    console.log('')
    console.log('🎯 INSTRUÇÕES PARA LOGIN:')
    console.log('1. Faça login no frontend com:')
    console.log(`   Email: ${user.email}`)
    console.log(`   Senha: ${password}`)
    console.log('2. Ou use este token no Authorization header:')
    console.log(`   Authorization: Bearer ${accessToken}`)
    
  } catch (error) {
    console.error('❌ Erro no login:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Executar
loginSystemUser()
  .then(() => {
    console.log('\n🎉 Script finalizado!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Script falhou:', error.message)
    process.exit(1)
  })
