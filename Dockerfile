From node:20-alpine as builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN apk add --no-cache \
    git
COPY . .
RUN npm i
RUN npm run build

FROM builder as deploy

ARG PORT
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json app/package-lock.json ./

CMD ["node", "dist/app.js"]