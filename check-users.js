const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkUsers() {
  try {
    console.log('👥 Verificando usuários no banco de dados...')
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true
      }
    })
    
    console.log(`📊 Total de usuários: ${users.length}`)
    
    if (users.length > 0) {
      console.log('\n👤 Usuários encontrados:')
      users.forEach(user => {
        console.log(`  ${user.id}: ${user.email} (${user.username}) - Role: ${user.role} - Ativo: ${user.isActive}`)
      })
    } else {
      console.log('❌ Nenhum usuário encontrado no banco!')
      console.log('💡 Sugestão: Execute o script de seed para criar usuários de teste')
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar usuários:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUsers()
