import { app, BrowserWindow, ipcMain } from 'electron'
import { store } from './store'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

ipcMain.handle('store:get-state', () => store.getState())
ipcMain.handle('product:save', (_event, input) => store.saveProduct(input))
ipcMain.handle('product:delete', (_event, id: string) => store.deleteProduct(id))
ipcMain.handle('sale:finalize', (_event, input) => store.finalizeSale(input))
ipcMain.handle('sale:cancel', (_event, id: string) => store.cancelSale(id))
ipcMain.handle('cash:open', (_event, amount: number) => store.openCash(amount))
ipcMain.handle('cash:close', () => store.closeCash())


function escapeHtml(value: unknown) {
  const entities: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }
  return String(value).replace(/[&<>"']/g, character => entities[character] ?? character)
}

ipcMain.handle('receipt:print', async (_event, sale: {
  number: number; createdAt: string; items: { name: string; quantity: number; unitPrice: number }[];
  payments: { method: string; amount: number }[]; total: number;
}) => {
  const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const rows = sale.items.map(item => `<tr><td colspan="2">${escapeHtml(item.name)}</td></tr><tr><td>${item.quantity} x ${money(item.unitPrice)}</td><td class="right">${money(item.quantity * item.unitPrice)}</td></tr>`).join('')
  const payments = sale.payments.map(payment => `<div class="line"><span>${escapeHtml(payment.method)}</span><strong>${money(payment.amount)}</strong></div>`).join('')
  const date = new Date(sale.createdAt).toLocaleString('pt-BR')
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comprovante ${sale.number}</title><style>
    @page{size:80mm auto;margin:4mm}*{box-sizing:border-box}body{width:72mm;margin:0 auto;font-family:Arial,sans-serif;color:#000;font-size:11px}
    h1{font-size:18px;text-align:center;margin:0 0 5px}p{text-align:center;margin:3px 0}.muted{font-size:9px}
    .rule{border-top:1px dashed #000;margin:9px 0}.line{display:flex;justify-content:space-between;gap:8px;margin:4px 0}
    table{width:100%;border-collapse:collapse}td{padding:3px 0;vertical-align:top}td.right{text-align:right;white-space:nowrap}
    .total{font-size:15px;font-weight:bold}.footer{text-align:center;line-height:1.5;margin-top:12px}
  </style></head><body><h1>Mercearia Oliveira</h1><p>COMPROVANTE DE VENDA</p><p class="muted">Não é documento fiscal</p><div class="rule"></div>
  <div class="line"><span>Venda</span><strong>#${String(sale.number).padStart(6,'0')}</strong></div><div class="line"><span>Data</span><span>${escapeHtml(date)}</span></div>
  <div class="rule"></div><strong>PRODUTOS</strong><table>${rows}</table><div class="rule"></div>
  <div class="line total"><span>TOTAL</span><span>${money(sale.total)}</span></div><div class="rule"></div><strong>PAGAMENTO</strong>${payments}
  <div class="rule"></div><div class="footer">Obrigado pela preferência!<br>Mercearia Oliveira</div></body></html>`
  const receiptWindow = new BrowserWindow({ width: 420, height: 760, show: false, autoHideMenuBar: true, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
  try {
    await receiptWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    return await new Promise<{ success: boolean; error?: string }>(resolve => {
      receiptWindow.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
        resolve(success ? { success: true } : { success: false, error: failureReason || 'Impressão cancelada ou indisponível.' })
        if (!receiptWindow.isDestroyed()) receiptWindow.close()
      })
    })
  } catch (error) {
    if (!receiptWindow.isDestroyed()) receiptWindow.close()
    throw error
  }
})

app.whenReady().then(createWindow)
