const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testUsersQuery() {
  try {
    console.log('🔍 Testando consulta de usuários...')
    
    // Primeiro, vamos testar uma consulta simples
    const simpleUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        accountType: true,
        isVerified: true,
        isActive: true,
        createdAt: true,
        lastLogin: true
      },
      take: 5
    })
    
    console.log('✅ Consulta simples funcionou:', simpleUsers.length, 'usuários encontrados')
    simpleUsers.forEach(user => {
      console.log(`  - ${user.username} (${user.email}) - Role: ${user.role}`)
    })
    
    // Agora vamos testar com permissions
    console.log('\n🔍 Testando consulta com permissions...')
    
    const usersWithPermissions = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        permissions: true
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        accountType: true,
        isVerified: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
        permissions: {
          select: {
            permission: true,
            grantedAt: true
          }
        }
      },
      take: 5
    })
    
    console.log('✅ Consulta com permissions funcionou:', usersWithPermissions.length, 'usuários encontrados')
    usersWithPermissions.forEach(user => {
      console.log(`  - ${user.username}: ${user.permissions.length} permissões`)
    })
    
  } catch (error) {
    console.error('❌ Erro na consulta:', error)
    console.error('Detalhes:', error.message)
    if (error.code) {
      console.error('Código do erro:', error.code)
    }
  } finally {
    await prisma.$disconnect()
  }
}

testUsersQuery()
  .then(() => {
    console.log('\n🎉 Teste finalizado!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Teste falhou:', error.message)
    process.exit(1)
  })
