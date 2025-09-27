#!/bin/bash
# Script para gerar certificados SSL auto-assinados para desenvolvimento

# Criar diretório SSL se não existir
mkdir -p ssl

# Gerar certificado auto-assinado
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout ssl/localhost.key \
  -out ssl/localhost.crt \
  -subj "/C=BR/ST=SP/L=SaoPaulo/O=VRCHIEVE/OU=Development/CN=localhost/emailAddress=dev@vrchieve.local" \
  -addext "subjectAltName=DNS:localhost,DNS:api.localhost,IP:127.0.0.1"

# Definir permissões corretas
chmod 600 ssl/localhost.key
chmod 644 ssl/localhost.crt

echo "✅ Certificados SSL de desenvolvimento gerados:"
echo "   - nginx/ssl/localhost.key"
echo "   - nginx/ssl/localhost.crt"
echo ""
echo "⚠️  Para usar HTTPS em desenvolvimento, configure o navegador para aceitar certificados auto-assinados"
echo "   ou adicione o certificado às autoridades certificadoras confiáveis do sistema."