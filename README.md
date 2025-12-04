# MT5 Server

RPyC bridge server for MetaTrader 5 Terminal. Enables remote access to MT5 API from any platform (macOS, Linux, Windows).

**Supports ARM64 (Apple Silicon, AWS Graviton) via Hangover Wine.**

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  ATS App (Component 1)                                      │
│  └── MT5 Bridge Client (mt5linux) ──────┐                   │
└─────────────────────────────────────────│───────────────────┘
                                          │ TCP :8001
┌─────────────────────────────────────────│───────────────────┐
│  MT5 Server Container (Component 2)     ▼                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Hangover Wine (ARM64) / Wine (x86)                   │  │
│  │  ├── MT5 Terminal (Windows binary)                    │  │
│  │  └── Python 3.9 + MetaTrader5 library                 │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  pymt5linux RPyC Server                               │  │
│  │  └── Exposes MT5 API on port 8001                     │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  VNC + noVNC                                          │  │
│  │  └── Web access to MT5 GUI                            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Ports: 8001 (RPyC), 6081 (noVNC), 5901 (VNC)              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Using Pre-built Image

```bash
# Pull and run (ARM64 - Apple Silicon, AWS Graviton)
podman run -d \
  --name mt5-server \
  -e VNC_PWD=yourpassword \
  -e MT5_ACCOUNT=your_account \
  -e MT5_PASSWORD=your_password \
  -e MT5_SERVER=YourBroker-Server \
  -p 5901:5901 \
  -p 6081:6081 \
  -p 8001:8001 \
  docker.io/girishgkg/avyaktha-mt5:arm64

# Access
# - noVNC: http://localhost:6081
# - VNC:   localhost:5901
# - RPyC:  localhost:8001
```

### Build from Source

```bash
cd docker

# ARM64 build (requires MT5 download URL from broker)
./build.sh --mt5-url "https://your-broker.com/mt5setup.exe"

# Or use local build script
./build_local.sh
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VNC_PWD` | mt5vnc | VNC password |
| `MT5_HOST` | 0.0.0.0 | RPyC bind address |
| `MT5_ACCOUNT` | - | MT5 account number |
| `MT5_PASSWORD` | - | MT5 account password |
| `MT5_SERVER` | - | MT5 broker server name |

## Connecting from ATS

```python
from mt5linux import MetaTrader5

# Connect to MT5 Server container
mt5 = MetaTrader5(host='localhost', port=8001)
mt5.initialize()

# Get OHLC data
rates = mt5.copy_rates_from_pos("XAUUSD", mt5.TIMEFRAME_H1, 0, 100)

# Get current price
tick = mt5.symbol_info_tick("XAUUSD")
print(f"Bid: {tick.bid}, Ask: {tick.ask}")

# Place order
result = mt5.order_send({
    "action": mt5.TRADE_ACTION_DEAL,
    "symbol": "XAUUSD",
    "volume": 0.1,
    "type": mt5.ORDER_TYPE_BUY,
    "price": tick.ask,
    "sl": tick.ask - 10,
    "tp": tick.ask + 20,
})

mt5.shutdown()
```

## Ports

| Port | Service | Description |
|------|---------|-------------|
| 5901 | VNC | Direct VNC access to MT5 GUI |
| 6081 | noVNC | Web-based VNC (http://localhost:6081) |
| 8001 | RPyC | MT5 API for ATS connection |

## Directory Structure

```
mt5-server/
├── docker/
│   ├── Dockerfile          # ARM64 container (Hangover Wine)
│   ├── start.sh            # Container entrypoint
│   ├── mt5cfg.ini          # MT5 configuration
│   ├── build.sh            # Remote build script
│   ├── build_local.sh      # Local build script
│   └── libs/
│       └── pymt5linux/     # RPyC server for MT5
├── electron/               # Desktop app wrapper (future)
├── server/                 # Windows native server (future)
└── README.md
```

## Platform Support

| Platform | Architecture | Status |
|----------|--------------|--------|
| macOS | ARM64 (Apple Silicon) | ✅ Tested |
| Linux | ARM64 (AWS Graviton) | ✅ Tested |
| Linux | x86_64 | 🔄 Use mt5docker |
| Windows | x86_64 | 🔄 Native (no container needed) |

## Related Projects

- [avyaktha](https://github.com/Girish-SCM/avyaktha) - ATS Core Trading System
- [pymt5linux](https://github.com/hpdeandrade/pymt5linux) - MT5 Python library for Linux
- [Hangover](https://github.com/AndreRH/hangover) - Wine for ARM64

## License

MIT License - See [LICENSE](LICENSE)
