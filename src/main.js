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
    width: 90,
    height: 90,
    x: width - 110,
    y: height - 118,
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
  tray.on('click', () => {
    if (pendingReport) {
      openPlatformWithReport(pendingReport);
    } else {
      createPlatformWindow();
    }
  });
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

// ── Pending crash/defect to inject when platform opens ───────────────────────
let pendingReport = null;

function injectReportIntoPlatform(defect) {
  if (!platformWindow || platformWindow.isDestroyed()) return;
  const safe = JSON.stringify(defect).replace(/\\/g, '\\\\').replace(/`/g, '\\`');
  platformWindow.webContents.executeJavaScript(`
    if (typeof window.bloomShowReport === 'function') {
      window.bloomShowReport(${safe});
    }
  `).catch(() => {});
}

// ── Custom toast notification window ─────────────────────────────────────────
function showToast(defect) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const W = 360, H = 100;

  const toast = new BrowserWindow({
    width: W, height: H,
    x: width - W - 16,
    y: height - H - 16,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: true,
    backgroundColor: '#ffffff',
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });

  const isCrash = defect.isCrash;
  const accentHex = isCrash ? '#d03030' : '#e65c00';
  const label     = isCrash ? 'CRITICAL CRASH' : 'DEFECT DETECTED';
  const summary   = (defect.summary || 'A defect was detected in the game session.').replace(/'/g, "\\'");
  const logoPath  = path.join(__dirname, '..', 'assets', 'bloom.png').replace(/\\/g, '/');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;background:#fff;font-family:-apple-system,Segoe UI,sans-serif;overflow:hidden;cursor:pointer}
  .wrap{display:flex;align-items:center;height:100%;padding:12px 14px;gap:12px;background:#fff;border-left:4px solid ${accentHex}}
  .logo{width:40px;height:40px;object-fit:contain;flex-shrink:0}
  .text{flex:1;min-width:0}
  .label{font-size:10px;font-weight:700;letter-spacing:0.08em;color:${accentHex};text-transform:uppercase;margin-bottom:3px}
  .title{font-size:13px;font-weight:700;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sub{font-size:11px;color:#555;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .close{flex-shrink:0;font-size:16px;color:#aaa;line-height:1;padding:4px;border-radius:4px}
  .close:hover{background:#f0f0f0;color:#333}
  body:hover .wrap{background:#fafafa}
</style>
</head><body>
<div class="wrap" id="wrap">
  <img class="logo" src="file://${logoPath}" onerror="this.style.display='none'"/>
  <div class="text">
    <div class="label">${label}</div>
    <div class="title">Bloomberg QA · ${defect.id || 'DEF-XXXX'}</div>
    <div class="sub">${summary}</div>
  </div>
  <div class="close" id="cls">✕</div>
</div>
<script>
const {ipcRenderer} = require('electron');
document.getElementById('wrap').addEventListener('click', e => {
  if(e.target.id==='cls'){ipcRenderer.send('toast-close'); return;}
  ipcRenderer.send('toast-open-platform');
});
document.getElementById('cls').addEventListener('click', () => ipcRenderer.send('toast-close'));
setTimeout(() => ipcRenderer.send('toast-close'), 7000);
</script>
</body></html>`;

  toast.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

  ipcMain.once('toast-close', () => { if (!toast.isDestroyed()) toast.close(); });
  ipcMain.once('toast-open-platform', () => {
    if (!toast.isDestroyed()) toast.close();
    pendingReport = defect;
    openPlatformWithReport(defect);
  });
}

function openPlatformWithReport(defect) {
  if (platformWindow && !platformWindow.isDestroyed()) {
    platformWindow.show();
    platformWindow.focus();
    // Platform already open — inject immediately
    setTimeout(() => injectReportIntoPlatform(defect), 300);
  } else {
    createPlatformWindow();
    // Wait for platform to finish loading before injecting
    platformWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => injectReportIntoPlatform(defect), 800);
    });
  }
}

// ── Handle a defect event arriving from the game ──────────────────────────────
function handleIncomingDefect(defect) {
  showToast(defect);

  // Also tell the widget to show its alert state
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('defect-alert', defect);
  }
}

// ── Widget IPC ────────────────────────────────────────────────────────────────
ipcMain.on('open-platform', () => {
  if (pendingReport) {
    openPlatformWithReport(pendingReport);
  } else {
    createPlatformWindow();
  }
});

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
