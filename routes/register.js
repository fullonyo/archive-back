const express = require('express');
const registrationService = require('../services/registrationService');
const prisma = require('../config/prisma');
const router = express.Router();

// GET /api/register/check-email/:email - Verificar se email está disponível
router.get('/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;

    // Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email inválido'
      });
    }

    const result = await registrationService.checkEmailAvailability(email);

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Erro ao verificar email:', error);
    
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// POST /api/register - Criar registro pendente
router.post('/', async (req, res) => {
  try {
    const { nickname, email, discord, password } = req.body;

    // Validações básicas
    if (!nickname || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nickname, email e senha são obrigatórios'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Senha deve ter pelo menos 6 caracteres'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email inválido'
      });
    }

    // Criar registro pendente
    const result = await registrationService.createPendingRegistration({
      nickname,
      email,
      discord,
      password
    });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Verifique seu email para confirmar o cadastro'
    });

  } catch (error) {
    console.error('❌ Erro no registro:', error);
    
    res.status(400).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

// GET /api/register/confirm/:token - Confirmar email
router.get('/confirm/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token de confirmação é obrigatório'
      });
    }

    const result = await registrationService.confirmEmail(token);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Email confirmado com sucesso! Sua conta foi criada.'
    });

  } catch (error) {
    console.error('❌ Erro na confirmação:', error);
    
    let statusCode = 400;
    if (error.message.includes('expirado')) {
      statusCode = 410; // Gone
    } else if (error.message.includes('inválido')) {
      statusCode = 404;
    }

    res.status(statusCode).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

// POST /api/register/resend - Reenviar email de confirmação
router.post('/resend', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email é obrigatório'
      });
    }

    const result = await registrationService.resendConfirmationEmail(email);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Email de confirmação reenviado'
    });

  } catch (error) {
    console.error('❌ Erro ao reenviar:', error);
    
    res.status(400).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

// GET /api/register/status/:email - Verificar status do registro
router.get('/status/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const registration = await prisma.userRegistration.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        nickname: true,
        isConfirmed: true,
        createdAt: true,
        tokenExpiresAt: true
      }
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registro não encontrado'
      });
    }

    const isExpired = new Date() > registration.tokenExpiresAt;

    res.status(200).json({
      success: true,
      data: {
        ...registration,
        isExpired,
        canResend: !registration.isConfirmed && !isExpired
      }
    });

  } catch (error) {
    console.error('❌ Erro ao verificar status:', error);
    
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
