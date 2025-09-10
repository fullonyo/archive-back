const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const stream = require('stream');

class GoogleDriveService {
  constructor() {
    try {
      // Configurar autenticação usando Service Account
      let credentials;
      
      if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        // Se a chave estiver em uma variável de ambiente (JSON string)
        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      } else if (process.env.GOOGLE_SERVICE_ACCOUNT_PATH) {
        // Se a chave estiver em um arquivo
        credentials = JSON.parse(fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_PATH, 'utf8'));
      } else {
        throw new Error('Google Service Account credentials not found');
      }

      this.auth = new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/drive'
        ]
      );

      this.drive = google.drive({ version: 'v3', auth: this.auth });
      
      // ID do drive compartilhado
      this.sharedDriveId = process.env.GOOGLE_SHARED_DRIVE_ID;
      
      // ID da pasta dentro do drive compartilhado (opcional)
      this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      
      console.log('✅ Google Drive Service Account configured successfully');
      
    } catch (error) {
      console.error('❌ Google Drive configuration error:', error.message);
      throw new Error('Failed to configure Google Drive service');
    }
  }

  /**
   * Upload file to Google Drive (Shared Drive)
   * @param {Object} fileInfo - File information
   * @param {Buffer} fileBuffer - File buffer
   * @returns {Object} File metadata
   */
  async uploadFile(fileInfo, fileBuffer) {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        attempt++;
        const { originalname, mimetype, size } = fileInfo;
        
        // Gerar nome único para o arquivo
        const timestamp = Date.now();
        const sanitizedName = originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${timestamp}_${sanitizedName}`;

        const fileMetadata = {
          name: fileName,
          parents: this.folderId ? [this.folderId] : (this.sharedDriveId ? [this.sharedDriveId] : undefined)
        };

        // Converter buffer em readable stream
        const bufferStream = new stream.PassThrough();
        bufferStream.end(fileBuffer);

        const media = {
          mimeType: mimetype,
          body: bufferStream
        };

        const requestParams = {
          resource: fileMetadata,
          media: media,
          fields: 'id,name,size,mimeType,webViewLink,webContentLink,parents',
          timeout: 300000 // 5 minutos de timeout
        };

        // Se estiver usando drive compartilhado, adicionar parâmetro supportsAllDrives
        if (this.sharedDriveId) {
          requestParams.supportsAllDrives = true;
        }

        console.log(`📤 Uploading file to Google Drive (attempt ${attempt}/${maxRetries}):`, fileName);
        
        const response = await this.drive.files.create(requestParams);

        console.log('✅ File uploaded successfully:', response.data.id);

        // Configurar permissões para leitura pública
        const permissionParams = {
          fileId: response.data.id,
          resource: {
            role: 'reader',
            type: 'anyone'
          }
        };

        if (this.sharedDriveId) {
          permissionParams.supportsAllDrives = true;
        }

        await this.drive.permissions.create(permissionParams);

        console.log('✅ File permissions set successfully');

        return {
          id: response.data.id,
          name: response.data.name,
          size: response.data.size,
          mimeType: response.data.mimeType,
          webViewLink: response.data.webViewLink,
          webContentLink: response.data.webContentLink,
          downloadLink: `https://drive.google.com/uc?export=download&id=${response.data.id}`,
          directViewLink: `https://lh3.googleusercontent.com/d/${response.data.id}=w1920-h1080`,
          alternativeViewLink: `https://drive.google.com/uc?export=view&id=${response.data.id}`,
          parents: response.data.parents
        };
      } catch (error) {
        console.error(`❌ Google Drive upload error (attempt ${attempt}/${maxRetries}):`, error.message);
        
        // Se for erro de conexão e ainda há tentativas, aguardar e tentar novamente
        if ((error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND' || error.message.includes('ECONNRESET')) && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Backoff exponencial: 2s, 4s, 8s
          console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Log detalhado do erro
        if (error.response) {
          console.error('Error response:', error.response.data);
        }
        
        // Se chegou aqui, todas as tentativas falharam ou é um erro não relacionado à conexão
        if (attempt === maxRetries) {
          throw new Error(`Failed to upload file to Google Drive after ${maxRetries} attempts: ${error.message}`);
        } else {
          throw error; // Re-throw se não for erro de conexão
        }
      }
    }
  }

  /**
   * Delete file from Google Drive (Shared Drive)
   * @param {string} fileId - File ID
   */
  async deleteFile(fileId) {
    try {
      console.log('🗑️ Deleting file from Google Drive:', fileId);
      
      const deleteParams = {
        fileId: fileId
      };

      // Se estiver usando drive compartilhado, adicionar parâmetro supportsAllDrives
      if (this.sharedDriveId) {
        deleteParams.supportsAllDrives = true;
      }

      await this.drive.files.delete(deleteParams);
      
      console.log('✅ File deleted successfully');
      return true;  
    } catch (error) {
      console.error('❌ Google Drive delete error:', error);
      
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
      
      throw new Error(`Failed to delete file from Google Drive: ${error.message}`);
    }
  }

  /**
   * Get file metadata from Google Drive (Shared Drive)
   * @param {string} fileId - File ID
   * @returns {Object} File metadata
   */
  async getFileMetadata(fileId) {
    try {
      const getParams = {
        fileId: fileId,
        fields: 'id,name,size,mimeType,webViewLink,webContentLink,createdTime,modifiedTime,parents'
      };

      // Se estiver usando drive compartilhado, adicionar parâmetro supportsAllDrives
      if (this.sharedDriveId) {
        getParams.supportsAllDrives = true;
      }

      const response = await this.drive.files.get(getParams);

      return {
        ...response.data,
        downloadLink: `https://drive.google.com/uc?export=download&id=${fileId}`
      };
    } catch (error) {
      console.error('❌ Google Drive get metadata error:', error);
      
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
      
      throw new Error(`Failed to get file metadata from Google Drive: ${error.message}`);
    }
  }

  /**
   * Create a shareable link for file (Shared Drive)
   * @param {string} fileId - File ID
   * @returns {string} Shareable link
   */
  async createShareableLink(fileId) {
    try {
      const permissionParams = {
        fileId: fileId,
        resource: {
          role: 'reader',
          type: 'anyone'
        }
      };

      // Se estiver usando drive compartilhado, adicionar parâmetro supportsAllDrives
      if (this.sharedDriveId) {
        permissionParams.supportsAllDrives = true;
      }

      await this.drive.permissions.create(permissionParams);

      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    } catch (error) {
      console.error('❌ Google Drive create link error:', error);
      
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
      
      throw new Error(`Failed to create shareable link: ${error.message}`);
    }
  }

  /**
   * Upload thumbnail to Google Drive
   * @param {Buffer} thumbnailBuffer - Thumbnail buffer
   * @param {string} originalFileName - Original file name
   * @returns {Object} Thumbnail metadata
   */
  async uploadThumbnail(thumbnailBuffer, originalFileName) {
    try {
      const thumbnailName = `thumb_${Date.now()}_${originalFileName}.jpg`;

      const fileMetadata = {
        name: thumbnailName,
        parents: this.folderId ? [this.folderId] : undefined
      };

      const media = {
        mimeType: 'image/jpeg',
        body: thumbnailBuffer
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id,name,webViewLink'
      });

      // Make thumbnail publicly readable
      await this.drive.permissions.create({
        fileId: response.data.id,
        resource: {
          role: 'reader',
          type: 'anyone'
        }
      });

      return {
        id: response.data.id,
        name: response.data.name,
        url: `https://drive.google.com/uc?export=view&id=${response.data.id}`
      };
    } catch (error) {
      console.error('Google Drive thumbnail upload error:', error);
      throw new Error('Failed to upload thumbnail to Google Drive');
    }
  }

  /**
   * Check if Google Drive is properly configured (supports shared drives)
   * @returns {boolean} Configuration status
   */
  async checkConfiguration() {
    try {
      const response = await this.drive.about.get({
        fields: 'user'
      });
      
      console.log('✅ Google Drive connected for user:', response.data.user.emailAddress);
      
      // Testar acesso ao shared drive se configurado
      if (this.sharedDriveId) {
        try {
          const driveResponse = await this.drive.drives.get({
            driveId: this.sharedDriveId
          });
          console.log('✅ Shared Drive accessible:', driveResponse.data.name);
        } catch (driveError) {
          console.warn('⚠️ Shared Drive not accessible, but basic Drive works');
        }
      }
      
      return true;
    } catch (error) {
      console.error('❌ Google Drive configuration error:', error);
      return false;
    }
  }

  /**
   * Get folder information (supports shared drives)
   * @returns {Object} Folder metadata
   */
  async getFolderInfo() {
    try {
      if (!this.folderId) {
        return { message: 'No folder specified, files will be uploaded to root' };
      }

      const getParams = {
        fileId: this.folderId,
        fields: 'id,name,webViewLink,parents'
      };

      // Se estiver usando drive compartilhado, adicionar parâmetro supportsAllDrives
      if (this.sharedDriveId) {
        getParams.supportsAllDrives = true;
      }

      const response = await this.drive.files.get(getParams);

      return response.data;
    } catch (error) {
      console.error('❌ Google Drive folder info error:', error);
      
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
      
      throw new Error(`Failed to get folder information: ${error.message}`);
    }
  }
}

// Export singleton instance
const googleDriveService = new GoogleDriveService();

module.exports = googleDriveService; 