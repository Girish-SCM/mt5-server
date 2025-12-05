#!/usr/bin/env bash
# MT5 Server - Complete Build Script
# Builds Docker image and Electron app for specified platform
#
# Usage: ./build-all.sh [platform] [broker]
# Platforms: mac-arm64, mac-x64, linux, windows, all
# Broker: eightcap (default), metaquotes, exness, xm
#
# Examples:
#   ./build-all.sh mac-arm64           # Build for macOS ARM64
#   ./build-all.sh linux               # Build for Linux
#   ./build-all.sh all eightcap        # Build all platforms

set -e

# Default values
PLATFORM="${1:-mac-arm64}"
BROKER="${2:-eightcap}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Determine Docker architecture based on platform
get_docker_arch() {
    case "$1" in
        mac-arm64) echo "arm64" ;;
        mac-x64|linux|windows) echo "x86" ;;
        *) echo "x86" ;;
    esac
}

# Get Electron build command
get_electron_cmd() {
    case "$1" in
        mac-arm64) echo "npm run build:mac" ;;
        mac-x64) echo "npm run build:mac -- --arch=x64" ;;
        linux) echo "npm run build:linux" ;;
        windows) echo "npm run build:win" ;;
        all) echo "npm run build:mac && npm run build:linux" ;;
        *) echo "npm run build:mac" ;;
    esac
}

# Broker MT5 URLs
get_mt5_url() {
    case "$1" in
        eightcap)  echo "https://download.mql5.com/cdn/web/eightcap.global.limited/mt5/eightcapglobal5setup.exe" ;;
        metaquotes) echo "https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe" ;;
        exness)    echo "https://download.mql5.com/cdn/web/exness.technologies.ltd/mt5/exnessmt5setup.exe" ;;
        xm)        echo "https://download.mql5.com/cdn/web/xm.com/mt5/xmmt5setup.exe" ;;
        *)         echo "" ;;
    esac
}

show_usage() {
    echo "Usage: $0 [platform] [broker]"
    echo ""
    echo "Platforms:"
    echo "  mac-arm64  - macOS Apple Silicon (default)"
    echo "  mac-x64    - macOS Intel"
    echo "  linux      - Linux (AppImage, deb)"
    echo "  windows    - Windows (exe) - requires Wine on non-Windows"
    echo "  all        - All platforms (from current OS)"
    echo ""
    echo "Brokers:"
    echo "  eightcap   - Eightcap Global MT5 (default)"
    echo "  metaquotes - MetaQuotes MT5"
    echo "  exness     - Exness MT5"
    echo "  xm         - XM MT5"
    echo ""
    echo "Examples:"
    echo "  $0 mac-arm64"
    echo "  $0 linux eightcap"
    echo "  $0 all metaquotes"
}

# Validate inputs
MT5_URL=$(get_mt5_url "$BROKER")
if [ -z "$MT5_URL" ]; then
    print_error "Invalid broker: $BROKER"
    show_usage
    exit 1
fi

DOCKER_ARCH=$(get_docker_arch "$PLATFORM")
ELECTRON_CMD=$(get_electron_cmd "$PLATFORM")
IMAGE_TAG="localhost/avyaktha-mt5:${BROKER}-${DOCKER_ARCH}"

echo ""
echo "=========================================="
echo "  MT5 Server - Complete Build"
echo "=========================================="
echo "  Platform:    $PLATFORM"
echo "  Broker:      $BROKER"
echo "  Docker Arch: $DOCKER_ARCH"
echo "  Image Tag:   $IMAGE_TAG"
echo "=========================================="
echo ""

# Check for podman/docker
if command -v podman &> /dev/null; then
    CONTAINER_CMD="podman"
elif command -v docker &> /dev/null; then
    CONTAINER_CMD="docker"
else
    print_error "Neither podman nor docker found. Please install one."
    exit 1
fi

print_status "Using container runtime: $CONTAINER_CMD"

# ============================================
# STEP 1: Build Docker Image
# ============================================
print_status "📦 STEP 1: Building Docker image..."
echo ""

cd docker

DOCKERFILE="Dockerfile.${DOCKER_ARCH}"
if [ ! -f "$DOCKERFILE" ]; then
    print_error "$DOCKERFILE not found"
    exit 1
fi

# Determine platform flag
if [ "$DOCKER_ARCH" = "arm64" ]; then
    PLATFORM_FLAG="linux/arm64"
else
    PLATFORM_FLAG="linux/amd64"
fi

print_status "Building $DOCKERFILE for $PLATFORM_FLAG..."

$CONTAINER_CMD build \
    -f "$DOCKERFILE" \
    -t "$IMAGE_TAG" \
    --build-arg MT5_DOWNLOAD_URL="$MT5_URL" \
    --platform "$PLATFORM_FLAG" \
    .

print_success "Docker image built: $IMAGE_TAG"
cd ..

# ============================================
# STEP 2: Export Docker Image
# ============================================
print_status "📤 STEP 2: Exporting Docker image..."
echo ""

mkdir -p electron/bundled

print_status "Saving image to electron/bundled/mt5-server.tar..."
$CONTAINER_CMD save "$IMAGE_TAG" -o electron/bundled/mt5-server.tar

IMAGE_SIZE=$(ls -lh electron/bundled/mt5-server.tar | awk '{print $5}')
print_success "Image exported: $IMAGE_SIZE"

# ============================================
# STEP 3: Download Podman (macOS only)
# ============================================
if [[ "$PLATFORM" == mac-* ]]; then
    print_status "📥 STEP 3: Downloading Podman installer..."
    echo ""
    
    PODMAN_VERSION="5.2.2"
    if [ "$PLATFORM" = "mac-arm64" ]; then
        PODMAN_URL="https://github.com/containers/podman/releases/download/v${PODMAN_VERSION}/podman-installer-macos-arm64.pkg"
    else
        PODMAN_URL="https://github.com/containers/podman/releases/download/v${PODMAN_VERSION}/podman-installer-macos-amd64.pkg"
    fi
    
    if [ ! -f "electron/bundled/podman-installer.pkg" ]; then
        print_status "Downloading from $PODMAN_URL..."
        curl -L -o electron/bundled/podman-installer.pkg "$PODMAN_URL"
        print_success "Podman installer downloaded"
    else
        print_status "Podman installer already exists, skipping download"
    fi
else
    print_status "⏭️ STEP 3: Skipping Podman download (not macOS)"
fi

# ============================================
# STEP 4: Build Electron App
# ============================================
print_status "🔨 STEP 4: Building Electron app..."
echo ""

cd electron

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing npm dependencies..."
    npm ci
fi

print_status "Running: $ELECTRON_CMD"
export CSC_IDENTITY_AUTO_DISCOVERY=false
eval $ELECTRON_CMD

cd ..

# ============================================
# STEP 5: Summary
# ============================================
echo ""
echo "=========================================="
echo "  Build Complete!"
echo "=========================================="
print_success "Docker image: $IMAGE_TAG"
print_success "Electron app: electron/dist/"
echo ""

print_status "Built artifacts:"
ls -lh electron/dist/ 2>/dev/null | grep -E '\.(dmg|exe|AppImage|deb)$' || echo "  (check electron/dist/ for outputs)"

echo ""
print_status "To test the Electron app:"
if [[ "$PLATFORM" == mac-* ]]; then
    echo "  open electron/dist/*.dmg"
elif [ "$PLATFORM" = "linux" ]; then
    echo "  ./electron/dist/*.AppImage"
fi
echo ""
