#!/usr/bin/env python3
"""
pymt5linux-compatible RPC Server for ARM64
Based on: https://github.com/hpdeandrade/pymt5linux
Uses rpyc SlaveService for full compatibility
"""

import sys
import rpyc
from rpyc.utils.server import ThreadedServer
from rpyc.core import SlaveService
from rpyc.lib import setup_logger

if __name__ == "__main__":
    # Parse command line arguments
    import argparse
    parser = argparse.ArgumentParser(description='MT5 RPC Server for ARM64')
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to')
    parser.add_argument('--port', type=int, default=8001, help='Port to bind to')
    parser.add_argument('python_path', nargs='?', help='Python path (ignored, for compatibility)')
    args = parser.parse_args()
    
    print(f"Starting MT5 RPC Server (pymt5linux-compatible) on {args.host}:{args.port}")
    print("Note: Running on ARM64 with Hangover Wine")
    
    # Setup logging
    setup_logger(quiet=False, logfile=None)
    
    # Create and start the server with SlaveService (same as pymt5linux)
    server = ThreadedServer(
        SlaveService,
        hostname=args.host,
        port=args.port,
        reuse_addr=True,
        protocol_config={
            'allow_public_attrs': True,
            'allow_pickle': True,
            'sync_request_timeout': 30,
        }
    )
    
    try:
        server.start()
    except KeyboardInterrupt:
        print("\nServer stopped")
