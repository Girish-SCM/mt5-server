#!/usr/bin/env bash
# MT5 ARM64 Container Build Script
# Build script for local MT5 Docker image using Hangover on ARM64
# Usage: ./build_local.sh [broker] [clean]
# Example: ./build_local.sh eightcap clean

set -e

# Default values
BROKER="${1:-eightcap}"
CLEAN_BUILD="${2}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Broker-specific MT5 download URLs (compatible with Bash 3.x)
get_mt5_url() {
    case "$1" in
        eightcap)  echo "https://download.mql5.com/cdn/web/eightcap.global.limited/mt5/eightcapglobal5setup.exe" ;;
        metaquotes) echo "https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe" ;;
        exness)    echo "https://download.mql5.com/cdn/web/exness.technologies.ltd/mt5/exnessmt5setup.exe" ;;
        xm)        echo "https://download.mql5.com/cdn/web/xm.com/mt5/xmmt5setup.exe" ;;
        *)         echo "" ;;
    esac
}

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [broker] [clean]"
    echo ""
    echo "Brokers:"
    echo "  eightcap    - Eightcap Global MT5 (default)"
    echo "  metaquotes  - MetaQuotes MT5"
    echo "  exness      - Exness MT5"
    echo "  xm          - XM MT5"
    echo ""
    echo "Options:"
    echo "  clean       - Clean all containers and images before build"
    echo ""
    echo "Examples:"
    echo "  $0                    # Build with Eightcap (default)"
    echo "  $0 eightcap          # Build with Eightcap"
    echo "  $0 metaquotes clean  # Clean environment and build with MetaQuotes"
    echo ""
}

# Validate broker and get URL
MT5_URL=$(get_mt5_url "$BROKER")
if [ -z "$MT5_URL" ]; then
    print_error "Invalid broker: $BROKER"
    echo ""
    show_usage
    exit 1
fi
IMAGE_TAG="localhost/avyaktha-mt5:${BROKER}-arm64"

print_status "🔨 Building MT5 Docker image for ARM64 (Apple Silicon)"
print_status "   Using Hangover (Wine for ARM64)"
print_status "   Broker: ${BROKER}"
print_status "   Tag: ${IMAGE_TAG}"
print_status "   MT5 URL: ${MT5_URL}"
echo ""

# Check if running on ARM64
ARCH=$(uname -m)
if [ "$ARCH" != "arm64" ] && [ "$ARCH" != "aarch64" ]; then
    print_warning "You are building on $ARCH architecture"
    print_warning "This image is optimized for ARM64 (Apple Silicon)"
    echo ""
fi

# Clean environment if requested
if [ "$CLEAN_BUILD" = "clean" ]; then
    print_status "🧹 Cleaning Podman environment..."
    
    # Stop all containers
    if [ "$(podman ps -q)" ]; then
        print_status "Stopping all running containers..."
        podman stop --all
    fi
    
    # Remove all containers
    if [ "$(podman ps -a -q)" ]; then
        print_status "Removing all containers..."
        podman rm --all --force
    fi
    
    # Remove all images
    if [ "$(podman images -q)" ]; then
        print_status "Removing all images..."
        podman rmi --all --force
    fi
    
    # System cleanup
    print_status "Cleaning up system..."
    podman system prune --all --force
    
    print_success "Environment cleaned successfully!"
    echo ""
fi

# Check if Dockerfile exists
if [ ! -f "Dockerfile" ]; then
    print_error "Dockerfile not found in current directory"
    print_error "Please run this script from the mt5docker.arm64 directory"
    exit 1
fi

# Build the image
print_status "🚀 Starting build process..."
echo ""

podman build \
    -f Dockerfile \
    -t "${IMAGE_TAG}" \
    --build-arg MT5_DOWNLOAD_URL="${MT5_URL}" \
    --platform linux/arm64 \
    .

echo ""
print_success "Build complete!"
echo ""

# Show image details
print_status "📦 Image details:"
podman images "${IMAGE_TAG}"

echo ""
print_status "🧪 To test the image:"
echo "  podman run -d --name mt5-test-arm64 \\"
echo "    -p 5901:5901 \\"
echo "    -p 6081:6081 \\"
echo "    -p 8001:8001 \\"
echo "    -e VNC_PWD=password \\"
echo "    -e MT5_HOST=0.0.0.0 \\"
echo "    ${IMAGE_TAG}"
echo ""

print_status "📊 Monitor container:"
echo "  podman logs -f mt5-test-arm64"
echo ""

print_status "🌐 Access methods:"
echo "  VNC:     localhost:5901 (password: password)"
echo "  Web VNC: http://localhost:6081"
echo "  RPC API: localhost:8001"
echo ""

print_status "🧹 Clean up test:"
echo "  podman stop mt5-test-arm64 && podman rm mt5-test-arm64"
echo ""

print_success "💡 Build completed successfully!"
print_status "   Image: ${IMAGE_TAG}"
print_status "   Broker: ${BROKER}"
print_status "   Architecture: ARM64 optimized"

echo ""
print_status "🔍 Next steps:"
echo "  1. Run the container using the commands above"
echo "  2. Wait ~30 seconds for MT5 to start (pre-installed image)"
echo "  3. Look for 'MT5 Container Ready!' in logs"
echo "  4. Test with Avyaktha: python avyaktha.py --user girish ..."
