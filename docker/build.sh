#!/bin/bash
# Build script for ARM64 MT5 Docker image using Hangover
# This script builds the MT5 container for Apple Silicon (ARM64)
# Usage: ./build-arm64.sh <tag> <mt5-url>
# Example: ./build-arm64.sh metaquotes-arm64 "https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe"

set -e

TAG="${1}"
MT5_URL="${2}"

# Validate arguments
if [ -z "$TAG" ] || [ -z "$MT5_URL" ]; then
    echo "❌ Error: Missing required arguments"
    echo ""
    echo "Usage: ./build-arm64.sh <tag> <mt5-url>"
    echo ""
    echo "Examples:"
    echo "  ./build-arm64.sh metaquotes-arm64 'https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe'"
    echo "  ./build-arm64.sh eightcap-arm64 'https://download.mql5.com/cdn/web/eightcap.global.limited/mt5/eightcapglobal5setup.exe'"
    echo ""
    exit 1
fi

echo "🔨 Building MT5 Docker image for ARM64 (Apple Silicon)..."
echo "   Using Hangover (Wine for ARM64)"
echo "   Tag: localhost/avyaktha-mt5:${TAG}"
echo "   MT5 URL: ${MT5_URL}"
echo ""

# Check if running on ARM64
ARCH=$(uname -m)
if [ "$ARCH" != "arm64" ] && [ "$ARCH" != "aarch64" ]; then
    echo "⚠️  Warning: You are building on $ARCH architecture"
    echo "   This image is optimized for ARM64 (Apple Silicon)"
    echo ""
fi

# Build the image with MT5 URL using ARM64 Dockerfile
podman build \
    -f Dockerfile.arm64 \
    -t localhost/avyaktha-mt5:${TAG} \
    --build-arg MT5_DOWNLOAD_URL="${MT5_URL}" \
    --platform linux/arm64 \
    .

echo ""
echo "✅ Build complete!"
echo ""
echo "📦 Image details:"
podman images localhost/avyaktha-mt5:${TAG}

echo ""
echo "🧪 To test the image:"
echo "  podman run -d --name mt5-test-arm64 \\"
echo "    -p 5901:5901 \\"
echo "    -p 8001:8001 \\"
echo "    -p 6081:6081 \\"
echo "    -e VNC_PWD=avyaktha123 \\"
echo "    -e MT5_HOST=0.0.0.0 \\"
echo "    -e MT5_ACCOUNT=your_account \\"
echo "    -e MT5_PASSWORD=your_password \\"
echo "    -e MT5_SERVER=YourBroker-Live \\"
echo "    localhost/avyaktha-mt5:${TAG}"
echo ""
echo "  # Check logs"
echo "  podman logs -f mt5-test-arm64"
echo ""
echo "  # Access VNC"
echo "  open http://localhost:6081"
echo ""
echo "  # Clean up"
echo "  podman stop mt5-test-arm64 && podman rm mt5-test-arm64"
echo ""
echo "🚀 To push to docker.io:"
echo "  podman tag localhost/avyaktha-mt5:${TAG} docker.io/girishgkg/avyaktha-mt5:${TAG}"
echo "  podman push docker.io/girishgkg/avyaktha-mt5:${TAG}"
echo ""
echo "💡 Note: This image uses Hangover for ARM64 compatibility"
echo "   It should work on Apple Silicon Macs without QEMU emulation issues"
