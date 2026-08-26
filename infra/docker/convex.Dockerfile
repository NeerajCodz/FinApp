FROM oven/bun:1.3.14

WORKDIR /workspace
ENV BUN_INSTALL_CACHE_DIR=/root/.bun/install/cache

COPY package.json bun.lock ./
COPY app/mobile/package.json ./app/mobile/
RUN bun install --frozen-lockfile

COPY . .

CMD ["bun", "x", "convex", "dev", "--configure", "new", "--dev-deployment", "local", "--typecheck", "disable"]
