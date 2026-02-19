const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('crypthub', {
  hasMaster:          ()      => ipcRenderer.invoke('has-master'),
  setMaster:          (pwd)   => ipcRenderer.invoke('set-master', pwd),
  unlock:             (pwd)   => ipcRenderer.invoke('unlock', pwd),
  lock:               ()      => ipcRenderer.invoke('lock'),
  getEntries:         ()      => ipcRenderer.invoke('get-entries'),
  addEntry:           (data)  => ipcRenderer.invoke('add-entry', data),
  updateEntry:        (data)  => ipcRenderer.invoke('update-entry', data),
  deleteEntry:        (id)    => ipcRenderer.invoke('delete-entry', id),
  generatePassword:   (opts)  => ipcRenderer.invoke('generate-password', opts),
  // Migration
  exportVault:        ()      => ipcRenderer.invoke('export-vault'),
  importVault:        ()      => ipcRenderer.invoke('import-vault'),
  verifyAndRestore:   (data)  => ipcRenderer.invoke('verify-and-restore', data),
});