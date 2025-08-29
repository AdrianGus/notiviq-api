FROM node:22-alpine AS base
WORKDIR /app

# dependências
COPY package.json package-lock.json* ./
RUN npm i --no-audit --no-fund

# tsconfig e código
COPY tsconfig.json ./
COPY src ./src

# ✅ copie a pasta 'public' da raiz (e não src/public)
COPY public ./public

CMD ["npm", "run", "dev"]
