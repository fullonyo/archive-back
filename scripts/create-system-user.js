const { PrismaClient } = require('../generated/prisma');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createSystemUser() {
  try {
    console.log('🚀 Criando usuário SISTEMA...');

    // Verificar se o usuário já existe
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: 'sistema' },
          { email: 'sistema@vrchieve.com' },
          { role: 'SISTEMA' }
        ]
      }
    });

    if (existingUser) {
      console.log('❌ Usuário SISTEMA já existe:');
      console.log(`   Username: ${existingUser.username}`);
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   ID: ${existingUser.id}`);
      return existingUser;
    }

    // Hash da senha padrão
    const password = 'SISTEMA@2024!'; // Senha temporária que deve ser alterada
    const passwordHash = await bcrypt.hash(password, 12);

    // Criar usuário SISTEMA
    const systemUser = await prisma.user.create({
      data: {
        username: 'sistema',
        email: 'sistema@vrchieve.com',
        passwordHash: passwordHash,
        role: 'SISTEMA',
        accountType: 'ADMIN',
        isVerified: true,
        isActive: true,
        bio: 'Conta de sistema com permissões máximas para administração da plataforma.',
        avatarUrl: null
      }
    });

    // Adicionar todas as permissões do sistema
    const systemPermissions = [
      'SYSTEM_ADMIN',
      'USER_MANAGEMENT',
      'ASSET_MANAGEMENT', 
      'CATEGORY_MANAGEMENT',
      'PERMISSION_MANAGEMENT',
      'VIEW_ADMIN_PANEL',
      'APPROVE_USERS',
      'MANAGE_ROLES',
      'VIEW_ADMIN_LOGS',
      'SYSTEM_MAINTENANCE',
      'FULL_ACCESS'
    ];

    // Criar permissões para o usuário SISTEMA
    for (const permission of systemPermissions) {
      await prisma.userPermission.create({
        data: {
          userId: systemUser.id,
          permission: permission,
          grantedBy: systemUser.id // Auto-grant
        }
      });
    }

    console.log('✅ Usuário SISTEMA criado com sucesso!');
    console.log('');
    console.log('📋 Detalhes da conta:');
    console.log(`   ID: ${systemUser.id}`);
    console.log(`   Username: ${systemUser.username}`);
    console.log(`   Email: ${systemUser.email}`);
    console.log(`   Role: ${systemUser.role}`);
    console.log(`   Account Type: ${systemUser.accountType}`);
    console.log(`   Senha temporária: ${password}`);
    console.log('');
    console.log('🔒 IMPORTANTE: Altere a senha imediatamente após o primeiro login!');
    console.log('');
    console.log('🛡️ Permissões concedidas:');
    systemPermissions.forEach(perm => console.log(`   ✓ ${perm}`));

    return systemUser;

  } catch (error) {
    console.error('❌ Erro ao criar usuário SISTEMA:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  createSystemUser()
    .then(() => {
      console.log('\n🎉 Script finalizado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script falhou:', error.message);
      process.exit(1);
    });
}

module.exports = createSystemUser;
