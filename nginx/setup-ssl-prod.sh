#!/bin/bash
# Script para configurar Let's Encrypt em produção

set -e

DOMAIN=$1
EMAIL=$2

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "❌ Uso: $0 <domain> <email>"
    echo "   Exemplo: $0 vrchieve.com admin@vrchieve.com"
    exit 1
fi

echo "🔒 Configurando SSL para $DOMAIN com Let's Encrypt..."

# Criar diretórios necessários
mkdir -p letsencrypt
mkdir -p certbot-webroot

# Primeira execução do Certbot (staging para teste)
echo "🧪 Testando com certificado staging..."
docker-compose -f docker-compose.yml -f docker-compose.ssl.yml run --rm \
  certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email $EMAIL \
  --agree-tos \
  --no-eff-email \
  --staging \
  -d $DOMAIN \
  -d www.$DOMAIN

if [ $? -eq 0 ]; then
    echo "✅ Teste com staging bem-sucedido!"
    
    # Perguntar se quer continuar com certificado real
    read -p "🚀 Gerar certificado de produção? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔐 Gerando certificado de produção..."
        
        # Remover certificado staging
        docker-compose -f docker-compose.yml -f docker-compose.ssl.yml run --rm \
          certbot delete --cert-name $DOMAIN
        
        # Gerar certificado de produção
        docker-compose -f docker-compose.yml -f docker-compose.ssl.yml run --rm \
          certbot certonly --webroot \
          --webroot-path=/var/www/certbot \
          --email $EMAIL \
          --agree-tos \
          --no-eff-email \
          -d $DOMAIN \
          -d www.$DOMAIN
        
        if [ $? -eq 0 ]; then
            echo "✅ Certificado SSL gerado com sucesso!"
            echo "🔄 Reiniciando Nginx para aplicar o certificado..."
            docker-compose restart nginx
            
            echo "🎉 SSL configurado com sucesso para $DOMAIN"
            echo "   Verifique: https://$DOMAIN/health"
        else
            echo "❌ Erro ao gerar certificado de produção"
            exit 1
        fi
    fi
else
    echo "❌ Erro no teste staging. Verifique a configuração DNS."
    exit 1
fi

# Configurar renovação automática
echo "⏰ Configurando renovação automática..."
(crontab -l 2>/dev/null; echo "0 12 * * * cd $(pwd)/.. && docker-compose -f docker-compose.yml -f docker-compose.ssl.yml run --rm certbot renew --quiet") | crontab -

echo "✅ Renovação automática configurada (diariamente às 12:00)"