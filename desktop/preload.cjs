const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('roadFmDesktop', {
  onCommand(callback) {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('roadfm:command', (_event, command) => callback(command));
  },
  openLibrary() {
    ipcRenderer.send('roadfm:open-library');
  }
});