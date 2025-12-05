const { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog, ipcMain } = require('electron');

// Linux sandbox fix - MUST be before any other app calls
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Defer installer require until needed
let SilentInstaller = null;

// App state
let mainWindow = null;
let tray = null;
let containerProcess = null;
let isContainerRunning = false;
let installer = null;
let podmanBin = 'podman'; // Will be set by installer
let appReady = false; // Flag to track if app is fully initialized

// Detect architecture for container image
function getArchSuffix() {
  const arch = process.arch;
  if (arch === 'arm64') return 'arm64';
  return 'x86'; // x64, ia32, etc. all use x86 image
}

// Configuration
const CONFIG = {
  containerName: 'mt5-server',
  imageName: `localhost/avyaktha-mt5:eightcap-${getArchSuffix()}`,
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
      label: 'Quit MT5 Server',
      click: () => {
        // Force quit without dialog from tray
        app.isQuitting = true;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.destroy();
        }
        if (tray) {
          tray.destroy();
        }
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
    // Force quit - destroy window and exit
    app.isQuitting = true;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();
    }
    app.quit();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create tray icon
function createTray() {
  // Try multiple paths for icon (dev vs packaged)
  const possiblePaths = [
    path.join(__dirname, '..', 'assets', 'tray-icon.png'),
    path.join(app.getAppPath(), 'assets', 'tray-icon.png'),
    path.join(process.resourcesPath || '', 'app', 'assets', 'tray-icon.png')
  ];
  
  let icon = nativeImage.createEmpty();
  
  for (const iconPath of possiblePaths) {
    if (fs.existsSync(iconPath)) {
      icon = nativeImage.createFromPath(iconPath);
      icon = icon.resize({ width: 16, height: 16 });
      console.log('Tray icon loaded from:', iconPath);
      break;
    }
  }
  
  tray = new Tray(icon);
  tray.setToolTip('MT5 Server');
  
  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else if (app.isReady()) {
      createWindow();
    }
  });

  updateTrayMenu();
}

// Show installation progress window
function createInstallWindow() {
  const installWindow = new BrowserWindow({
    width: 500,
    height: 400,
    frame: true,
    resizable: false,
    center: true,
    title: 'MT5 Server - Setup',
    show: true, // Show immediately
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  installWindow.loadFile(path.join(__dirname, 'install.html'));
  installWindow.focus(); // Bring to front
  return installWindow;
}

// App ready
app.whenReady().then(async () => {
  // Show startup window immediately to avoid dock bouncing
  mainWindow = createInstallWindow();
  
  // Now load installer module (deferred to speed up window display)
  SilentInstaller = require('./installer');
  
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
    try {
      // Run silent installation (window already showing)
      await installer.install();
      
      // Installation complete - update podman path
      podmanBin = installer.getPodmanPath();
      
      // Close install window and show main app
      mainWindow.destroy();
      mainWindow = null;
      
    } catch (error) {
      dialog.showErrorBox('Installation Failed', 
        `Failed to install MT5 Server: ${error.message}\n\n` +
        'Please check your internet connection and try again.');
      app.quit();
      return;
    }
  } else {
    // Already installed - show startup progress
    podmanBin = installer.getPodmanPath();
    
    // Send startup status
    const sendStatus = (step, message, progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('install-progress', { step, message, progress });
      }
    };
    
    sendStatus('verify', 'Checking container status...', 20);
    await checkContainerStatus();
    
    if (!isContainerRunning) {
      sendStatus('machine', 'Starting MT5 container...', 40);
      await startContainer();
      sendStatus('image', 'Waiting for MT5 Terminal...', 70);
      // Wait for MT5 to initialize
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Re-check container status
    await checkContainerStatus();
    
    sendStatus('complete', 'Opening MT5 Terminal...', 100);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Close startup window
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();
      mainWindow = null;
    }
  }

  // Create tray
  createTray();
  
  // Create main window - isContainerRunning should be true now
  createWindow();  
  
  // App is now fully ready
  appReady = true;
});

// Quit when all windows are closed (only after app is ready)
app.on('window-all-closed', () => {
  if (appReady) {
    app.quit();
  }
});

// Cleanup on quit - stop container
app.on('before-quit', () => {
  app.isQuitting = true;
  
  // Stop container when quitting (fire and forget)
  if (isContainerRunning && podmanBin) {
    const { exec } = require('child_process');
    exec(`${podmanBin} stop ${CONFIG.containerName}`, (err) => {
      if (err) console.log('Container stop:', err.message);
    });
  }
});

app.on('activate', () => {
  if (app.isReady() && BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
