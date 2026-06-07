#!/usr/bin/env bash
# deploy.sh - 9Router deployment script
# Usage: ./deploy.sh [target]
# Targets: docker | railway | fly | build
#
# Prerequisites:
#   - Docker installed (for docker target)
#   - Railway CLI logged in (for railway target)
#   - Fly.io CLI logged in (for fly target)

set -euo pipefail

APP_NAME="9router"
VERSION=$(node -p "require('./package.json').version")
IMAGE="ghcr.io/el-pablos/9router:${VERSION}"
LATEST_IMAGE="ghcr.io/el-pablos/9router:latest"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[${APP_NAME}]${NC} $1"; }
warn() { echo -e "${YELLOW}[${APP_NAME}] WARN:${NC} $1"; }
error() { echo -e "${RED}[${APP_NAME}] ERROR:${NC} $1" >&2; }

# Detect target
TARGET="${1:-docker}"

cd "$(dirname "$0")"

log "Deploying ${APP_NAME} v${VERSION} to ${TARGET}..."

case "${TARGET}" in
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
    npm install --legacy-peer-deps
    npm run build
    log "Build complete! Output in .next/standalone/"
    ;;

  test)
    log "Running test suite..."
    npm run build
    npx vitest run
    log "Tests complete!"
    ;;

  *)
    error "Unknown target: ${TARGET}"
    echo ""
    echo "Usage: $0 [target]"
    echo ""
    echo "Targets:"
    echo "  docker   - Build Docker image locally (default)"
    echo "  railway  - Deploy to Railway"
    echo "  fly      - Deploy to Fly.io"
    echo "  build    - Build for production only"
    echo "  test     - Build + run test suite"
    exit 1
    ;;
esac

log "Done!"