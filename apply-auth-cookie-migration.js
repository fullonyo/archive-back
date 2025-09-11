const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('🔄 Aplicando migração: Adicionando campo auth_cookie...');
    
    await connection.execute('ALTER TABLE vrchat_connections ADD COLUMN auth_cookie TEXT DEFAULT NULL');
    
    console.log('✅ Migração aplicada com sucesso!');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ Campo auth_cookie já existe na tabela');
    } else {
      console.error('❌ Erro na migração:', error.message);
    }
  } finally {
    await connection.end();
  }
}

runMigration();
