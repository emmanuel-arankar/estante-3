# =================================================================
# Estágio 1: Build da API do Back-end
# =================================================================
FROM node:20-slim as backend-builder

# # atualizado: Foco na API do back-end
WORKDIR /app/backend-api

COPY backend-api/package*.json ./
RUN npm install

COPY backend-api/. .
RUN npm run build

# =================================================================
# Estágio 2: Imagem final de produção
# =================================================================
FROM node:20-slim

WORKDIR /app

# Copia as dependências de produção e o código compilado do estágio anterior
COPY --from=backend-builder /app/backend-api/node_modules ./node_modules
COPY --from=backend-builder /app/backend-api/package*.json ./
COPY --from=backend-builder /app/backend-api/dist ./dist

# Expõe a porta que o Cloud Run usará
EXPOSE 8080

# Comando para iniciar o servidor
CMD [ "npm", "start" ]