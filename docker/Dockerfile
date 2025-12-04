# Optimized Dockerfile for MT5 on ARM64 using Hangover
# Pre-installs Wine, MT5, and Python packages for fast container startup

FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=UTC \
    WINEPREFIX="/opt/wineprefix" \
    WINEARCH="win64" \
    WINEDEBUG="-all" \
    DISPLAY=:99

ARG HANGOVER_VERSION="10.18"
# MT5_DOWNLOAD_URL is REQUIRED for pre-installation
ARG MT5_DOWNLOAD_URL

WORKDIR /mt5docker

# Stage 1: Install system dependencies and Hangover
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        wget curl ca-certificates \
        xvfb x11vnc \
        python3-websockify python3 \
        procps unzip cabextract \
        findutils sed coreutils && \
    # Install Hangover (Wine for ARM64) - using Debian 12 Bookworm package
    wget -q https://github.com/AndreRH/hangover/releases/download/hangover-${HANGOVER_VERSION}/hangover_${HANGOVER_VERSION}_debian12_bookworm_arm64.tar -O /tmp/hangover.tar && \
    mkdir -p /opt/hangover && \
    tar -xf /tmp/hangover.tar -C /opt/hangover && \
    apt-get install -y /opt/hangover/*.deb && \
    rm -rf /opt/hangover/*.deb /tmp/hangover.tar && \
    # Download noVNC (full package for proper CSS/JS)
    wget -q https://github.com/novnc/noVNC/archive/refs/heads/master.zip -O /tmp/novnc.zip && \
    unzip -q /tmp/novnc.zip -d /mt5docker && \
    rm -f /tmp/novnc.zip && \
    # Cleanup apt
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Set PATH for Hangover/Wine
ENV PATH="/opt/hangover/bin:${PATH}" \
    LD_LIBRARY_PATH="/opt/hangover/lib:${LD_LIBRARY_PATH}"

# Stage 2: Initialize Wine prefix and install Python
RUN rm -f /tmp/.X99-lock && \
    Xvfb :99 -ac -screen 0 1024x768x24 & \
    sleep 2 && \
    # Initialize Wine prefix
    wineboot --init && \
    sleep 10 && \
    # Download and setup Python for Wine
    mkdir -p /opt/wineprefix/drive_c/Python39x64 && \
    wget -q https://www.python.org/ftp/python/3.9.13/python-3.9.13-embed-amd64.zip -O /tmp/python.zip && \
    unzip -q /tmp/python.zip -d /opt/wineprefix/drive_c/Python39x64 && \
    wget -q https://bootstrap.pypa.io/get-pip.py -O /opt/wineprefix/drive_c/Python39x64/get-pip.py && \
    rm -f /tmp/python.zip && \
    # Configure Python path
    cd /opt/wineprefix/drive_c/Python39x64 && \
    echo "" >> python39._pth && \
    echo "Lib/site-packages" >> python39._pth && \
    sed -i 's/#import site/import site/' python39._pth && \
    # Install pip
    wine python.exe get-pip.py && \
    # Install required Python packages
    wine python.exe -m pip install --no-cache-dir rpyc==6.0.2 MetaTrader5 && \
    # Cleanup
    rm -rf /tmp/* /root/.cache && \
    wineserver -k || true

# Stage 3: Download and install MT5
RUN if [ -z "$MT5_DOWNLOAD_URL" ]; then \
        echo "ERROR: MT5_DOWNLOAD_URL build arg is required!" && exit 1; \
    fi && \
    curl -L -o /mt5docker/mt5setup.exe "$MT5_DOWNLOAD_URL" && \
    # Use different display for MT5 install
    rm -f /tmp/.X98-lock && \
    Xvfb :98 -ac -screen 0 1024x768x24 & \
    export DISPLAY=:98 && \
    sleep 2 && \
    # Install MT5 silently
    wine /mt5docker/mt5setup.exe /auto && \
    sleep 60 && \
    wineserver -k || true && \
    # Remove setup file to save space
    rm -f /mt5docker/mt5setup.exe && \
    # Cleanup Wine temp files
    rm -rf /opt/wineprefix/drive_c/users/root/Temp/* \
           /opt/wineprefix/drive_c/windows/temp/* \
           /tmp/*

# Copy config, scripts and pymt5linux
COPY mt5cfg.ini ./
COPY libs/pymt5linux /mt5docker/libs/pymt5linux
COPY start.sh ./
RUN chmod +x start.sh && \
    # Copy pymt5linux to tmp for runtime use
    cp -r /mt5docker/libs/pymt5linux /tmp/pymt5linux

# Reset display for runtime
ENV DISPLAY=:100

ENTRYPOINT ["./start.sh"]
