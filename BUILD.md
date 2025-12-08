# MT5 Server - Build & Run Guide

MT5 Server is an Electron-based desktop application that runs MetaTrader 5 in a containerized environment using Podman/Docker.

## Supported Platforms

| Platform | Architecture | Build Command | Output |
|----------|--------------|---------------|--------|
| macOS | ARM64 (M1/M2/M3) | `./build-all.sh mac-arm64` | `.app`, `.dmg`, `.zip` |
| macOS | x86_64 (Intel) | `./build-all.sh mac-x64` | `.app`, `.dmg`, `.zip` |
| Linux | x86_64 | `./build-all.sh linux` | `.AppImage`, `.deb` |
| Windows | x86_64 | `./build-all.sh windows` | `.exe` |

---

## Prerequisites

### All Platforms
- **Node.js** 18+ (`node --version`)
- **Podman** or **Docker** (`podman --version` or `docker --version`)

### macOS
```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node

# Install Podman
brew install podman
podman machine init
podman machine start
```

### Linux (Ubuntu/Debian)
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# Install Podman
sudo apt-get install -y podman

# Or Docker
sudo apt-get install -y docker.io
sudo usermod -aG docker $USER
```

### Windows
```powershell
# Install Node.js
winget install OpenJS.NodeJS.LTS

# Install Podman Desktop (recommended)
winget install RedHat.Podman-Desktop

# Or Docker Desktop
winget install Docker.DockerDesktop
```

---

## Building

### macOS ARM64 (M1/M2/M3)
```bash
./build-all.sh mac-arm64
```

### macOS Intel
```bash
./build-all.sh mac-x64
```

### Linux
```bash
./build-all.sh linux
```

### Windows
```bash
./build-all.sh windows
```

### All Platforms
```bash
./build-all.sh all
```

### With Custom Broker
```bash
# Available brokers: eightcap (default), metaquotes, exness, xm
./build-all.sh mac-arm64 exness
./build-all.sh linux metaquotes
```

---

## Build Output

### macOS
```
electron/dist/
├── mac-arm64/                    # ARM64 build
│   ├── MT5 Server.app            # Application bundle
│   └── MT5 Server-signed.zip     # Signed ZIP for distribution
├── mac/                          # Intel build
│   ├── MT5 Server.app
│   └── MT5 Server-signed.zip
├── MT5 Server-1.0.0-arm64.dmg    # ARM64 DMG installer
└── MT5 Server-1.0.0.dmg          # Intel DMG installer
```

### Linux
```
electron/dist/
├── MT5 Server-1.0.0.AppImage     # Portable AppImage
└── mt5-server_1.0.0_amd64.deb    # Debian package
```

### Windows
```
electron/dist/
└── MT5 Server Setup 1.0.0.exe    # Windows installer
```

---

## Running

### macOS

**From DMG:**
1. Double-click `MT5 Server-1.0.0-arm64.dmg`
2. Drag "MT5 Server" to Applications
3. Open from Applications

**From signed ZIP (distributed):**
```bash
unzip "MT5 Server-signed.zip"
xattr -cr "MT5 Server.app"
open "MT5 Server.app"
```

**If blocked by Gatekeeper:**
```bash
# Option 1: Remove quarantine
xattr -cr "/Applications/MT5 Server.app"

# Option 2: Allow in System Preferences
# Go to: System Preferences → Privacy & Security → "Open Anyway"

# Option 3: Temporarily disable Gatekeeper
sudo spctl --master-disable
# (open app, then re-enable)
sudo spctl --master-enable
```

**First Run - Podman Setup:**
The app will prompt to install Podman if not found. Alternatively:
```bash
brew install podman
podman machine init
podman machine start
```

### Linux

**From AppImage:**
```bash
chmod +x "MT5 Server-1.0.0.AppImage"
./MT5\ Server-1.0.0.AppImage
```

**From DEB package:**
```bash
sudo dpkg -i mt5-server_1.0.0_amd64.deb
mt5-server
```

**First Run - Podman/Docker Setup:**
```bash
# Ensure Podman or Docker is running
sudo systemctl start podman
# or
sudo systemctl start docker
```

### Windows

**From EXE installer:**
1. Run `MT5 Server Setup 1.0.0.exe`
2. Follow installation wizard
3. Launch from Start Menu

**First Run - Podman Setup:**
1. Install Podman Desktop from https://podman-desktop.io/
2. Start Podman Desktop
3. Initialize and start the Podman machine
4. Then launch MT5 Server

---

## Configuration

### MT5 Connection Settings
The app connects to MT5 running inside a container. Configure in the app:
- **Host**: `localhost` (default)
- **Port**: `8001` (default rpyc port)

### Broker Selection
Built-in support for:
- **Eightcap** (default)
- **MetaQuotes**
- **Exness**
- **XM**

Select broker during build or in app settings.

---

## Distribution Checklist

### macOS
- [ ] Build with `./build-all.sh mac-arm64` or `mac-x64`
- [ ] App is automatically code-signed (ad-hoc)
- [ ] Share `MT5 Server-signed.zip` (not DMG for unsigned apps)
- [ ] Instruct users to:
  1. Install Podman: `brew install podman && podman machine init && podman machine start`
  2. Extract and run: `xattr -cr "MT5 Server.app" && open "MT5 Server.app"`

### Linux
- [ ] Build with `./build-all.sh linux`
- [ ] Share `.AppImage` (portable) or `.deb` (Debian/Ubuntu)
- [ ] Instruct users to install Podman: `sudo apt install podman`
- [ ] AppImage needs `chmod +x` before running

### Windows
- [ ] Build with `./build-all.sh windows`
- [ ] Share `.exe` installer
- [ ] Instruct users to install Podman Desktop first
- [ ] Users may need to allow in Windows Defender SmartScreen

---

## Troubleshooting

### "MT5 Server is damaged and can't be opened" (macOS)
```bash
xattr -cr "/path/to/MT5 Server.app"
```

### "Bundled Podman not found for darwin"
Install Podman manually:
```bash
brew install podman
podman machine init
podman machine start
```

### Container fails to start
```bash
# Check Podman status
podman machine list
podman machine start

# Check container logs
podman logs mt5-server
```

### MT5 connection refused
1. Ensure the container is running: `podman ps`
2. Check port 8001 is exposed: `podman port mt5-server`
3. Verify rpyc server is running inside container

### Build fails - Docker/Podman not found
```bash
# macOS
brew install podman
podman machine init
podman machine start

# Linux
sudo apt install podman
# or
sudo apt install docker.io
```

### Electron build fails
```bash
cd electron
rm -rf node_modules
npm ci
npm run build:mac  # or build:linux, build:win
```
