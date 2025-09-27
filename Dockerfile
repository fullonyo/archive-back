# Multi-stage build otimizado para VRCHIEVE Backend
FROM node:18-alpine AS base

# Instalar dependências necessárias e ferramentas de build
RUN apk add --no-cache \
    libc6-compat \
    dumb-init \
    && npm install -g npm@latest

# Criar usuário não-root desde o início
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nodeuser

WORKDIR /app

# Copiar arquivos de dependências primeiro para otimizar cache
COPY --chown=nodeuser:nodejs package*.json ./
COPY --chown=nodeuser:nodejs prisma ./prisma/

# ================================
# Stage para dependências de produção
# ================================
FROM base AS deps
USER nodeuser
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# ================================
# Stage para build e desenvolvimento
# ================================
FROM base AS builder
USER nodeuser

# Instalar todas as dependências (dev + prod)
RUN npm ci --ignore-scripts

# Copiar código fonte
COPY --chown=nodeuser:nodejs . .

# Generate Prisma client
RUN npx prisma generate

# Limpar cache npm
RUN npm cache clean --force

# ================================
# Stage final - produção
# ================================
FROM node:18-alpine AS runner

# Instalar dumb-init para signal handling
RUN apk add --no-cache dumb-init

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nodeuser

WORKDIR /app

# Copiar dependências de produção
COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules

# Copiar cliente Prisma gerado
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Copiar código da aplicação
COPY --chown=nodeuser:nodejs . .

# Criar diretórios necessários com permissões corretas
RUN mkdir -p /app/cdn-cache/assets \
             /app/cdn-cache/images \
             /app/cdn-cache/thumbnails \
             /app/cdn-cache/proxy-images \
             /app/logs \
    && chown -R nodeuser:nodejs /app/cdn-cache /app/logs

# Definir variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3001
ENV NPM_CONFIG_CACHE=/tmp/.npm

# Mudar para usuário não-root
USER nodeuser

# Expor a porta
EXPOSE 3001

# Health check otimizado
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "const http = require('http'); \
    const options = { hostname: 'localhost', port: 3001, path: '/health', timeout: 5000 }; \
    const req = http.request(options, (res) => process.exit(res.statusCode === 200 ? 0 : 1)); \
    req.on('error', () => process.exit(1)); \
    req.on('timeout', () => process.exit(1)); \
    req.end();"

# Usar dumb-init para signal handling correto
ENTRYPOINT ["dumb-init", "--"]

# Comando para iniciar a aplicação
CMD ["node", "server.js"]