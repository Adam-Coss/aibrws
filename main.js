const { app, BrowserWindow, dialog, session, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    title: 'AI Browser',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: true
    }
  });

  win.loadFile('index.html');

  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Load Unpacked Extension…',
          click: async () => {
            const res = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
            if (!res.canceled && res.filePaths[0]) {
              try {
                const ext = await session.defaultSession.loadExtension(res.filePaths[0]);
                console.log('Loaded extension:', ext.name);
              } catch (e) { console.error('Extension load error', e); }
            }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);

  const phPath = path.join(__dirname, 'people-highlighter');
  app.whenReady().then(async () => {
    try {
      await session.defaultSession.loadExtension(phPath);
      console.log('People Highlighter loaded');
    } catch (e) { console.error('People Highlighter load failed', e); }
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
