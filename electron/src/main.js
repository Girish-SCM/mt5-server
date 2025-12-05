const { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog, ipcMain } = require('electron');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const SilentInstaller = require('./installer');

// App state
let mainWindow = null;
let tray = null;
let containerProcess = null;
let isContainerRunning = false;
let installer = null;
let podmanBin = 'podman'; // Will be set by installer

// Configuration
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

// Get container runtime (uses installer's podman path)
function getContainerRuntime() {
  return Promise.resolve(podmanBin);
}

// Check if container is running
async function checkContainerStatus() {
  const runtime = await getContainerRuntime();
  if (!runtime) return false;

  return new Promise((resolve) => {
    exec(`${runtime} ps --filter name=${CONFIG.containerName} --format "{{.Names}}"`, (error, stdout) => {
      isContainerRunning = stdout.trim() === CONFIG.containerName;
      resolve(isContainerRunning);
    });
  });
}

// Start container
async function startContainer() {
  const runtime = await getContainerRuntime();
  if (!runtime) {
    dialog.showErrorBox('Container Runtime Not Found', 
      'Please install Podman or Docker to run MT5 Server.\n\n' +
      'macOS: brew install podman\n' +
      'Linux: sudo apt install podman');
    return false;
  }

  // Check if already running
  if (await checkContainerStatus()) {
    console.log('Container already running');
    return true;
  }

  // Remove existing stopped container
  exec(`${runtime} rm -f ${CONFIG.containerName}`, () => {
    // Start new container
    const args = [
      'run', '-d',
      '--name', CONFIG.containerName,
      '-e', `VNC_PWD=${CONFIG.vncPassword}`,
      '-e', 'MT5_HOST=0.0.0.0',
      '-p', `${CONFIG.ports.vnc}:5901`,
      '-p', `${CONFIG.ports.novnc}:6081`,
      '-p', `${CONFIG.ports.rpyc}:8001`,
      CONFIG.imageName
    ];

    containerProcess = spawn(runtime, args);
    
    containerProcess.on('close', (code) => {
      console.log(`Container start exited with code ${code}`);
      checkContainerStatus().then(updateTrayMenu);
    });

    containerProcess.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });

    containerProcess.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });
  });

  // Wait for container to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  await checkContainerStatus();
  updateTrayMenu();
  return isContainerRunning;
}

// Stop container
async function stopContainer() {
  const runtime = await getContainerRuntime();
  if (!runtime) return;

  return new Promise((resolve) => {
    exec(`${runtime} stop ${CONFIG.containerName}`, (error) => {
      isContainerRunning = false;
      updateTrayMenu();
      resolve(!error);
    });
  });
}

// Update tray menu based on container status
function updateTrayMenu() {
  if (!tray) return;

  const statusText = isContainerRunning ? '● Running' : '○ Stopped';
  const statusColor = isContainerRunning ? '#00ff00' : '#ff0000';

  const contextMenu = Menu.buildFromTemplate([
    { 
      label: `MT5 Server ${statusText}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Open MT5 (noVNC)',
      click: () => {
        if (isContainerRunning) {
          shell.openExternal(`http://localhost:${CONFIG.ports.novnc}`);
        } else {
          dialog.showMessageBox({
            type: 'info',
            message: 'Container not running',
            detail: 'Please start the container first.'
          });
        }
      }
    },
    {
      label: 'Open Dashboard',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      }
    },
    { type: 'separator' },
    {
      label: isContainerRunning ? 'Stop Server' : 'Start Server',
      click: async () => {
        if (isContainerRunning) {
          await stopContainer();
        } else {
          await startContainer();
        }
      }
    },
    {
      label: 'Restart Server',
      enabled: isContainerRunning,
      click: async () => {
        await stopContainer();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await startContainer();
      }
    },
    { type: 'separator' },
    {
      label: 'View Logs',
      click: async () => {
        const runtime = await getContainerRuntime();
        if (runtime) {
          exec(`${runtime} logs --tail 100 ${CONFIG.containerName}`, (error, stdout, stderr) => {
            const logs = stdout || stderr || 'No logs available';
            dialog.showMessageBox({
              type: 'info',
              title: 'Container Logs',
              message: 'MT5 Server Logs',
              detail: logs.slice(-2000) // Last 2000 chars
            });
          });
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip(`MT5 Server - ${statusText}`);
}

// Create main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'MT5 Server',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  });

  // Load noVNC interface
  if (isContainerRunning) {
    mainWindow.loadURL(`http://localhost:${CONFIG.ports.novnc}/vnc.html?autoconnect=true&password=${CONFIG.vncPassword}`);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    // Hide instead of close
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create tray icon
function createTray() {
  // Create a simple tray icon (you can replace with actual icon)
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  
  let icon;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    // Create a simple colored icon if no file exists
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('MT5 Server');
  
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    } else {
      createWindow();
    }
  });

  updateTrayMenu();
}

// Show installation progress window
function createInstallWindow() {
  const installWindow = new BrowserWindow({
    width: 500,
    height: 350,
    frame: false,
    resizable: false,
    center: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  installWindow.loadFile(path.join(__dirname, 'install.html'));
  return installWindow;
}

// App ready
app.whenReady().then(async () => {
  // Initialize installer
  installer = new SilentInstaller((progress) => {
    console.log(`[Install] ${progress.step}: ${progress.message} (${progress.progress}%)`);
    // Send progress to install window if exists
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('install-progress', progress);
    }
  });

  // Check if first run / needs installation
  if (!installer.isInstalled()) {
    // Show installation window
    mainWindow = createInstallWindow();
    
    try {
      // Run silent installation
      await installer.install();
      
      // Installation complete - update podman path
      podmanBin = installer.getPodmanPath();
      
      // Close install window and show main app
      mainWindow.close();
      mainWindow = null;
      
    } catch (error) {
      dialog.showErrorBox('Installation Failed', 
        `Failed to install MT5 Server: ${error.message}\n\n` +
        'Please check your internet connection and try again.');
      app.quit();
      return;
    }
  } else {
    // Already installed - get podman path
    podmanBin = installer.getPodmanPath();
  }

  // Check container status
  await checkContainerStatus();
  
  // Create tray
  createTray();
  
  // Create main window
  createWindow();

  // Auto-start container if not running
  if (!isContainerRunning) {
    await startContainer();
    // Reload window with noVNC after container starts
    if (mainWindow && isContainerRunning) {
      setTimeout(() => {
        mainWindow.loadURL(`http://localhost:${CONFIG.ports.novnc}/vnc.html?autoconnect=true&password=${CONFIG.vncPassword}`);
      }, 8000); // Wait for MT5 to initialize
    }
  }
});

// Prevent app from closing when all windows are closed
app.on('window-all-closed', (event) => {
  // Keep running in tray
});

// Cleanup on quit
app.on('before-quit', async () => {
  // Optionally stop container on quit
  // await stopContainer();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
