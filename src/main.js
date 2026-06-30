const { app, BrowserWindow, Tray, Menu, shell, nativeImage, Notification, ipcMain, screen } = require('electron');
const path = require('path');
const http = require('http');
const express = require('express');

const PLATFORM_URL = 'http://10.18.68.179/platform/#reporter';
const IPC_PORT = 3333;

let tray = null;
let platformWindow = null;
let widgetWindow = null;

// ── Auto-start on Windows login ──────────────────────────────────────────────
function setAutoStart() {
  app.setLoginItemSettings({
    openAtLogin: true,
    name: 'Bloom Assistant',
    args: ['--hidden']
  });
}

// ── Create the main platform browser window ──────────────────────────────────
function createPlatformWindow() {
  if (platformWindow && !platformWindow.isDestroyed()) {
    platformWindow.show();
    platformWindow.focus();
    return;
  }

  platformWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Bloom Assistant — Bloomberg Platform',
    icon: path.join(__dirname, '..', 'assets', 'bloom.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false        // allow loading the internal network URL
    },
    backgroundColor: '#070a12',
    show: false
  });

  platformWindow.loadURL(PLATFORM_URL);

  platformWindow.once('ready-to-show', () => {
    platformWindow.show();
  });

  platformWindow.on('close', (e) => {
    e.preventDefault();
    platformWindow.hide();
  });
}

// ── Floating Bloom widget ─────────────────────────────────────────────────────
function createWidget() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  widgetWindow = new BrowserWindow({
    width: 72,
    height: 72,
    x: width - 100,
    y: height - 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  widgetWindow.loadFile(path.join(__dirname, 'widget.html'));
  widgetWindow.setIgnoreMouseEvents(false);
}

// ── Tray icon ─────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'bloom.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('Bloom Assistant');

  const menu = Menu.buildFromTemplate([
    { label: 'Open Bloomberg Platform', click: () => createPlatformWindow() },
    { label: 'Open Reporter', click: () => {
        createPlatformWindow();
        setTimeout(() => platformWindow.loadURL(PLATFORM_URL), 200);
      }
    },
    { type: 'separator' },
    { label: 'Quit Bloom', click: () => { app.exit(0); } }
  ]);

  tray.setContextMenu(menu);
  tray.on('click', () => createPlatformWindow());
}

// ── Local IPC server — listens for defect events from Game Client ─────────────
function startIPCServer() {
  const srv = express();
  srv.use(express.json());

  // Game client POSTs here when a defect is detected
  srv.post('/defect', (req, res) => {
    const defect = req.body;
    res.json({ ok: true });
    handleIncomingDefect(defect);
  });

  // Health check
  srv.get('/ping', (_, res) => res.json({ status: 'bloom-online' }));

  srv.listen(IPC_PORT, '127.0.0.1', () => {
    console.log(`Bloom IPC server listening on port ${IPC_PORT}`);
  });
}

// ── Handle a defect event arriving from the game ──────────────────────────────
function handleIncomingDefect(defect) {
  const title = `🐛 Defect Detected — ${defect.type || 'Unknown'}`;
  const body  = defect.summary || 'A defect was detected in the game session. Click to view the report.';

  // Send Windows notification
  const notif = new Notification({
    title,
    body,
    icon: path.join(__dirname, '..', 'assets', 'bloom.png'),
    urgency: 'critical',
    timeoutType: 'never'
  });

  notif.on('click', () => {
    createPlatformWindow();
    // Navigate to reporter tab after a moment
    setTimeout(() => {
      if (platformWindow && !platformWindow.isDestroyed()) {
        platformWindow.loadURL(PLATFORM_URL);
        platformWindow.show();
        platformWindow.focus();
      }
    }, 400);
  });

  notif.show();

  // Also tell the widget to show its alert state
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('defect-alert', defect);
  }
}

// ── Widget IPC ────────────────────────────────────────────────────────────────
ipcMain.on('open-platform', () => createPlatformWindow());

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  app.setAppUserModelId('com.ubisoft.bloom-assistant');
  setAutoStart();
  createTray();
  createWidget();
  startIPCServer();

  // If launched without --hidden, open platform immediately
  if (!process.argv.includes('--hidden')) {
    createPlatformWindow();
  }
});

app.on('window-all-closed', (e) => {
  // Keep running in tray — don't quit
  e.preventDefault();
});
