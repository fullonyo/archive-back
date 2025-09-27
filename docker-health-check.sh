#!/bin/bash

# =================================
# Script de Verificação do Docker
# =================================

echo "🔍 Verificando configuração do Docker para VRCHIEVE Backend..."
echo "============================================================="

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não está instalado!"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose não está instalado!"
    exit 1
fi

echo "✅ Docker e Docker Compose estão instalados"

# Verificar arquivos de configuração
FILES_TO_CHECK=(
    "docker-compose.yml"
    "docker-compose.prod.yml"
    "Dockerfile"
    ".env.example"
    "package.json"
    "server.js"
    "prisma/schema.prisma"
)

echo ""
echo "📂 Verificando arquivos de configuração:"
for file in "${FILES_TO_CHECK[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file - FALTANDO!"
    fi
done

# Verificar se existe .env
echo ""
if [ -f ".env" ]; then
    echo "✅ Arquivo .env encontrado"
    echo "⚠️  Certifique-se de que todas as variáveis necessárias estão configuradas"
else
    echo "⚠️  Arquivo .env não encontrado!"
    echo "📝 Copie .env.example para .env e configure as variáveis:"
    echo "   cp .env.example .env"
fi

# Testar sintaxe do docker-compose
echo ""
echo "🔍 Verificando sintaxe dos arquivos Docker Compose..."

if docker-compose -f docker-compose.yml config &> /dev/null; then
    echo "✅ docker-compose.yml - Sintaxe OK"
else
    echo "❌ docker-compose.yml - Erro de sintaxe!"
    docker-compose -f docker-compose.yml config
fi

if docker-compose -f docker-compose.yml -f docker-compose.prod.yml config &> /dev/null; then
    echo "✅ docker-compose.prod.yml - Sintaxe OK"
else
    echo "❌ docker-compose.prod.yml - Erro de sintaxe!"
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml config
fi

# Verificar portas
echo ""
echo "🔍 Verificando se as portas estão livres..."

PORTS_TO_CHECK=(80 443 3001 6379 8080 8081 9229)

for port in "${PORTS_TO_CHECK[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  Porta $port está em uso"
    else
        echo "✅ Porta $port está livre"
    fi
done

# Comandos úteis
echo ""
echo "📋 Comandos úteis:"
echo "============================================================="
echo "# Desenvolvimento:"
echo "docker-compose up --build"
echo ""
echo "# Produção:"
echo "docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build"
echo ""
echo "# Ver logs:"
echo "docker-compose logs -f backend"
echo "docker-compose logs -f nginx"
echo "docker-compose logs -f redis"
echo ""
echo "# Parar tudo:"
echo "docker-compose down"
echo ""
echo "# Limpar tudo:"
echo "docker-compose down -v --remove-orphans"
echo "docker system prune -f"

echo ""
echo "🎉 Verificação concluída!"