#!/bin/bash
# Prepare bundled resources for MT5 Server installer
# This script exports the container image and prepares Podman for bundling

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ELECTRON_DIR="$(dirname "$SCRIPT_DIR")"
BUNDLED_DIR="$ELECTRON_DIR/bundled"

echo "=========================================="
echo "  Preparing MT5 Server Bundle"
echo "=========================================="

# Create bundled directory
mkdir -p "$BUNDLED_DIR"

# Detect platform
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

echo "Platform: $PLATFORM ($ARCH)"

# Export container image
echo ""
echo "[1/2] Exporting container image..."
IMAGE_NAME="localhost/avyaktha-mt5:eightcap-arm64"
IMAGE_TAR="$BUNDLED_DIR/mt5-server.tar"

if podman images --format "{{.Repository}}:{{.Tag}}" | grep -q "avyaktha-mt5"; then
    echo "  Exporting $IMAGE_NAME to $IMAGE_TAR"
    podman save -o "$IMAGE_TAR" "$IMAGE_NAME"
    echo "  Image size: $(du -h "$IMAGE_TAR" | cut -f1)"
else
    echo "  ERROR: Container image not found!"
    echo "  Please build or pull the image first:"
    echo "    podman pull docker.io/girishgkg/avyaktha-mt5:arm64"
    exit 1
fi

# Note about Podman bundling
echo ""
echo "[2/2] Podman runtime..."
echo "  NOTE: For true one-click install, you need to bundle Podman."
echo "  Options:"
echo "    macOS: Download from https://github.com/containers/podman/releases"
echo "    Linux: Include static podman binary"
echo "    Windows: Include podman-remote.exe"
echo ""
echo "  For now, the installer will check for system Podman first."

# Create placeholder for Podman (user needs to add manually)
if [ ! -f "$BUNDLED_DIR/podman-darwin.tar.gz" ]; then
    echo "  Creating placeholder for bundled Podman..."
    echo "# Download Podman for your platform and place here" > "$BUNDLED_DIR/README-podman.txt"
    echo "# macOS ARM64: podman-darwin.tar.gz" >> "$BUNDLED_DIR/README-podman.txt"
    echo "# Linux: podman-linux.tar.gz" >> "$BUNDLED_DIR/README-podman.txt"
fi

echo ""
echo "=========================================="
echo "  Bundle prepared!"
echo "=========================================="
echo ""
echo "Contents of $BUNDLED_DIR:"
ls -lh "$BUNDLED_DIR"
echo ""
echo "Next steps:"
echo "  1. (Optional) Add bundled Podman for offline install"
echo "  2. Run: npm run build"
echo ""
