FROM oven/bun:1.3.14

WORKDIR /workspace
ENV BUN_INSTALL_CACHE_DIR=/root/.bun/install/cache

COPY package.json bun.lock ./
COPY apps/mobile/package.json ./apps/mobile/
COPY apps/web/package.json ./apps/web/
COPY packages/ui/package.json ./packages/ui/
RUN bun install --frozen-lockfile

COPY . .

CMD ["bun", "x", "convex", "dev", "--configure", "new", "--dev-deployment", "local", "--typecheck", "disable"]
