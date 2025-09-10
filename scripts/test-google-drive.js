#!/usr/bin/env node

/**
 * Script de teste para Google Drive
 * Verifica se a configuração está funcionando corretamente
 */

require('dotenv').config();
const googleDriveService = require('../services/googleDrive');
const fs = require('fs');
const path = require('path');

async function testGoogleDriveConfiguration() {
  console.log('🧪 Testando configuração do Google Drive...\n');

  try {
    // 1. Testar autenticação básica
    console.log('1️⃣ Testando autenticação...');
    const isConfigured = await googleDriveService.checkConfiguration();
    
    if (!isConfigured) {
      console.log('❌ Falha na autenticação');
      return;
    }
    
    console.log('✅ Autenticação OK\n');

    // 2. Testar informações da pasta
    console.log('2️⃣ Verificando pasta de destino...');
    try {
      const folderInfo = await googleDriveService.getFolderInfo();
      console.log('📁 Pasta:', folderInfo.name || 'Root');
      console.log('🔗 Link:', folderInfo.webViewLink || 'N/A');
    } catch (error) {
      console.log('⚠️ Aviso: Não foi possível acessar informações da pasta');
      console.log('   Arquivos serão enviados para a raiz do drive');
    }
    console.log('✅ Verificação de pasta OK\n');

    // 3. Testar upload de arquivo pequeno
    console.log('3️⃣ Testando upload de arquivo...');
    
    // Criar arquivo de teste
    const testContent = `Teste VRCHIEVE - ${new Date().toISOString()}`;
    const testBuffer = Buffer.from(testContent, 'utf8');
    
    const fileInfo = {
      originalname: 'vrchieve-test.txt',
      mimetype: 'text/plain',
      size: testBuffer.length
    };

    const uploadResult = await googleDriveService.uploadFile(fileInfo, testBuffer);
    console.log('✅ Upload realizado com sucesso!');
    console.log('📄 Arquivo ID:', uploadResult.id);
    console.log('📄 Nome:', uploadResult.name);
    console.log('🔗 Link de download:', uploadResult.downloadLink);
    console.log('');

    // 4. Testar obtenção de metadados
    console.log('4️⃣ Testando obtenção de metadados...');
    const metadata = await googleDriveService.getFileMetadata(uploadResult.id);
    console.log('✅ Metadados obtidos com sucesso!');
    console.log('📊 Tamanho:', metadata.size, 'bytes');
    console.log('📅 Criado em:', metadata.createdTime);
    console.log('');

    // 5. Testar remoção de arquivo
    console.log('5️⃣ Testando remoção de arquivo...');
    await googleDriveService.deleteFile(uploadResult.id);
    console.log('✅ Arquivo removido com sucesso!\n');

    // Resumo final
    console.log('🎉 TODOS OS TESTES PASSARAM!');
    console.log('✅ Google Drive está configurado e funcionando corretamente');
    console.log('');
    console.log('Configurações detectadas:');
    console.log('- Service Account: ✅ Configurado');
    console.log('- Shared Drive:', process.env.GOOGLE_SHARED_DRIVE_ID ? '✅ Configurado' : '⚠️ Não configurado');
    console.log('- Pasta específica:', process.env.GOOGLE_DRIVE_FOLDER_ID ? '✅ Configurado' : '⚠️ Usará raiz');

  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error.message);
    console.error('');
    console.error('Possíveis causas:');
    console.error('1. Arquivo de Service Account não encontrado ou inválido');
    console.error('2. Service Account não tem permissões no drive');
    console.error('3. IDs de drive/pasta incorretos');
    console.error('4. APIs não habilitadas no Google Cloud');
    console.error('');
    console.error('Consulte a documentação: docs/google-drive-setup.md');
    
    if (error.response && error.response.data) {
      console.error('');
      console.error('Detalhes do erro:', error.response.data);
    }
  }
}

// Executar testes se chamado diretamente
if (require.main === module) {
  testGoogleDriveConfiguration();
}

module.exports = testGoogleDriveConfiguration;
