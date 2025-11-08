const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Verificar se as credenciais de email estão configuradas
    this.isConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
    
    if (this.isConfigured) {
      // Configure seu provedor de email (Gmail, SendGrid, etc.)
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
    } else {
      console.log('⚠️  Email service not configured - emails will be logged to console');
      this.transporter = null;
    }
  }

  async sendConfirmationEmail(email, nickname, confirmationToken) {
    const confirmationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/confirm-email/${confirmationToken}`;
    
    // Se email não está configurado, apenas logar no console
    if (!this.isConfigured) {
      console.log('\n' + '='.repeat(80));
      console.log('📧 EMAIL DE CONFIRMAÇÃO (Modo Desenvolvimento)');
      console.log('='.repeat(80));
      console.log(`Para: ${email}`);
      console.log(`Nickname: ${nickname}`);
      console.log(`\n🔗 LINK DE CONFIRMAÇÃO:`);
      console.log(`\x1b[36m${confirmationUrl}\x1b[0m`);
      console.log('\n📋 Copie e cole este link no navegador para confirmar o email');
      console.log('='.repeat(80) + '\n');
      return true;
    }
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Nyo Archive'}" <${process.env.EMAIL_FROM || 'noreply@nyoarchive.com'}>`,
      to: email,
      subject: '🎮 Confirme seu email - Nyo Archive',
      text: `
Olá, ${nickname}!

Bem-vindo ao Nyo Archive! 

Para finalizar seu cadastro, confirme seu email clicando no link abaixo:

${confirmationUrl}

Este link expira em 24 horas.

Se você não se cadastrou no Nyo Archive, pode ignorar este email com segurança.

---
© 2025 Nyo Archive - Comunidade de Assets VRChat
      `.trim(),
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              line-height: 1.6;
              color: #1a1a1a;
              background: #f8fafc;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background: #ffffff;
              border-radius: 16px;
              overflow: hidden;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 40px 30px;
              text-align: center;
              color: white;
            }
            .logo {
              font-size: 28px;
              font-weight: 700;
              margin-bottom: 8px;
              letter-spacing: -0.025em;
            }
            .subtitle {
              opacity: 0.9;
              font-size: 16px;
              font-weight: 400;
            }
            .content {
              padding: 40px 30px;
            }
            .greeting {
              font-size: 20px;
              font-weight: 600;
              color: #1a202c;
              margin-bottom: 16px;
            }
            .message {
              font-size: 16px;
              color: #4a5568;
              margin-bottom: 32px;
              line-height: 1.7;
            }
            .button-container {
              text-align: center;
              margin: 32px 0;
            }
            .confirm-button {
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 16px 32px;
              text-decoration: none;
              border-radius: 12px;
              font-weight: 600;
              font-size: 16px;
              transition: all 0.3s ease;
              box-shadow: 0 4px 14px 0 rgba(102, 126, 234, 0.39);
            }
            .confirm-button:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 20px 0 rgba(102, 126, 234, 0.5);
            }
            .divider {
              height: 1px;
              background: #e2e8f0;
              margin: 32px 0;
            }
            .alternative {
              background: #f7fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 20px;
              margin: 24px 0;
            }
            .alternative-title {
              font-size: 14px;
              font-weight: 600;
              color: #2d3748;
              margin-bottom: 8px;
            }
            .link-text {
              font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
              font-size: 13px;
              color: #667eea;
              word-break: break-all;
              background: white;
              padding: 12px;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
            }
            .warning {
              background: #fef5e7;
              border: 1px solid #f6ad55;
              border-radius: 12px;
              padding: 20px;
              margin: 24px 0;
            }
            .warning-title {
              font-size: 14px;
              font-weight: 600;
              color: #c05621;
              margin-bottom: 8px;
              display: flex;
              align-items: center;
            }
            .warning-text {
              font-size: 14px;
              color: #9c4221;
              line-height: 1.5;
            }
            .footer {
              background: #f7fafc;
              padding: 30px;
              text-align: center;
              border-top: 1px solid #e2e8f0;
            }
            .footer-text {
              font-size: 13px;
              color: #718096;
              margin-bottom: 8px;
            }
            .security-notice {
              background: #fff7ed;
              border: 1px solid #fed7aa;
              border-radius: 12px;
              padding: 20px;
              margin: 24px 0;
            }
            .security-notice h3 {
              color: #ea580c;
              margin: 0 0 12px 0;
              font-size: 16px;
            }
            .security-notice ul {
              margin: 0;
              padding-left: 20px;
              color: #7c2d12;
            }
            .security-notice li {
              margin: 8px 0;
            }
            @media (max-width: 600px) {
              .container {
                margin: 20px;
                border-radius: 12px;
              }
              .header, .content, .footer {
                padding: 24px 20px;
              }
              .logo {
                font-size: 24px;
              }
              .greeting {
                font-size: 18px;
              }
              .message {
                font-size: 15px;
              }
              .confirm-button {
                padding: 14px 28px;
                font-size: 15px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🎮 Nyo Archive</div>
              <div class="subtitle">Plataforma de Assets VRChat</div>
            </div>
            
            <div class="content">
              <div class="greeting">Olá, ${nickname}! 👋</div>
              
              <div class="message">
                Bem-vindo ao Nyo Archive! Estamos muito felizes em tê-lo conosco.<br><br>
                Para finalizar seu cadastro e começar a explorar nossa plataforma, confirme seu endereço de email clicando no botão abaixo:
              </div>
              
              <div class="button-container">
                <a href="${confirmationUrl}" class="confirm-button">
                  ✅ Confirmar Email
                </a>
              </div>
              
              <div class="divider"></div>
              
              <div class="alternative">
                <div class="alternative-title">Link não funciona?</div>
                <div>Copie e cole este link no seu navegador:</div>
                <div class="link-text">${confirmationUrl}</div>
              </div>
              
              <div class="warning">
                <div class="warning-title">
                  ⏰ Importante
                </div>
                <div class="warning-text">
                  Este link de confirmação expira em <strong>24 horas</strong>. Confirme seu email o quanto antes para não perder o acesso.
                </div>
              </div>
            </div>
            
            <div class="footer">
              <div class="footer-text">
                © 2025 Nyo Archive - Comunidade de Assets VRChat
              </div>
              <div class="security-notice">
                Se você não se cadastrou no Nyo Archive, pode ignorar este email com segurança.
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email de confirmação enviado para: ${email}`);
      console.log(`📨 Message ID: ${info.messageId}`);
      
      // SEMPRE mostrar o link no console para facilitar desenvolvimento
      console.log('\n' + '='.repeat(80));
      console.log('🔗 LINK DE CONFIRMAÇÃO:');
      console.log(`\x1b[36m${confirmationUrl}\x1b[0m`);
      console.log('📋 Copie e cole no navegador para confirmar');
      console.log('='.repeat(80) + '\n');
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar email:', error);
      console.error('Detalhes do erro:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode
      });
      
      // Mostrar o link mesmo se o email falhar (útil para debug)
      console.log('\n' + '⚠️ '.repeat(40));
      console.log('❌ Email falhou, mas aqui está o link de confirmação:');
      console.log(`\x1b[36m${confirmationUrl}\x1b[0m`);
      console.log('⚠️ '.repeat(40) + '\n');
      
      // Em produção, relançar o erro
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Falha ao enviar email de confirmação');
      }
      
      return true; // Em dev, não falha para permitir testes
    }
  }

  async sendWelcomeEmail(email, nickname) {
    // Se email não está configurado, apenas logar no console
    if (!this.isConfigured) {
      console.log('\n' + '='.repeat(80));
      console.log('🎉 EMAIL DE BOAS-VINDAS (Modo Desenvolvimento)');
      console.log('='.repeat(80));
      console.log(`Para: ${email}`);
      console.log(`Nickname: ${nickname}`);
      console.log(`\n✅ Conta criada com sucesso!`);
      console.log('='.repeat(80) + '\n');
      return true;
    }
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@nyoarchive.com',
      to: email,
      subject: '🎉 Bem-vindo ao Nyo Archive!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              line-height: 1.6;
              color: #1a1a1a;
              background: #f8fafc;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background: #ffffff;
              border-radius: 16px;
              overflow: hidden;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            }
            .header {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              padding: 40px 30px;
              text-align: center;
              color: white;
            }
            .logo {
              font-size: 28px;
              font-weight: 700;
              margin-bottom: 8px;
              letter-spacing: -0.025em;
            }
            .subtitle {
              opacity: 0.9;
              font-size: 16px;
              font-weight: 400;
            }
            .content {
              padding: 40px 30px;
            }
            .greeting {
              font-size: 24px;
              font-weight: 700;
              color: #1a202c;
              margin-bottom: 16px;
              text-align: center;
            }
            .message {
              font-size: 16px;
              color: #4a5568;
              margin-bottom: 32px;
              line-height: 1.7;
              text-align: center;
            }
            .features {
              margin: 32px 0;
            }
            .feature {
              background: #f7fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 20px;
              margin: 16px 0;
              display: flex;
              align-items: center;
            }
            .feature-icon {
              font-size: 24px;
              margin-right: 16px;
              min-width: 40px;
            }
            .feature-content {
              flex: 1;
            }
            .feature-title {
              font-size: 16px;
              font-weight: 600;
              color: #2d3748;
              margin-bottom: 4px;
            }
            .feature-desc {
              font-size: 14px;
              color: #718096;
            }
            .button-container {
              text-align: center;
              margin: 40px 0;
            }
            .cta-button {
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 16px 32px;
              text-decoration: none;
              border-radius: 12px;
              font-weight: 600;
              font-size: 16px;
              transition: all 0.3s ease;
              box-shadow: 0 4px 14px 0 rgba(102, 126, 234, 0.39);
            }
            .cta-button:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 20px 0 rgba(102, 126, 234, 0.5);
            }
            .stats {
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              border-radius: 12px;
              padding: 24px;
              margin: 32px 0;
              text-align: center;
              color: white;
            }
            .stats-title {
              font-size: 16px;
              font-weight: 600;
              margin-bottom: 12px;
              opacity: 0.9;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 16px;
            }
            .stat-item {
              text-align: center;
            }
            .stat-number {
              font-size: 20px;
              font-weight: 700;
              display: block;
            }
            .stat-label {
              font-size: 12px;
              opacity: 0.8;
            }
            .footer {
              background: #f7fafc;
              padding: 30px;
              text-align: center;
              border-top: 1px solid #e2e8f0;
            }
            .footer-text {
              font-size: 13px;
              color: #718096;
              margin-bottom: 8px;
            }
            .social-links {
              margin-top: 16px;
            }
            .social-link {
              display: inline-block;
              margin: 0 8px;
              color: #667eea;
              text-decoration: none;
              font-size: 14px;
              font-weight: 500;
            }
            @media (max-width: 600px) {
              .container {
                margin: 20px;
                border-radius: 12px;
              }
              .header, .content, .footer {
                padding: 24px 20px;
              }
              .logo {
                font-size: 24px;
              }
              .greeting {
                font-size: 20px;
              }
              .feature {
                flex-direction: column;
                text-align: center;
              }
              .feature-icon {
                margin: 0 0 12px 0;
              }
              .stats-grid {
                grid-template-columns: 1fr;
                gap: 12px;
              }
              .cta-button {
                padding: 14px 28px;
                font-size: 15px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🎉 Nyo Archive</div>
              <div class="subtitle">Bem-vindo à comunidade!</div>
            </div>
            
            <div class="content">
              <div class="greeting">Parabéns, ${nickname}!</div>
              
              <div class="message">
                Sua conta foi criada com sucesso! Agora você faz parte da maior comunidade de assets VRChat do Brasil.
              </div>
              
              <div class="stats">
                <div class="stats-title">Junte-se à nossa comunidade ativa</div>
                <div class="stats-grid">
                  <div class="stat-item">
                    <span class="stat-number">10K+</span>
                    <span class="stat-label">Assets</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-number">5K+</span>
                    <span class="stat-label">Usuários</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-number">50K+</span>
                    <span class="stat-label">Downloads</span>
                  </div>
                </div>
              </div>
              
              <div class="features">
                <div class="feature">
                  <div class="feature-icon">📤</div>
                  <div class="feature-content">
                    <div class="feature-title">Upload de Assets</div>
                    <div class="feature-desc">Compartilhe seus avatares, roupas e acessórios com a comunidade</div>
                  </div>
                </div>
                
                <div class="feature">
                  <div class="feature-icon">⬇️</div>
                  <div class="feature-content">
                    <div class="feature-title">Downloads Gratuitos</div>
                    <div class="feature-desc">Acesse milhares de assets criados pela comunidade</div>
                  </div>
                </div>
                
                <div class="feature">
                  <div class="feature-icon">⭐</div>
                  <div class="feature-content">
                    <div class="feature-title">Sistema de Favoritos</div>
                    <div class="feature-desc">Salve e organize seus assets preferidos</div>
                  </div>
                </div>
                
                <div class="feature">
                  <div class="feature-icon">💬</div>
                  <div class="feature-content">
                    <div class="feature-title">Comunidade Ativa</div>
                    <div class="feature-desc">Interaja com outros criadores e receba feedback</div>
                  </div>
                </div>
              </div>

              <div class="button-container">
                <a href="${process.env.FRONTEND_URL}/login" class="cta-button">
                  🚀 Começar Agora
                </a>
              </div>
            </div>
            
            <div class="footer">
              <div class="footer-text">
                © 2025 Nyo Archive - Comunidade de Assets VRChat
              </div>
              <div class="social-links">
                <a href="#" class="social-link">Discord</a>
                <a href="#" class="social-link">Twitter</a>
                <a href="#" class="social-link">GitHub</a>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email de boas-vindas enviado para: ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar email de boas-vindas:', error);
      // Não falha o processo se o email de boas-vindas falhar
      return false;
    }
  }

  // Método para obter estilos CSS dos emails
  getEmailStyles() {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        line-height: 1.6;
        color: #1a1a1a;
        background: #f8fafc;
      }
      .email-container {
        max-width: 600px;
        margin: 40px auto;
        background: #ffffff;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      }
      .header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 40px 30px;
        text-align: center;
        color: white;
      }
      .logo {
        font-size: 28px;
        font-weight: 700;
        margin-bottom: 8px;
        letter-spacing: -0.025em;
      }
      .content {
        padding: 40px 30px;
      }
      .content h1 {
        font-size: 24px;
        font-weight: 700;
        color: #1a202c;
        margin-bottom: 24px;
        text-align: center;
      }
      .greeting {
        font-size: 18px;
        font-weight: 600;
        color: #1a202c;
        margin-bottom: 16px;
      }
      .content p {
        font-size: 16px;
        color: #4a5568;
        margin-bottom: 16px;
        line-height: 1.7;
      }
      .button-container {
        text-align: center;
        margin: 32px 0;
      }
      .confirm-button {
        display: inline-block;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 32px;
        text-decoration: none;
        border-radius: 12px;
        font-weight: 600;
        font-size: 16px;
        transition: all 0.3s ease;
        box-shadow: 0 4px 14px 0 rgba(102, 126, 234, 0.39);
      }
      .confirm-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px 0 rgba(102, 126, 234, 0.5);
      }
      .divider {
        height: 1px;
        background: #e2e8f0;
        margin: 32px 0;
      }
      .alternative {
        background: #f7fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 20px;
        margin: 24px 0;
      }
      .alternative h3 {
        font-size: 14px;
        font-weight: 600;
        color: #2d3748;
        margin-bottom: 8px;
      }
      .link-text {
        font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
        font-size: 13px;
        color: #667eea;
        word-break: break-all;
        background: white;
        padding: 12px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        margin-top: 8px;
      }
      .security-notice {
        background: #fff7ed;
        border: 1px solid #fed7aa;
        border-radius: 12px;
        padding: 20px;
        margin: 24px 0;
      }
      .security-notice h3 {
        color: #ea580c;
        margin: 0 0 12px 0;
        font-size: 16px;
      }
      .security-notice ul {
        margin: 0;
        padding-left: 20px;
        color: #7c2d12;
      }
      .security-notice li {
        margin: 8px 0;
      }
      .footer {
        background: #f7fafc;
        padding: 30px;
        text-align: center;
        border-top: 1px solid #e2e8f0;
      }
      .footer-text {
        font-size: 13px;
        color: #718096;
        margin-bottom: 8px;
      }
      .social-links {
        margin-top: 16px;
      }
      .social-link {
        display: inline-block;
        margin: 0 8px;
        color: #667eea;
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
      }
      @media (max-width: 600px) {
        .email-container {
          margin: 20px;
          border-radius: 12px;
        }
        .header, .content, .footer {
          padding: 24px 20px;
        }
        .logo {
          font-size: 24px;
        }
        .content h1 {
          font-size: 20px;
        }
        .greeting {
          font-size: 16px;
        }
        .content p {
          font-size: 15px;
        }
        .confirm-button {
          padding: 14px 28px;
          font-size: 15px;
        }
      }
    `;
  }

  // Enviar email de reset de senha
  async sendPasswordResetEmail(email, name, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: '"Nyo Archive" <noreply@nyoarchive.com>',
      to: email,
      subject: 'Redefinir sua senha - Nyo Archive',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Redefinir Senha - Nyo Archive</title>
          <style>
            ${this.getEmailStyles()}
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <div class="logo">
                🎭 Nyo Archive
              </div>
            </div>
            
            <div class="content">
              <h1>Redefinir sua senha</h1>
              
              <p class="greeting">Olá, ${name}!</p>
              
              <p>
                Recebemos uma solicitação para redefinir a senha da sua conta no Nyo Archive.
                Se você não fez esta solicitação, pode ignorar este email com segurança.
              </p>
              
              <div class="button-container">
                <a href="${resetUrl}" class="confirm-button">
                  🔐 Redefinir Senha
                </a>
              </div>
              
              <div class="divider"></div>
              
              <div class="alternative">
                <h3>Link não funciona?</h3>
                <p>Copie e cole este link no seu navegador:</p>
                <p class="link-text">${resetUrl}</p>
              </div>
              
              <div class="security-notice">
                <h3>⚠️ Importante:</h3>
                <ul>
                  <li>Este link expira em <strong>1 hora</strong></li>
                  <li>Use apenas se você solicitou a redefinição</li>
                  <li>Nunca compartilhe este link com outras pessoas</li>
                </ul>
              </div>
            </div>
            
            <div class="footer">
              <div class="footer-text">
                © 2025 Nyo Archive - Comunidade de Assets VRChat
              </div>
              <div class="social-links">
                <a href="#" class="social-link">Discord</a>
                <a href="#" class="social-link">Twitter</a>
                <a href="#" class="social-link">GitHub</a>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email de reset de senha enviado para: ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar email de reset de senha:', error);
      throw error;
    }
  }

  // Enviar email de confirmação de senha alterada
  async sendPasswordChangedEmail(email, name) {
    const mailOptions = {
      from: '"Nyo Archive" <noreply@nyoarchive.com>',
      to: email,
      subject: 'Senha alterada com sucesso - Nyo Archive',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Senha Alterada - Nyo Archive</title>
          <style>
            ${this.getEmailStyles()}
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <div class="logo">
                🎭 Nyo Archive
              </div>
            </div>
            
            <div class="content">
              <h1>Senha alterada com sucesso!</h1>
              
              <p class="greeting">Olá, ${name}!</p>
              
              <p>
                Sua senha foi alterada com sucesso. Agora você pode fazer login
                com sua nova senha.
              </p>
              
              <div class="security-notice">
                <h3>🔒 Segurança da sua conta:</h3>
                <ul>
                  <li>Sua senha foi redefinida em ${new Date().toLocaleString('pt-BR')}</li>
                  <li>Se você não fez esta alteração, entre em contato conosco imediatamente</li>
                  <li>Mantenha sua senha segura e não compartilhe com ninguém</li>
                </ul>
              </div>
              
              <div class="button-container">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" class="confirm-button">
                  🚀 Fazer Login
                </a>
              </div>
            </div>
            
            <div class="footer">
              <div class="footer-text">
                © 2025 Nyo Archive - Comunidade de Assets VRChat
              </div>
              <div class="social-links">
                <a href="#" class="social-link">Discord</a>
                <a href="#" class="social-link">Twitter</a>
                <a href="#" class="social-link">GitHub</a>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email de confirmação de senha alterada enviado para: ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar email de confirmação:', error);
      // Não falha o processo se o email de confirmação falhar
      return false;
    }
  }
}

module.exports = new EmailService();
