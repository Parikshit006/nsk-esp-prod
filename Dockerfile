FROM node:24.22.0-bookworm-slim
WORKDIR /app
RUN npm install --global pnpm@12.8.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm build
USER node
EXPOSE 3000
CMD ["sh", "-c", "node apps/api/dist/apps/api/src/migrate-cli.js && node apps/api/dist/apps/api/src/server.js"]
