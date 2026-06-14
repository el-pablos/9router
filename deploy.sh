#!/usr/bin/env bash
# deploy.sh - 9Router deployment script
# Usage: ./deploy.sh [target]
# Targets: pm2 | docker | railway | fly | build
#
# Prerequisites:
#   - Docker installed (for docker target)
#   - Railway CLI logged in (for railway target)
#   - Fly.io CLI logged in (for fly target)
#   - PM2 installed (for pm2 target)
#

set -euo pipefail

APP_NAME="9router"
VERSION=$(node -p "require('./package.json').version")
IMAGE="ghcr.io/el-pablos/9router:${VERSION}"
LATEST_IMAGE="ghcr.io/el-pablos/9router:latest"
PM2_APP="9router-source-20129"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[${APP_NAME}]${NC} $1"; }
warn() { echo -e "${YELLOW}[${APP_NAME}] WARN:${NC} $1"; }
error() { echo -e "${RED}[${APP_NAME}] ERROR:${NC} $1" >&2; }

# Detect target
TARGET="${1:-pm2}"

cd "$(dirname "$0")"

log "Deploying ${APP_NAME} v${VERSION} to ${TARGET}..."

case "${TARGET}" in
  pm2)
    # Step 1: Build
    log "Step 1/4 — Building..."
    NODE_OPTIONS="--max-old-space-size=3072" npm install --legacy-peer-deps
    NODE_OPTIONS="--max-old-space-size=3072" npm run build

    # Step 2: Sync static assets to standalone output
    # Next.js standalone build does NOT include static/public — must copy manually
    log "Step 2/4 — Syncing static assets..."
    rsync -a --delete .next/static/ .next/standalone/.next/static/
    rsync -a --delete public/       .next/standalone/public/

    # Verify BUILD_ID match
    main_bid=$(cat .next/BUILD_ID)
    st_bid=$(cat .next/standalone/.next/BUILD_ID)
    if [ "$main_bid" != "$st_bid" ]; then
      error "BUILD_ID mismatch! main=${main_bid} standalone=${st_bid}"
      exit 1
    fi
    log "  BUILD_ID: ${main_bid} ✓"

    # Step 3: Restart PM2
    log "Step 3/4 — Restarting PM2 (${PM2_APP})..."
    NODE_ENV=production PORT=20129 HOSTNAME=127.0.0.1 \
      BASE_URL=https://proxy.tams.codes \
      NEXT_PUBLIC_BASE_URL=https://proxy.tams.codes \
      CLOUD_URL=https://proxy.tams.codes \
      NEXT_PUBLIC_CLOUD_URL=https://proxy.tams.codes \
      pm2 restart "${PM2_APP}" --update-env

    # Step 4: Save PM2 state for reboot resurrect
    log "Step 4/4 — Saving PM2 state..."
    pm2 save

    # Verify health
    sleep 3
    HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' https://proxy.tams.codes/api/health)
    if [ "$HTTP_CODE" = "200" ]; then
      log "Health check: ${HTTP_CODE} ✓"
    else
      error "Health check failed: ${HTTP_CODE}"
      exit 1
    fi

    log "PM2 deployment complete! v${VERSION}"
    ;;

  docker)
    log "Building Docker image: ${IMAGE}"
    docker build \
      --build-arg NODE_IMAGE=node:22-alpine \
      --tag "${IMAGE}" \
      --tag "${LATEST_IMAGE}" \
      .

    log "Docker image built successfully!"
    log "  Image: ${IMAGE}"
    log "  Latest: ${LATEST_IMAGE}"
    log ""
    log "To run locally:"
    log "  docker run -p 20128:20128 --env-file .env.local ${IMAGE}"
    log ""
    log "To push to GHCR:"
    log "  docker push ${IMAGE} && docker push ${LATEST_IMAGE}"
    ;;

  railway)
    log "Deploying to Railway..."
    if ! command -v railway 2>/dev/null; then
      error "Railway CLI not found. Install: curl https://railway.app/install.sh | sh"
      exit 1
    fi
    railway up --project "${APP_NAME}"
    log "Railway deployment initiated!"
    ;;

  fly)
    log "Deploying to Fly.io..."
    if ! command -v fly 2>/dev/null; then
      error "Fly.io CLI not found. Install: curl -L https://fly.io/install.sh | sh"
      exit 1
    fi
    fly deploy --app "${APP_NAME}"
    log "Fly.io deployment complete!"
    ;;

  build)
    log "Building for production (no deployment)..."
    NODE_OPTIONS="--max-old-space-size=3072" npm install --legacy-peer-deps
    NODE_OPTIONS="--max-old-space-size=3072" npm run build
    log "Build complete! Output in .next/standalone/"
    ;;

  test)
    log "Running test suite..."
    NODE_OPTIONS="--max-old-space-size=3072" npm run build
    npx vitest run
    log "Tests complete!"
    ;;

  *)
    error "Unknown target: ${TARGET}"
    echo ""
    echo "Usage: $0 [target]"
    echo ""
    echo "Targets:"
    echo "  pm2     - Build + sync static + restart PM2 + health check (default)"
    echo "  docker  - Build Docker image locally"
    echo "  railway - Deploy to Railway"
    echo "  fly     - Deploy to Fly.io"
    echo "  build   - Build for production only"
    echo "  test    - Build + run test suite"
    exit 1
    ;;
esac

log "Done!"