# Bloom Assistant — Recovery Guide

## Run (development)

```powershell
cd C:\Users\cnegoescu\bloom-assistant
npm install        # first time only
npm start          # launches Electron app
# or: npx electron . --hidden   (starts in tray, no window)
```

## Architecture

```
Bloom Assistant (Electron)
├── System tray icon           — right-click → Open Platform / Quit
├── Floating widget (72×72)    — always-on-top B logo, drag anywhere
│   └── turns red + badge      — when defect arrives from game
├── Platform window            — loads http://10.18.68.179/platform/#reporter
├── HTTP server :3333           — listens for POST /defect from Game Client
└── Windows Notification       — fires on defect, click → opens Platform
```

## How it receives defects

Game Client POSTs JSON to `http://127.0.0.1:3333/defect`:
```json
{
  "type":    "NullReferenceException",
  "summary": "Snake movement controller crashed",
  "id":      "DEF-0001",
  "severity":"Critical",
  "session": "ABC123",
  "score":   80
}
```

## Files

| File | Purpose |
|------|---------|
| `src/main.js` | Electron main process — tray, window, IPC server |
| `src/widget.html` | Floating Bloom avatar UI |
| `assets/bloom.png` | App icon (Bloomberg B logo) |

## Build .exe installer

```powershell
cd C:\Users\cnegoescu\bloom-assistant
npm run build
# Output: dist\Bloom Assistant Setup.exe
```

> Requires `assets/bloom.ico` for Windows icon.  
> Convert `assets/bloom.png` to .ico at https://convertio.co/png-ico/

## Auto-start

The app registers itself in Windows startup automatically on first launch  
(`app.setLoginItemSettings({ openAtLogin: true })`).  
To disable: Task Manager → Startup Apps → Bloom Assistant → Disable.
