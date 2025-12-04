#!/bin/bash
# Optimized start script for pre-installed MT5 image
cd /mt5docker

echo "=========================================="
echo "  MT5 Docker Container (Pre-installed)   "
echo "=========================================="

# Remove display lock if any
rm -rf /tmp/.X100-lock

# Set up display
export DISPLAY=:100
Xvfb :100 -ac -screen 0 1024x768x24 &
sleep 2

# Set up VNC
x11vnc -storepasswd "${VNC_PWD:-mt5vnc}" /mt5docker/passwd 2>/dev/null
x11vnc -display :100 -forever -rfbport 5901 -rfbauth /mt5docker/passwd &
chmod 600 /mt5docker/passwd
/mt5docker/noVNC-master/utils/novnc_proxy --vnc localhost:5901 --listen 6081 &

echo "✓ Display and VNC initialized"

# Find MT5 installation (pre-installed in image)
MT5_DIR=$(find "$WINEPREFIX/drive_c/Program Files" -name "terminal64.exe" -exec dirname {} \; 2>/dev/null | head -1)

if [ -z "$MT5_DIR" ]; then
  echo "ERROR: MT5 not found! Image may not have been built correctly."
  exit 1
fi

echo "✓ MT5 found at: $MT5_DIR"

# Copy MT5 config if exists
if [ -f "/mt5docker/mt5cfg.ini" ]; then
  cp "/mt5docker/mt5cfg.ini" "$MT5_DIR/" 2>/dev/null || true
fi

# Start MT5 terminal
cd "$MT5_DIR"
wine terminal64.exe /config:mt5cfg.ini &
echo "✓ MT5 terminal starting..."

# Wait for MT5 to be ready
echo "Waiting for MT5 to initialize..."
MT5_READY=false
for i in {1..30}; do
  if pgrep -f "terminal64.exe" > /dev/null; then
    echo "✓ MT5 process detected, waiting for login..."
    sleep 20
    MT5_READY=true
    break
  fi
  echo "  Waiting... ($i/30)"
  sleep 5
done

if [ "$MT5_READY" = false ]; then
  echo "ERROR: MT5 failed to start within timeout"
  exit 1
fi

# Ensure pymt5linux is in /tmp (should be pre-copied in image)
if [ ! -d "/tmp/pymt5linux" ]; then
  if [ -d "/mt5docker/libs/pymt5linux" ]; then
    cp -r /mt5docker/libs/pymt5linux /tmp/
  else
    echo "ERROR: pymt5linux not found"
    exit 1
  fi
fi

# Start pymt5linux RPC server
cd /mt5docker
echo "Starting RPC server on port 8001..."
wine 'C:\Python39x64\python.exe' /tmp/pymt5linux/server.py --host "${MT5_HOST:-0.0.0.0}" --port 8001 &
sleep 10

# Test connection on first run
if [ ! -f "/tmp/firstrun.flag" ]; then
  echo "Testing MT5 connection..."
  if [ -f "/mt5docker/tests/test_connection.py" ]; then
    cd "/mt5docker/tests"
    python3 test_connection.py 2>/dev/null || echo "  (test skipped)"
  fi
  touch /tmp/firstrun.flag
fi

echo ""
echo "=========================================="
echo "  MT5 Container Ready!                   "
echo "=========================================="
echo "  VNC:    localhost:5901"
echo "  noVNC:  http://localhost:6081"
echo "  RPC:    localhost:8001"
echo "=========================================="

# Keep container running
while true; do
  sleep 60
done
