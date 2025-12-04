# MT5 ARM64 Container Build Guide

This guide provides step-by-step instructions for building and running the MT5 container on ARM64 architecture (Apple Silicon Macs) using Hangover Wine compatibility layer.

## 🎯 Overview

The MT5 ARM64 container provides:
- **MetaTrader 5 Terminal** running via Hangover (Wine for ARM64)
- **RPyC 6.0.2** for Python RPC communication
- **VNC Access** for GUI interaction
- **Optimized Performance** without QEMU emulation overhead

## 📋 Prerequisites

### System Requirements
- **ARM64 Architecture** (Apple Silicon Mac recommended)
- **Podman** or Docker installed
- **Network Access** for downloading dependencies
- **8GB+ RAM** recommended for smooth operation

### Dependencies
- Ubuntu 22.04 base image
- Hangover 10.18 (Wine for ARM64)
- Python 3.9 x64 (via Wine)
- MetaTrader 5 setup executable

## 🔧 Build Process

### Step 1: Clean Environment (Optional)
```bash
# Remove all existing containers and images for fresh build
podman stop --all
podman rm --all --force
podman rmi --all --force
podman system prune --all --force
```

### Step 2: Navigate to Build Directory
```bash
cd /path/to/avyaktha/deploy/avyaktha_deploy/mt5docker.arm64
```

### Step 3: Build the Container
```bash
# Build with Eightcap MT5 (recommended)
podman build \
  -f Dockerfile \
  -t localhost/avyaktha-mt5:eightcap-arm64 \
  --build-arg MT5_DOWNLOAD_URL="https://download.mql5.com/cdn/web/eightcap.global.limited/mt5/eightcapglobal5setup.exe" \
  .

# Alternative: Build with MetaQuotes MT5
podman build \
  -f Dockerfile \
  -t localhost/avyaktha-mt5:metaquotes-arm64 \
  --build-arg MT5_DOWNLOAD_URL="https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe" \
  .
```

### Step 4: Verify Build Success
```bash
# Check if image was created successfully
podman images | grep avyaktha-mt5

# Expected output:
# localhost/avyaktha-mt5  eightcap-arm64  <image-id>  <timestamp>  <size>
```

## 🚀 Running the Container

### Basic Run Command
```bash
podman run -d \
  --name mt5-arm64 \
  -p 5901:5901 \
  -p 6081:6081 \
  -p 8001:8001 \
  -e VNC_PWD=password \
  -e MT5_HOST=0.0.0.0 \
  localhost/avyaktha-mt5:eightcap-arm64
```

### Advanced Run with MT5 Credentials
```bash
podman run -d \
  --name mt5-arm64 \
  -p 5901:5901 \
  -p 6081:6081 \
  -p 8001:8001 \
  -e VNC_PWD=your_vnc_password \
  -e MT5_HOST=0.0.0.0 \
  -e MT5_ACCOUNT=your_account_number \
  -e MT5_PASSWORD=your_mt5_password \
  -e MT5_SERVER=YourBroker-Live \
  localhost/avyaktha-mt5:eightcap-arm64
```

## 📊 Container Access Methods

### 1. VNC Access (GUI)
- **VNC Client**: `localhost:5901` (password: as set in VNC_PWD)
- **Web VNC**: `http://localhost:6081` (browser-based)

### 2. RPC API Access
- **Port**: `8001`
- **Protocol**: RPyC 6.0.2
- **Usage**: Python MT5 API calls

### 3. Container Logs
```bash
# Monitor container startup
podman logs -f mt5-arm64

# Check for key success indicators:
# - "INFO SLAVE/8001[MainThread]: server started on [0.0.0.0]:8001"
# - "Successfully installed MetaTrader5-5.0.5430 ... rpyc-6.0.2"
# - "MT5 container is ready!"
```

## 🔍 Monitoring & Troubleshooting

### Container Status Check
```bash
# Check if container is running
podman ps

# Check container health
podman logs mt5-arm64 | tail -20

# Check RPC server status
podman logs mt5-arm64 | grep -E "(server started|RPC|rpyc)"
```

### Common Success Indicators
```bash
# Look for these messages in logs:
✅ "Successfully installed ... rpyc-6.0.2"
✅ "INFO SLAVE/8001[MainThread]: server started on [0.0.0.0]:8001"
✅ "MT5 process found, waiting additional 30s for login..."
✅ "MT5 container is ready!"
```

### RPyC Version Verification
```bash
# Test RPC connection
python3 -c "
import rpyc
try:
    conn = rpyc.connect('localhost', 8001, config={'sync_request_timeout': 10})
    print('✅ RPC connection successful!')
    conn.close()
except Exception as e:
    print(f'❌ Connection failed: {e}')
"
```

## 🏗️ Architecture Details

### Container Components
1. **Base Layer**: Ubuntu 22.04 ARM64
2. **Wine Layer**: Hangover 10.18 (ARM64-native Wine)
3. **Application Layer**: 
   - MT5 Terminal (Windows x64 via Wine)
   - Python 3.9 x64 (Windows via Wine)
   - RPyC 6.0.2 + MetaTrader5 Python package
   - VNC Server + noVNC web interface

### Key Optimizations
- **No Linux Python**: Removed unnecessary packages (python3, python3-pip, plumbum)
- **Wine Python Only**: All MT5 operations use Wine Python with RPyC 6.0.2
- **ARM64 Native**: Uses Hangover instead of QEMU for better performance
- **Minimal Dependencies**: Only essential packages for reduced image size

### Port Mapping
- **5901**: VNC Server (direct VNC client access)
- **6081**: noVNC Web Interface (browser access)
- **8001**: RPyC Server (Python API access)

## 🔧 Integration with Avyaktha

### Configuration Requirements
Ensure your `user_girish.toml` has:
```toml
[broker]
broker = "mt5"  # Must be set to "mt5"

[mt5]
mt5_host = "localhost"
mt5_port = 8001
# ... other MT5 settings
```

### Testing Integration
```bash
# Test with Avyaktha application
python avyaktha.py --user girish --bt-start-date 2024-07-15 --bt-end-date 2024-07-16 --store-ohlc --debug
```

### Expected Behavior
- ✅ MT5Ticker should initialize successfully
- ✅ No "connection closed by peer" errors
- ✅ RPyC version compatibility (6.0.2 ↔ 6.0.2)
- ✅ Historical data retrieval working

## 📝 Build Script Alternative

For convenience, you can also use the provided build script:
```bash
# Note: Update build.sh to use "Dockerfile" instead of "Dockerfile.arm64"
./build.sh eightcap-arm64 "https://download.mql5.com/cdn/web/eightcap.global.limited/mt5/eightcapglobal5setup.exe"
```

## 🚨 Important Notes

### Version Compatibility
- **Host RPyC**: Must be 6.0.2
- **Container RPyC**: Automatically installs 6.0.2
- **Mismatch Issues**: Will cause "connection closed by peer" errors

### MT5 Setup URL
- **Required**: Must provide MT5_DOWNLOAD_URL build argument
- **Broker Specific**: Use appropriate broker's MT5 setup URL
- **Validation**: Build will fail without valid MT5 setup file

### Performance Considerations
- **First Run**: 15-20 minutes initialization (Python + MT5 setup)
- **Subsequent Runs**: 2-3 minutes startup time
- **Resource Usage**: ~3GB RAM, ~4GB disk space

## 🎉 Success Verification

Your MT5 container is working correctly when you see:
1. ✅ Container running: `podman ps` shows mt5-arm64 as "Up"
2. ✅ RPC Server: Logs show "server started on [0.0.0.0]:8001"
3. ✅ RPyC Connection: Python can connect to localhost:8001
4. ✅ Avyaktha Integration: MT5Ticker initializes without errors

## 📞 Support

If you encounter issues:
1. Check container logs: `podman logs mt5-arm64`
2. Verify RPyC versions match (6.0.2)
3. Ensure MT5_DOWNLOAD_URL is accessible
4. Confirm ARM64 architecture compatibility

---

**Built with ❤️ for Avyaktha Trading System**
