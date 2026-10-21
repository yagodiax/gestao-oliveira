import { app } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export type Product = {
  id: string
  name: string
  category: string
  costPrice: number | null
  salePrice: number
  stock: number
  unit: string
  active: boolean
  createdAt: string
}

export type Payment = { method: 'Dinheiro' | 'Crédito' | 'Débito' | 'Pix'; amount: number }
export type SaleItem = { productId: string | null; name: string; quantity: number; unitPrice: number; costPrice: number | null }
export type Sale = {
  id: string
  number: number
  createdAt: string
  items: SaleItem[]
  payments: Payment[]
  total: number
  status: 'concluida' | 'cancelada'
  cancelledAt?: string
  cashSessionId?: string
}
export type CashSummary = {
  salesCount: number
  salesTotal: number
  estimatedCost: number
  estimatedProfit: number
  byPayment: Record<Payment['method'], number>
}
export type CashSession = {
  id: string
  openedAt: string
  openingAmount: number
  closedAt?: string
  closingAmount?: number
  summary?: CashSummary
}
export type StoreData = {
  version: 1
  products: Product[]
  sales: Sale[]
  cashSession: CashSession | null
  cashSessions: CashSession[]
  nextSaleNumber: number
}

const filePath = () => path.join(app.getPath('userData'), 'gestao-oliveira.json')
let queue = Promise.resolve()

async function readData(): Promise<StoreData> {
  try {
    const raw = await fs.readFile(filePath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<StoreData>
    if (parsed.version !== 1 || !Array.isArray(parsed.products) || !Array.isArray(parsed.sales)) throw new Error('Arquivo de dados inválido.')
    const sessions = Array.isArray(parsed.cashSessions) ? parsed.cashSessions : []
    const current = parsed.cashSession || null
    if (current && !sessions.some(session => session.id === current.id)) sessions.push(current)
    const data: StoreData = {
      version: 1,
      products: parsed.products,
      sales: parsed.sales,
      cashSession: current,
      cashSessions: sessions,
      nextSaleNumber: Number(parsed.nextSaleNumber) || Math.max(0, ...parsed.sales.map(sale => Number(sale.number) || 0)) + 1,
    }
    return data
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    const initial: StoreData = { version: 1, products: [], sales: [], cashSession: null, cashSessions: [], nextSaleNumber: 1 }
    await writeData(initial)
    return initial
  }
}

async function writeData(data: StoreData) {
  const target = filePath()
  const directory = path.dirname(target)
  await fs.mkdir(directory, { recursive: true })
  try {
    await fs.access(target)
    const backupDirectory = path.join(directory, 'backups')
    await fs.mkdir(backupDirectory, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    await fs.copyFile(target, path.join(backupDirectory, `gestao-oliveira-${stamp}.json`))
    const backups = (await fs.readdir(backupDirectory)).filter(name => name.startsWith('gestao-oliveira-') && name.endsWith('.json')).sort()
    for (const oldBackup of backups.slice(0, Math.max(0, backups.length - 7))) await fs.unlink(path.join(backupDirectory, oldBackup))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const temporary = target + '.tmp'
  await fs.writeFile(temporary, JSON.stringify(data, null, 2), 'utf8')
  await fs.rename(temporary, target)
}

async function mutate<T>(fn: (data: StoreData) => T | Promise<T>): Promise<T> {
  let resolveResult!: (value: T) => void
  let rejectResult!: (reason?: unknown) => void
  const result = new Promise<T>((resolve, reject) => { resolveResult = resolve; rejectResult = reject })
  queue = queue.then(async () => {
    try {
      const data = await readData()
      const value = await fn(data)
      await writeData(data)
      resolveResult(value)
    } catch (error) { rejectResult(error) }
  })
  await queue
  return result
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const cleanText = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(label + ' é obrigatório.')
  return value.trim()
}
const validMoney = (value: unknown, label: string, allowZero = false) => {
  const n = Number(value)
  if (!Number.isFinite(n) || (allowZero ? n < 0 : n <= 0)) throw new Error(label + ' inválido.')
  return roundMoney(n)
}
const emptyPaymentTotals = (): Record<Payment['method'], number> => ({ Dinheiro: 0, Crédito: 0, Débito: 0, Pix: 0 })
function summarizeSales(sales: Sale[]): CashSummary {
  const summary: CashSummary = { salesCount: sales.length, salesTotal: 0, estimatedCost: 0, estimatedProfit: 0, byPayment: emptyPaymentTotals() }
  for (const sale of sales) {
    summary.salesTotal += sale.total
    for (const payment of sale.payments) summary.byPayment[payment.method] += payment.amount
    for (const item of sale.items) {
      if (item.costPrice !== null && Number.isFinite(item.costPrice)) {
        summary.estimatedCost += item.costPrice * item.quantity
        summary.estimatedProfit += (item.unitPrice - item.costPrice) * item.quantity
      }
    }
  }
  summary.salesTotal = roundMoney(summary.salesTotal)
  summary.estimatedCost = roundMoney(summary.estimatedCost)
  summary.estimatedProfit = roundMoney(summary.estimatedProfit)
  for (const method of Object.keys(summary.byPayment) as Payment['method'][]) summary.byPayment[method] = roundMoney(summary.byPayment[method])
  return summary
}
function salesForSession(data: StoreData, session: CashSession): Sale[] {
  return data.sales.filter(sale => sale.status === 'concluida' && (
    sale.cashSessionId
      ? sale.cashSessionId === session.id
      : sale.createdAt >= session.openedAt && (!session.closedAt || sale.createdAt <= session.closedAt)
  ))
}

export const store = {
  getState: () => readData(),
  saveProduct: (input: Partial<Product>) => mutate(data => {
    const name = cleanText(input.name, 'Nome')
    const salePrice = validMoney(input.salePrice, 'Preço de venda')
    const costPrice = input.costPrice === null || input.costPrice === undefined ? null : validMoney(input.costPrice, 'Preço de custo', true)
    const stock = Number(input.stock ?? 0)
    if (!Number.isFinite(stock) || stock < 0) throw new Error('Estoque deve ser zero ou maior.')
    const id = input.id || crypto.randomUUID()
    const existing = data.products.find(p => p.id === id)
    const product: Product = {
      id, name, category: String(input.category || 'Geral').trim() || 'Geral',
      costPrice, salePrice, stock: Math.floor(stock), unit: String(input.unit || 'un').trim() || 'un',
      active: input.active ?? true, createdAt: existing?.createdAt || new Date().toISOString(),
    }
    if (existing) Object.assign(existing, product)
    else data.products.unshift(product)
    return product
  }),
  deleteProduct: (id: string) => mutate(data => {
    const product = data.products.find(p => p.id === id)
    if (!product) throw new Error('Produto não encontrado.')
    if (data.sales.some(s => s.items.some(i => i.productId === id))) {
      product.active = false
      return { archived: true }
    }
    data.products = data.products.filter(p => p.id !== id)
    return { archived: false }
  }),
  finalizeSale: (input: { items: { productId: string | null; name?: string; quantity: number; unitPrice?: number; description?: string }[]; payments: Payment[] }) => mutate(data => {
    if (!data.cashSession || data.cashSession.closedAt) throw new Error('Abra o caixa antes de registrar uma venda.')
    if (!Array.isArray(input.items) || input.items.length === 0) throw new Error('Adicione ao menos um item.')
    if (!Array.isArray(input.payments) || input.payments.length === 0) throw new Error('Informe a forma de pagamento.')
    const items: SaleItem[] = input.items.map(item => {
      const quantity = Number(item.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantidade inválida.')
      if (item.productId === null) {
        const name = cleanText(item.name, 'Descrição de Diversos')
        return { productId: null, name, quantity, unitPrice: validMoney(item.unitPrice, 'Valor do item'), costPrice: null }
      }
      const product = data.products.find(p => p.id === item.productId && p.active)
      if (!product) throw new Error('Um produto da venda não está mais disponível.')
      return { productId: product.id, name: product.name, quantity, unitPrice: product.salePrice, costPrice: product.costPrice }
    })
    const total = roundMoney(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0))
    const payments = input.payments.map(p => ({ method: p.method, amount: validMoney(p.amount, 'Valor do pagamento') }))
    const paid = roundMoney(payments.reduce((sum, p) => sum + p.amount, 0))
    if (Math.abs(paid - total) > 0.009) throw new Error('Os pagamentos precisam somar exatamente ' + total.toFixed(2).replace('.', ',') + '.')
    for (const item of items) if (item.productId) {
      const product = data.products.find(p => p.id === item.productId)!
      product.stock -= item.quantity
    }
    const sale: Sale = { id: crypto.randomUUID(), number: data.nextSaleNumber++, createdAt: new Date().toISOString(), items, payments, total, status: 'concluida', cashSessionId: data.cashSession.id }
    data.sales.unshift(sale)
    return sale
  }),
  cancelSale: (id: string) => mutate(data => {
    const sale = data.sales.find(s => s.id === id)
    if (!sale) throw new Error('Venda não encontrada.')
    if (sale.status === 'cancelada') return sale
    for (const item of sale.items) if (item.productId) {
      const product = data.products.find(p => p.id === item.productId)
      if (product) product.stock += item.quantity
    }
    sale.status = 'cancelada'
    sale.cancelledAt = new Date().toISOString()
    return sale
  }),
  openCash: (openingAmount: number) => mutate(data => {
    if (data.cashSession && !data.cashSession.closedAt) throw new Error('O caixa já está aberto.')
    const amount = Number(openingAmount)
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Valor inicial inválido.')
    const session: CashSession = { id: crypto.randomUUID(), openedAt: new Date().toISOString(), openingAmount: roundMoney(amount) }
    data.cashSession = session
    data.cashSessions = [...data.cashSessions.filter(old => old.id !== session.id), session]
    return session
  }),
  closeCash: () => mutate(data => {
    if (!data.cashSession || data.cashSession.closedAt) throw new Error('Não existe caixa aberto.')
    const session = data.cashSession
    session.closedAt = new Date().toISOString()
    const sales = salesForSession(data, session)
    session.summary = summarizeSales(sales)
    session.closingAmount = roundMoney(session.openingAmount + session.summary.byPayment.Dinheiro)
    data.cashSessions = data.cashSessions.map(old => old.id === session.id ? { ...session } : old)
    return { session, ...session.summary }
  }),
}
