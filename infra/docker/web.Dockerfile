FROM oven/bun:1.3.14

WORKDIR /workspace
ENV BUN_INSTALL_CACHE_DIR=/root/.bun/install/cache

COPY package.json bun.lock ./
COPY apps/mobile/package.json ./apps/mobile/
COPY apps/web/package.json ./apps/web/
COPY packages/ui/package.json ./packages/ui/
RUN bun install --frozen-lockfile

COPY . .

WORKDIR /workspace/apps/web
EXPOSE 3000
CMD ["bun", "x", "next", "dev", "--hostname", "0.0.0.0", "--port", "3000"]
