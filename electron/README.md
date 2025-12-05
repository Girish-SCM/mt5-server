# MT5 Server - Electron Desktop App

One-click desktop application for MT5 Server. **No user intervention required** - the installer handles everything:

1. ✅ Extracts bundled Podman (if not installed)
2. ✅ Initializes Podman machine (macOS/Windows)
3. ✅ Loads pre-bundled container image
4. ✅ Starts MT5 Server automatically
5. ✅ Shows MT5 Terminal in embedded window

## Features

- **True One-Click Install**: Everything bundled, no dependencies
- **Silent Installation**: Progress UI, no user prompts
- **System Tray**: Runs in background with status indicator
- **Container Management**: Start/Stop/Restart MT5 container
- **Embedded noVNC**: View MT5 Terminal directly in app
- **Cross-Platform**: macOS (ARM64/x64), Linux, Windows

## User Experience

```
User downloads: MT5-Server-1.0.0-arm64.dmg (~5.5GB)
                        ↓
        Double-click to install
                        ↓
    [Starting MT5 Server...] progress window
                        ↓
      MT5 Terminal ready to use!
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm start

# Build for current platform
npm run build

# Build for specific platform
npm run build:mac
npm run build:linux
npm run build:win
```

## Requirements

- Node.js 18+
- Podman or Docker installed
- MT5 container image available locally

## Building Installers

### Step 1: Prepare Bundle

```bash
# Export container image and prepare bundled resources
./scripts/prepare-bundle.sh
```

This creates `bundled/` directory with:
- `mt5-server.tar` - Pre-exported container image (~5.3GB)

### Step 2: Build Installer

```bash
# macOS (ARM64 + x64)
npm run build:mac
# Output: dist/MT5 Server-1.0.0-arm64.dmg (~5.5GB)

# Linux (coming soon)
npm run build:linux

# Windows (coming soon)
npm run build:win
```

## Configuration

Edit `src/main.js` to customize:

```javascript
const CONFIG = {
  containerName: 'mt5-server',
  imageName: 'localhost/avyaktha-mt5:eightcap-arm64',
  ports: {
    vnc: 5901,
    novnc: 6081,
    rpyc: 8001
  },
  vncPassword: 'mt5vnc'
};
```

## App Structure

```
electron/
├── src/
│   ├── main.js      # Electron main process
│   └── index.html   # Fallback UI when container stopped
├── assets/
│   ├── icon.icns    # macOS icon
│   ├── icon.ico     # Windows icon
│   └── icon.png     # Linux icon
├── package.json
└── README.md
```

## System Tray Menu

- **MT5 Server [Status]** - Shows running/stopped status
- **Open MT5 (noVNC)** - Opens browser to noVNC interface
- **Open Dashboard** - Shows app window
- **Start/Stop Server** - Toggle container
- **Restart Server** - Restart container
- **View Logs** - Show container logs
- **Quit** - Exit app and stop container

## Notes

- First launch takes time due to large bundle size (~5.5GB)
- Container is stopped automatically when app quits
- Podman must be installed on the system
- Tested on macOS ARM64 (Apple Silicon)
