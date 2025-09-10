// Debug middleware para capturar requisições de login
const debugLogin = (req, res, next) => {
  if (req.path === '/api/auth/login' && req.method === 'POST') {
    console.log('🔍 LOGIN REQUEST DEBUG:');
    console.log('======================');
    console.log('📍 Path:', req.path);
    console.log('🔧 Method:', req.method);
    console.log('📋 Headers:', {
      'content-type': req.get('content-type'),
      'user-agent': req.get('user-agent'),
      'origin': req.get('origin'),
      'referer': req.get('referer')
    });
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
    console.log('🌐 IP:', req.ip);
    console.log('======================');
  }
  next();
};

module.exports = debugLogin;
