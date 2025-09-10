const express = require('express')
const router = express.Router()
const passwordResetService = require('../services/passwordResetService')

// Validação básica
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const validatePassword = (password) => {
  return password && password.length >= 6
}

// POST /password-reset/request - Solicitar reset de senha
router.post('/request', async (req, res) => {
  try {
    const { email } = req.body

    // Validar email
    if (!email || !validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email inválido'
      })
    }

    const result = await passwordResetService.requestPasswordReset(email)

    res.status(200).json({
      success: true,
      message: 'Se o email estiver cadastrado, você receberá as instruções para redefinir sua senha'
    })

  } catch (error) {
    console.error('Erro na solicitação de reset:', error)
    
    // Por segurança, sempre retorna sucesso para não revelar se o email existe
    res.status(200).json({
      success: true,
      message: 'Se o email estiver cadastrado, você receberá as instruções para redefinir sua senha'
    })
  }
})

// GET /password-reset/verify/:token - Verificar se token é válido
router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token obrigatório'
      })
    }

    const user = await passwordResetService.verifyResetToken(token)

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido ou expirado'
      })
    }

    res.status(200).json({
      success: true,
      message: 'Token válido',
      data: {
        email: user.email,
        name: user.username
      }
    })

  } catch (error) {
    console.error('Erro na verificação do token:', error)
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    })
  }
})

// POST /password-reset/confirm - Confirmar reset de senha
router.post('/confirm', async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body

    // Validar dados
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token obrigatório'
      })
    }

    if (!password || !validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Senha deve ter pelo menos 6 caracteres'
      })
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Senhas não coincidem'
      })
    }

    const result = await passwordResetService.resetPassword(token, password)

    res.status(200).json({
      success: true,
      message: 'Senha redefinida com sucesso'
    })

  } catch (error) {
    console.error('Erro ao confirmar reset:', error)
    
    if (error.message === 'Token inválido ou expirado') {
      return res.status(400).json({
        success: false,
        message: error.message
      })
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    })
  }
})

module.exports = router
