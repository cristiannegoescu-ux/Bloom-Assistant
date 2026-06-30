# Bloom Assistant — Recovery Guide

## Run (development)

```powershell
cd C:\Users\cnegoescu\bloom-assistant
npm install        # first time only
npm start          # launches Electron app
# or: npx electron . --hidden   (starts in tray only, no platform window)
```

## GitHub repo

```
https://github.com/cristiannegoescu-ux/Bloom-Assistant
```

## Architecture

```
Bloom Assistant (Electron)
├── System tray icon           — left-click → open platform / show pending report
├── Floating widget (90×90)    — always-on-top B logo, drag anywhere
│   └── turns red + badge      — when crash/defect arrives from game
├── Platform window            — loads http://10.18.68.179/platform/#reporter
├── HTTP server :3333          — listens for POST /defect from Game Client
└── White toast notification   — fires on crash/defect, click → opens Platform
                                  with crash report modal injected
```

## Crash/defect report flow

Game Client POSTs JSON to `http://127.0.0.1:3333/defect`:
```json
{
  "type":     "Access Violation",
  "summary":  "Access violation — read from null pointer",
  "id":       "CRASH-0001",
  "severity": "Critical",
  "session":  "ABC123",
  "score":    80,
  "stack":    "AccessViolation: 0x00000000\n  at MemoryManager.read() :88",
  "timestamp":"2026-06-30 09:14:02 UTC",
  "isCrash":  true
}
```

On receipt:
1. White toast notification appears (bottom-right, red border for crash / orange for defect)
2. Widget turns red with badge count
3. User clicks toast → `openPlatformWithReport()` is called
   - If platform already open: injects `bloomShowReport(data)` immediately
   - If platform closed: opens it, waits for load, then injects
4. Reporter page shows full crash modal with call stack + "Add to Sent Reports" button
5. Tray icon click also opens platform with the pending report

## Files

| File | Purpose |
|------|---------|
| `src/main.js` | Electron main — tray, widget, IPC server, toast, report injection |
| `src/widget.html` | Floating Bloom avatar UI (90×90, float animation fully visible) |
| `assets/bloom.png` | App icon (Bloomberg B logo) |

## Restore from scratch

```powershell
git clone https://github.com/cristiannegoescu-ux/Bloom-Assistant.git C:\Users\cnegoescu\bloom-assistant
cd C:\Users\cnegoescu\bloom-assistant
npm install
npm start
```

## Build .exe installer

```powershell
cd C:\Users\cnegoescu\bloom-assistant
npm run build
# Output: dist\Bloom Assistant Setup.exe
# Requires: assets\bloom.ico  (convert bloom.png at https://convertio.co/png-ico/)
```

## Auto-start

Registers itself in Windows startup on first launch (`app.setLoginItemSettings`).  
To disable: Task Manager → Startup Apps → Bloom Assistant → Disable.

## Platform URL

Default: `http://10.18.68.179/platform/#reporter`  
Change in `src/main.js` → `const PLATFORM_URL = '...'`
