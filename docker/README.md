# MT5 Docker for ARM64 (Apple Silicon)

This is an ARM64-compatible MT5 Docker image using **Hangover** - a Wine alternative that runs Windows applications natively on ARM64 Linux without QEMU emulation.

## Why Hangover?

- ✅ Native ARM64 support (no QEMU emulation)
- ✅ Better performance on Apple Silicon Macs
- ✅ No Wine memory management crashes
- ✅ Compatible with MT5 Windows applications

## Prerequisites

1. **Podman** (or Docker) installed on your Mac:
   ```bash
   brew install podman
   podman machine init
   podman machine start
   ```

2. **MT5 Setup URL** - Get the download link for your broker's MT5 terminal

## Building the Image

```bash
cd deploy/avyaktha_deploy/mt5docker

# Build with your broker's MT5 setup URL
./build-arm64.sh metaquotes-arm64 "https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe"

# Or for EightCap
./build-arm64.sh eightcap-arm64 "https://download.mql5.com/cdn/web/eightcap.global.limited/mt5/eightcapglobal5setup.exe"
```

## Running the Container

```bash
podman run -d \
  --name mt5-arm64 \
  -p 5901:5901 \
  -p 8001:8001 \
  -p 6081:6081 \
  -e VNC_PWD=avyaktha123 \
  -e MT5_HOST=0.0.0.0 \
  -e MT5_ACCOUNT=your_account_number \
  -e MT5_PASSWORD=your_password \
  -e MT5_SERVER=YourBroker-Live \
  localhost/avyaktha-mt5:metaquotes-arm64
```

## Accessing MT5

1. **VNC Access** (for GUI):
   - Open browser: http://localhost:6081
   - Password: `avyaktha123`

2. **RPC API** (for Avyaktha):
   - Host: `localhost`
   - Port: `8001`

## Configuration

Update your `config/users.toml`:

```toml
[users.girish]
broker = "mt5"
mt5_host = "localhost"
mt5_port = 8001
mt5_account = your_account_number
mt5_password = "your_password"
mt5_server = "YourBroker-Live"
```

## Useful Commands

```bash
# View logs
podman logs -f mt5-arm64

# Stop container
podman stop mt5-arm64

# Start container
podman start mt5-arm64

# Remove container
podman rm -f mt5-arm64

# Access container shell
podman exec -it mt5-arm64 /bin/bash
```

## Troubleshooting

### Hangover Issues

If Hangover fails to initialize:
```bash
podman exec -it mt5-arm64 /bin/bash
wineboot --init
```

### MT5 Installation Issues

Check if MT5 installed correctly:
```bash
podman exec mt5-arm64 ls -la /opt/wineprefix/drive_c/Program\ Files/MetaTrader\ 5/
```

### pymt5linux Connection Issues

Verify pymt5linux is running:
```bash
podman exec mt5-arm64 ps aux | grep pymt5linux
```

## Pushing to Docker Hub

```bash
# Tag the image
podman tag localhost/avyaktha-mt5:metaquotes-arm64 docker.io/girishgkg/avyaktha-mt5:metaquotes-arm64

# Login to Docker Hub
podman login docker.io

# Push the image
podman push docker.io/girishgkg/avyaktha-mt5:metaquotes-arm64
```

## Known Limitations

- Hangover is still in development (v0.8.5)
- Some Windows applications may not work perfectly
- Performance may vary compared to native x86_64

## References

- Hangover Project: https://github.com/AndreRH/hangover
- MT5 Documentation: https://www.metatrader5.com/
- pymt5linux: https://github.com/lucas-campagna/pymt5linux
