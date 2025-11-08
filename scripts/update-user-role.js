const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Script para atualizar o role de um usuário
 * Uso: node scripts/update-user-role.js <username> <role>
 * Exemplo: node scripts/update-user-role.js mayco_dev SISTEMA
 */

async function updateUserRole(username, newRole) {
  try {
    console.log(`🔄 Atualizando role do usuário: ${username}`);
    console.log(`📝 Novo role: ${newRole}`);
    console.log('');

    // Validar role
    const validRoles = ['SISTEMA', 'ADMIN', 'MODERATOR', 'CREATOR', 'USER'];
    if (!validRoles.includes(newRole)) {
      throw new Error(`Role inválido! Use um dos seguintes: ${validRoles.join(', ')}`);
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        accountType: true,
        isActive: true,
        isVerified: true
      }
    });

    if (!user) {
      throw new Error(`Usuário '${username}' não encontrado!`);
    }

    console.log('👤 Usuário encontrado:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role atual: ${user.role}`);
    console.log(`   Account Type: ${user.accountType}`);
    console.log(`   Ativo: ${user.isActive ? 'Sim' : 'Não'}`);
    console.log(`   Verificado: ${user.isVerified ? 'Sim' : 'Não'}`);
    console.log('');

    // Verificar se já tem o role desejado
    if (user.role === newRole) {
      console.log(`✅ Usuário já possui o role ${newRole}!`);
      return user;
    }

    // Atualizar role
    const updatedUser = await prisma.user.update({
      where: { username },
      data: {
        role: newRole,
        // Se for SISTEMA ou ADMIN, garantir que account type seja ADMIN
        accountType: ['SISTEMA', 'ADMIN'].includes(newRole) ? 'ADMIN' : user.accountType,
        // Garantir que usuários admin estejam verificados e ativos
        isVerified: ['SISTEMA', 'ADMIN', 'MODERATOR'].includes(newRole) ? true : user.isVerified,
        isActive: true
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        accountType: true,
        isActive: true,
        isVerified: true
      }
    });

    console.log('✅ Role atualizado com sucesso!');
    console.log('');
    console.log('📋 Novo estado:');
    console.log(`   Role: ${updatedUser.role}`);
    console.log(`   Account Type: ${updatedUser.accountType}`);
    console.log(`   Ativo: ${updatedUser.isActive ? 'Sim' : 'Não'}`);
    console.log(`   Verificado: ${updatedUser.isVerified ? 'Sim' : 'Não'}`);
    console.log('');

    // Listar permissões baseadas no role
    const rolePermissions = {
      SISTEMA: [
        '🛡️  Acesso total ao sistema',
        '👥 Gerenciar todos os usuários',
        '📦 Aprovar/rejeitar/deletar assets',
        '🏷️  Gerenciar categorias',
        '🔒 Gerenciar permissões',
        '📊 Visualizar analytics',
        '⚙️  Configurações do sistema',
        '📝 Ver logs administrativos',
        '🚀 Upload sem limites'
      ],
      ADMIN: [
        '👥 Gerenciar usuários',
        '📦 Aprovar/rejeitar/deletar assets',
        '🏷️  Gerenciar categorias',
        '📊 Visualizar analytics',
        '⚙️  Configurações do sistema',
        '🚀 Upload premium sem aprovação'
      ],
      MODERATOR: [
        '📦 Aprovar/rejeitar assets',
        '👁️  Ver detalhes de usuários',
        '🚫 Moderar comentários',
        '🚀 Upload sem aprovação'
      ],
      CREATOR: [
        '🚀 Upload de assets premium',
        '📊 Analytics dos próprios assets'
      ],
      USER: [
        '📤 Upload de assets (requer aprovação)',
        '💬 Comentar e favoritar'
      ]
    };

    console.log('🎯 Permissões do novo role:');
    rolePermissions[newRole].forEach(perm => console.log(`   ${perm}`));
    console.log('');

    return updatedUser;

  } catch (error) {
    console.error('❌ Erro ao atualizar role:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('');
    console.log('📖 Uso: node scripts/update-user-role.js <username> <role>');
    console.log('');
    console.log('Roles disponíveis:');
    console.log('  • SISTEMA    - Acesso total ao sistema');
    console.log('  • ADMIN      - Administrador da plataforma');
    console.log('  • MODERATOR  - Moderador de conteúdo');
    console.log('  • CREATOR    - Criador de conteúdo premium');
    console.log('  • USER       - Usuário padrão');
    console.log('');
    console.log('Exemplos:');
    console.log('  node scripts/update-user-role.js mayco_dev SISTEMA');
    console.log('  node scripts/update-user-role.js john_doe MODERATOR');
    console.log('');
    process.exit(1);
  }

  const [username, role] = args;

  updateUserRole(username, role)
    .then(() => {
      console.log('🎉 Script finalizado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script falhou:', error.message);
      process.exit(1);
    });
}

module.exports = updateUserRole;
