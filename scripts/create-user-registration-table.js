const mysql = require('mysql2/promise');
require('dotenv').config();

async function createUserRegistrationTable() {
  let connection;
  
  try {
    connection = await mysql.createConnection(process.env.DATABASE_URL);
    
    const sql = `
      CREATE TABLE IF NOT EXISTS user_registrations (
        id INT NOT NULL AUTO_INCREMENT,
        nickname VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        discord VARCHAR(100) NULL,
        password_hash VARCHAR(255) NOT NULL,
        confirmation_token VARCHAR(255) NOT NULL UNIQUE,
        token_expires_at DATETIME NOT NULL,
        is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        confirmed_at DATETIME NULL,
        PRIMARY KEY (id),
        INDEX user_registrations_email_idx (email),
        INDEX user_registrations_confirmation_token_idx (confirmation_token),
        INDEX user_registrations_created_at_idx (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    
    await connection.execute(sql);
    console.log('✅ Tabela user_registrations criada com sucesso!');
    
    // Verificar se a tabela foi criada
    const [tables] = await connection.execute("SHOW TABLES LIKE 'user_registrations'");
    if (tables.length > 0) {
      console.log('✅ Tabela verificada no banco de dados');
    }
    
  } catch (error) {
    console.error('❌ Erro ao criar tabela:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createUserRegistrationTable();
