FROM node:22-alpine AS base
WORKDIR /app

# dependências
COPY package.json package-lock.json* ./
RUN npm i --no-audit --no-fund

# tsconfig e código
COPY tsconfig.json ./
COPY src ./src

# expõe os estáticos em /app/public, copiando do src/public
# (no compose também montamos bind, então em dev você edita e vê ao vivo)
COPY src/public ./public

CMD ["npm", "run", "dev"]