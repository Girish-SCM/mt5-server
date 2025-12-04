#!/bin/bash
# Simple MT5-ARM64 deployment test for 192.168.1.33

REMOTE="avyaktha@192.168.1.33"
REMOTE_HOST="192.168.1.33"
REMOTE_USER="avyaktha"
IMAGE_TAG="metaquotes-arm64"
MT5_URL="https://download.mql5.com/cdn/web/eightcap/mt5/mt5setup.exe"

# Get password from environment or prompt once
if [ -z "$SSHPASS" ]; then
    echo "Enter SSH password for $REMOTE:"
    read -s SSHPASS
    export SSHPASS
fi

# Check if sshpass is available
if ! command -v sshpass &> /dev/null; then
    echo "Installing sshpass..."
    brew install hudochenkov/sshpass/sshpass 2>/dev/null || {
        echo "Please install sshpass: brew install hudochenkov/sshpass/sshpass"
        exit 1
    }
fi

SSH="sshpass -e ssh"
SCP="sshpass -e scp"

echo "========================================="
echo "MT5-ARM64 Deployment Test"
echo "Target: 192.168.1.33"
echo "========================================="
echo ""

# Test SSH
echo "[1/6] Testing SSH..."
$SSH $REMOTE "echo 'Connected'" || exit 1

# Check architecture
echo "[2/6] Checking architecture..."
$SSH $REMOTE "uname -m"

# Check Docker/Podman
echo "[3/6] Checking container runtime..."
RUNTIME=$($SSH $REMOTE "command -v podman || command -v docker")
echo "Using: $RUNTIME"

# Copy files
echo "[4/6] Copying files..."
$SSH $REMOTE "mkdir -p ~/mt5-test"
$SCP Dockerfile start.sh mt5cfg.ini $REMOTE:~/mt5-test/

# Build image
echo "[5/6] Building image (this takes 10-15 minutes)..."
$SSH $REMOTE "cd ~/mt5-test && $RUNTIME build -f Dockerfile -t localhost/avyaktha-mt5:$IMAGE_TAG --build-arg MT5_DOWNLOAD_URL='$MT5_URL' ."

# Run container
echo "[6/6] Starting container..."
$SSH $REMOTE "$RUNTIME run -d --name mt5-test \
  -p 5901:5901 -p 6081:6081 -p 18812:18812 \
  -e VNC_PWD=avyaktha123 -e MT5_HOST=0.0.0.0 \
  -e MT5_ACCOUNT=5100563 -e MT5_PASSWORD=Asterisk@123 -e MT5_SERVER=EightcapGlobal-Live \
  localhost/avyaktha-mt5:$IMAGE_TAG"

echo ""
echo "========================================="
echo "Deployment complete!"
echo "========================================="
echo "VNC:   http://192.168.1.33:6081"
echo "RPC:   192.168.1.33:18812"
echo ""
echo "Check logs: SSHPASS=<password> $SSH $REMOTE '$RUNTIME logs -f mt5-test'"
