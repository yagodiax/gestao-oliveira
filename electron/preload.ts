import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('loja', {
  getState: () => ipcRenderer.invoke('store:get-state'),
  saveProduct: (input: unknown) => ipcRenderer.invoke('product:save', input),
  deleteProduct: (id: string) => ipcRenderer.invoke('product:delete', id),
  finalizeSale: (input: unknown) => ipcRenderer.invoke('sale:finalize', input),
  cancelSale: (id: string) => ipcRenderer.invoke('sale:cancel', id),
  openCash: (amount: number) => ipcRenderer.invoke('cash:open', amount),
  closeCash: () => ipcRenderer.invoke('cash:close'),
  printReceipt: (sale: unknown, options: unknown) => ipcRenderer.invoke('receipt:print', { sale, ...((options && typeof options === 'object') ? options : {}) }),
})
