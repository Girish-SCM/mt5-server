/**
 * MT5 Server - Silent Installer Module
 * 
 * Handles:
 * 1. Bundled Podman extraction and setup
 * 2. Container image loading from bundled tar
 * 3. First-run initialization
 * 4. All without user intervention
 */

const { app } = require('electron');
const { exec, execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class SilentInstaller {
  constructor(onProgress) {
    this.onProgress = onProgress || (() => {});
    this.appPath = app.getAppPath();
    this.userDataPath = app.getPath('userData');
    this.platform = process.platform; // 'darwin', 'linux', 'win32'
    
    // Paths for bundled resources
    this.bundledPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'bundled')
      : path.join(this.appPath, 'bundled');
    
    // Local podman path (extracted)
    this.localPodmanPath = path.join(this.userDataPath, 'podman');
    this.podmanBin = this.getPodmanBinPath();
    
    // Container image
    this.imageTarPath = path.join(this.bundledPath, 'mt5-server.tar');
    this.imageName = 'localhost/avyaktha-mt5:eightcap-arm64';
    
    // Installation state
    this.stateFile = path.join(this.userDataPath, 'install-state.json');
  }

  getPodmanBinPath() {
    switch (this.platform) {
      case 'darwin':
        return path.join(this.localPodmanPath, 'bin', 'podman');
      case 'linux':
        return path.join(this.localPodmanPath, 'bin', 'podman');
      case 'win32':
        return path.join(this.localPodmanPath, 'podman.exe');
      default:
        return 'podman';
    }
  }

  // Check if already installed
  isInstalled() {
    try {
      const state = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      return state.installed === true && state.imageLoaded === true;
    } catch {
      return false;
    }
  }

  // Save installation state
  saveState(state) {
    const currentState = this.getState();
    const newState = { ...currentState, ...state, updatedAt: new Date().toISOString() };
    fs.writeFileSync(this.stateFile, JSON.stringify(newState, null, 2));
  }

  getState() {
    try {
      return JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
    } catch {
      return {};
    }
  }

  // Main installation flow
  async install() {
    if (this.isInstalled()) {
      this.onProgress({ step: 'complete', message: 'Already installed', progress: 100 });
      return true;
    }

    try {
      // Step 1: Check/Setup Podman
      this.onProgress({ step: 'podman', message: 'Setting up container runtime...', progress: 10 });
      await this.setupPodman();

      // Step 2: Initialize Podman machine (macOS/Windows)
      if (this.platform === 'darwin' || this.platform === 'win32') {
        this.onProgress({ step: 'machine', message: 'Initializing Podman machine...', progress: 30 });
        await this.initPodmanMachine();
      }

      // Step 3: Load container image
      this.onProgress({ step: 'image', message: 'Loading MT5 container image...', progress: 50 });
      await this.loadContainerImage();

      // Step 4: Verify installation
      this.onProgress({ step: 'verify', message: 'Verifying installation...', progress: 90 });
      await this.verifyInstallation();

      // Done
      this.saveState({ installed: true, imageLoaded: true, installedAt: new Date().toISOString() });
      this.onProgress({ step: 'complete', message: 'Installation complete!', progress: 100 });
      
      return true;
    } catch (error) {
      this.onProgress({ step: 'error', message: `Installation failed: ${error.message}`, progress: 0 });
      throw error;
    }
  }

  // Setup Podman - check system or extract bundled
  async setupPodman() {
    // First check if system podman exists
    if (await this.checkSystemPodman()) {
      this.podmanBin = 'podman';
      this.saveState({ podmanSource: 'system' });
      return;
    }

    // Check if we already extracted bundled podman
    if (fs.existsSync(this.podmanBin)) {
      this.saveState({ podmanSource: 'bundled' });
      return;
    }

    // Extract bundled podman
    await this.extractBundledPodman();
    this.saveState({ podmanSource: 'bundled' });
  }

  // Check if system has podman installed
  checkSystemPodman() {
    return new Promise((resolve) => {
      exec('podman --version', (error) => {
        resolve(!error);
      });
    });
  }

  // Extract bundled Podman
  async extractBundledPodman() {
    const bundledPodmanTar = path.join(this.bundledPath, `podman-${this.platform}.tar.gz`);
    
    if (!fs.existsSync(bundledPodmanTar)) {
      throw new Error(`Bundled Podman not found for ${this.platform}`);
    }

    // Create extraction directory
    fs.mkdirSync(this.localPodmanPath, { recursive: true });

    // Extract
    return new Promise((resolve, reject) => {
      const tar = spawn('tar', ['-xzf', bundledPodmanTar, '-C', this.localPodmanPath]);
      tar.on('close', (code) => {
        if (code === 0) {
          // Make executable
          if (this.platform !== 'win32') {
            fs.chmodSync(this.podmanBin, '755');
          }
          resolve();
        } else {
          reject(new Error(`Failed to extract Podman: exit code ${code}`));
        }
      });
    });
  }

  // Initialize Podman machine (required on macOS/Windows)
  async initPodmanMachine() {
    // Check if machine already exists
    const machineExists = await this.runCommand(`${this.podmanBin} machine list --format "{{.Name}}"`)
      .then(output => output.includes('podman-machine-default'))
      .catch(() => false);

    if (!machineExists) {
      // Initialize machine with reasonable defaults
      await this.runCommand(
        `${this.podmanBin} machine init --cpus 2 --memory 4096 --disk-size 20`,
        { timeout: 300000 } // 5 min timeout for download
      );
    }

    // Start machine if not running
    const machineRunning = await this.runCommand(`${this.podmanBin} machine list --format "{{.Running}}"`)
      .then(output => output.includes('true'))
      .catch(() => false);

    if (!machineRunning) {
      await this.runCommand(`${this.podmanBin} machine start`, { timeout: 120000 });
    }
  }

  // Load container image from bundled tar
  async loadContainerImage() {
    // Check if image already loaded
    const imageExists = await this.runCommand(`${this.podmanBin} images --format "{{.Repository}}:{{.Tag}}"`)
      .then(output => output.includes(this.imageName))
      .catch(() => false);

    if (imageExists) {
      return;
    }

    // Check if bundled image exists
    if (!fs.existsSync(this.imageTarPath)) {
      throw new Error('Bundled container image not found. Please download the full installer.');
    }

    // Load image
    this.onProgress({ step: 'image', message: 'Loading container image (this may take a few minutes)...', progress: 60 });
    await this.runCommand(`${this.podmanBin} load -i "${this.imageTarPath}"`, { timeout: 600000 }); // 10 min
  }

  // Verify everything is working
  async verifyInstallation() {
    // Check podman works
    await this.runCommand(`${this.podmanBin} --version`);
    
    // Check image exists
    const images = await this.runCommand(`${this.podmanBin} images --format "{{.Repository}}:{{.Tag}}"`);
    if (!images.includes('avyaktha-mt5')) {
      throw new Error('Container image not found after loading');
    }
  }

  // Helper to run commands
  runCommand(command, options = {}) {
    const timeout = options.timeout || 60000;
    
    return new Promise((resolve, reject) => {
      exec(command, { timeout }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  // Get the podman binary path to use
  getPodmanPath() {
    return this.podmanBin;
  }
}

module.exports = SilentInstaller;
