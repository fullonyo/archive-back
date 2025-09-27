# Multi-stage build para otimizar o tamanho da imagem final
FROM node:18-alpine AS base

# Instalar dependências necessárias para build
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copiar arquivos de dependências primeiro para otimizar cache
COPY package.json package-lock.json* ./

# Stage para instalação de dependências
FROM base AS deps
RUN npm ci --only=production --ignore-scripts

# Stage para build (caso necessite de build steps no futuro)
FROM base AS builder
COPY . .
RUN npm ci --ignore-scripts

# Generate Prisma client
RUN npx prisma generate

# Stage final - produção
FROM node:18-alpine AS runner

# Criar usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodeuser

WORKDIR /app

# Copiar dependências de produção
COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules

# Copiar código da aplicação
COPY --chown=nodeuser:nodejs . .

# Criar diretórios necessários com permissões corretas
RUN mkdir -p /app/cdn-cache/assets /app/cdn-cache/images /app/cdn-cache/thumbnails /app/cdn-cache/proxy-images
RUN chown -R nodeuser:nodejs /app/cdn-cache

# Definir variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3001

# Expor a porta
EXPOSE 3001

# Mudar para usuário não-root
USER nodeuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Comando para iniciar a aplicação
CMD ["node", "server.js"]