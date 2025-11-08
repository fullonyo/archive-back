const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    console.log('🚀 Criando usuário de teste...');

    // Dados do usuário de teste
    const testUserData = {
      username: 'mayco_dev',
      email: 'mayco@example.com',
      password: 'Test123!', // Senha simples para testes
      role: 'CREATOR', // Pode fazer upload sem aprovação
      accountType: 'PREMIUM'
    };

    // Verificar se o usuário já existe
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: testUserData.username },
          { email: testUserData.email }
        ]
      }
    });

    if (existingUser) {
      console.log('⚠️  Usuário de teste já existe:');
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Username: ${existingUser.username}`);
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log('\n🔑 Credenciais de login:');
      console.log(`   Username: ${testUserData.username}`);
      console.log(`   Password: ${testUserData.password}`);
      return existingUser;
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(testUserData.password, 12);

    // Criar usuário de teste
    const testUser = await prisma.user.create({
      data: {
        username: testUserData.username,
        email: testUserData.email,
        passwordHash: passwordHash,
        role: testUserData.role,
        accountType: testUserData.accountType,
        isVerified: true,
        isActive: true,
        bio: 'VRChat creator passionate about avatars and world building. Creating high-quality assets since 2022.',
        country: 'Brazil',
        city: 'São Paulo',
        socialLinks: JSON.stringify({
          twitter: 'https://twitter.com/mayco_dev',
          discord: 'mayco#1234',
          vrchat: 'mayco_dev',
          website: 'https://mayco.dev'
        }),
        avatarUrl: null,
        bannerUrl: null
      }
    });

    console.log('✅ Usuário de teste criado com sucesso!');
    console.log('');
    console.log('📋 Detalhes da conta:');
    console.log(`   ID: ${testUser.id}`);
    console.log(`   Username: ${testUser.username}`);
    console.log(`   Email: ${testUser.email}`);
    console.log(`   Role: ${testUser.role}`);
    console.log(`   Account Type: ${testUser.accountType}`);
    console.log(`   Bio: ${testUser.bio?.substring(0, 50)}...`);
    console.log(`   Location: ${testUser.city}, ${testUser.country}`);
    console.log('');
    console.log('🔑 Credenciais de login:');
    console.log(`   Username: ${testUserData.username}`);
    console.log(`   Password: ${testUserData.password}`);
    console.log('');
    console.log('🌐 URLs de acesso:');
    console.log(`   Login: http://localhost:5173/login`);
    console.log(`   Profile: http://localhost:5173/profile/${testUser.username}`);

    return testUser;

  } catch (error) {
    console.error('❌ Erro ao criar usuário de teste:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  createTestUser()
    .then(() => {
      console.log('\n🎉 Script finalizado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script falhou:', error.message);
      process.exit(1);
    });
}

module.exports = createTestUser;
