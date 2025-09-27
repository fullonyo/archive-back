# Multi-stage build otimizado para VRCHIEVE Backend com máximo cache
FROM node:18-alpine AS base

# Instalar dependências do sistema (cached enquanto não mudar)
RUN apk add --no-cache \
    libc6-compat \
    dumb-init

# Criar usuário não-root (cached)
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nodeuser

WORKDIR /app

# ================================
# Stage 1: Dependências de Produção
# ================================
FROM base AS deps-prod

# IMPORTANTE: Copiar apenas package.json e package-lock.json primeiro
# Isso permite cache quando só o código muda, não as dependências
COPY package*.json ./

# Instalar apenas dependências de produção com retry
RUN npm config set fetch-retry-maxtimeout 300000 \
    && npm config set fetch-retry-mintimeout 30000 \
    && npm config set fetch-retries 5 \
    && npm config set fetch-timeout 600000 \
    && npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force

# ================================
# Stage 2: Todas as Dependências + Build
# ================================
FROM base AS deps-all

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar TODAS as dependências (prod + dev) para build com retry
RUN npm config set fetch-retry-maxtimeout 300000 \
    && npm config set fetch-retry-mintimeout 30000 \
    && npm config set fetch-retries 5 \
    && npm config set fetch-timeout 600000 \
    && npm ci --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force

# Copiar schema do Prisma (só rebuilda se schema mudar)
COPY prisma ./prisma/

# Gerar Prisma Client (só rebuilda se schema ou package.json mudaram)
RUN npx prisma generate

# ================================
# Stage 3: Build da Aplicação
# ================================
FROM deps-all AS builder

# Copiar código fonte apenas agora (último step = máximo cache)
COPY . .

# Qualquer step de build adicional aqui (transpiling, etc.)
# Por enquanto não temos, mas ficaria aqui

# ================================
# Stage Final: Produção
# ================================
FROM node:18-alpine AS runner

# Instalar apenas dumb-init
RUN apk add --no-cache dumb-init

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nodeuser

WORKDIR /app

# Copiar dependências de produção (do stage deps-prod)
COPY --from=deps-prod --chown=nodeuser:nodejs /app/node_modules ./node_modules

# Copiar Prisma Client gerado (do stage deps-all)
COPY --from=deps-all --chown=nodeuser:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Copiar apenas o código necessário para produção
COPY --chown=nodeuser:nodejs package*.json ./
COPY --chown=nodeuser:nodejs server.js ./
COPY --chown=nodeuser:nodejs routes ./routes/
COPY --chown=nodeuser:nodejs services ./services/
COPY --chown=nodeuser:nodejs middleware ./middleware/
COPY --chown=nodeuser:nodejs utils ./utils/
COPY --chown=nodeuser:nodejs config ./config/
COPY --chown=nodeuser:nodejs prisma ./prisma/

# Criar diretórios de cache e logs com permissões corretas
RUN mkdir -p /app/cdn-cache/assets \
             /app/cdn-cache/images \
             /app/cdn-cache/thumbnails \
             /app/cdn-cache/proxy-images \
             /app/logs \
    && chown -R nodeuser:nodejs /app/cdn-cache /app/logs

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3001
ENV NPM_CONFIG_CACHE=/tmp/.npm

# Mudar para usuário não-root
USER nodeuser

# Expor porta
EXPOSE 3001

# Health check otimizado
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "const http = require('http'); \
    const req = http.request({ hostname: 'localhost', port: 3001, path: '/health', timeout: 5000 }, \
    (res) => process.exit(res.statusCode === 200 ? 0 : 1)); \
    req.on('error', () => process.exit(1)); \
    req.on('timeout', () => process.exit(1)); \
    req.end();"

# Usar dumb-init para signal handling
ENTRYPOINT ["dumb-init", "--"]

# Iniciar aplicação
CMD ["node", "server.js"]