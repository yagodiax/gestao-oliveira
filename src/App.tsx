import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { Product, Sale, StoreData, Payment } from '../electron/store'
import './App.css'

type Page = 'Início' | 'Frente de caixa' | 'Produtos' | 'Vendas' | 'Relatórios' | 'Caixa'
type CartItem = { key: string; productId: string | null; name: string; quantity: number; unitPrice: number }
const pages: { name: Page; icon: string }[] = [
  { name: 'Início', icon: '⌂' }, { name: 'Frente de caixa', icon: '▣' },
  { name: 'Produtos', icon: '▤' }, { name: 'Vendas', icon: '↗' },
  { name: 'Relatórios', icon: '▥' }, { name: 'Caixa', icon: '◷' },
]
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateTime = (v: string) => new Date(v).toLocaleString('pt-BR')
const blankData: StoreData = { version: 1, products: [], sales: [], cashSession: null, nextSaleNumber: 1 }

function App() {
  const [page, setPage] = useState<Page>('Início')
  const [data, setData] = useState<StoreData>(blankData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [productModal, setProductModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [checkout, setCheckout] = useState(false)
  const [checkoutPayments, setCheckoutPayments] = useState<Payment[]>([])
  const [openingAmount, setOpeningAmount] = useState('0')
  const [productForm, setProductForm] = useState({ name: '', category: 'Geral', costPrice: '', salePrice: '', stock: '0', unit: 'un' })

  const refresh = useCallback(async () => {
    try {
      const state = await window.loja.getState()
      setData(state)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar os dados locais.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const activeProducts = useMemo(() => data.products.filter(p => p.active).filter(p => {
    const q = search.trim().toLowerCase()
    return !q || (p.name + ' ' + p.category).toLowerCase().includes(q)
  }), [data.products, search])
  const total = useMemo(() => Math.round(cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100) / 100, [cart])
  const todaySales = data.sales.filter(s => s.status === 'concluida' && new Date(s.createdAt).toDateString() === new Date().toDateString())
  const todayTotal = todaySales.reduce((sum, sale) => sum + sale.total, 0)
  const lowStock = data.products.filter(p => p.active && p.stock <= 5)

  const run = async (action: () => Promise<unknown>, success: string) => {
    try { await action(); await refresh(); setNotice(success); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Ocorreu um erro.'); setNotice('') }
  }

  const openNewProduct = (product?: Product) => {
    setEditing(product || null)
    setProductForm(product ? {
      name: product.name, category: product.category, costPrice: product.costPrice === null ? '' : String(product.costPrice),
      salePrice: String(product.salePrice), stock: String(product.stock), unit: product.unit,
    } : { name: '', category: 'Geral', costPrice: '', salePrice: '', stock: '0', unit: 'un' })
    setProductModal(true)
  }

  const saveProduct = async (event: FormEvent) => {
    event.preventDefault()
    await run(() => window.loja.saveProduct({
      id: editing?.id, name: productForm.name, category: productForm.category,
      costPrice: productForm.costPrice.trim() === '' ? null : Number(productForm.costPrice),
      salePrice: Number(productForm.salePrice), stock: Number(productForm.stock), unit: productForm.unit,
    }), editing ? 'Produto atualizado.' : 'Produto cadastrado.')
    setProductModal(false)
  }

  const addProduct = (product: Product) => {
    setCart(current => {
      const found = current.find(item => item.productId === product.id)
      if (found) return current.map(item => item.key === found.key ? { ...item, quantity: item.quantity + 1 } : item)
      return [...current, { key: product.id, productId: product.id, name: product.name, quantity: 1, unitPrice: product.salePrice }]
    })
    setError('')
  }

  const addDiversos = () => {
    const description = window.prompt('Descrição do item (ex.: produto sem cadastro):')
    if (!description?.trim()) return
    const raw = window.prompt('Valor total deste item (R$):')
    if (raw === null) return
    const value = Number(raw.replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) { setError('Informe um valor válido para Diversos.'); return }
    setCart(items => [...items, { key: crypto.randomUUID(), productId: null, name: 'Diversos — ' + description.trim(), quantity: 1, unitPrice: Math.round(value * 100) / 100 }])
    setError('')
  }

  const finalize = async () => {
    if (cart.length === 0) return
    setCheckoutPayments([{ method: 'Dinheiro', amount: total }])
    setCheckout(true)
  }

  const confirmSale = async () => {
    try {
      const sale = await window.loja.finalizeSale({ items: cart.map(i => ({ productId: i.productId, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })), payments: checkoutPayments })
      setCart([]); setCheckout(false); setPage('Vendas'); setNotice('Venda registrada com sucesso.'); setError('')
      await refresh()
      if (window.confirm('Venda registrada! Deseja imprimir o comprovante da Mercearia Oliveira?')) {
        const result = await window.loja.printReceipt(sale)
        if (!result.success) setError('Venda salva, mas não foi possível imprimir: ' + (result.error || 'verifique a impressora.'))
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível registrar a venda.'); setNotice('') }
  }

  const printSale = async (sale: Sale) => {
    try {
      const result = await window.loja.printReceipt(sale)
      if (result.success) { setNotice('Comprovante da venda #' + sale.number + ' enviado para impressão.'); setError('') }
      else { setError('Não foi possível imprimir: ' + (result.error || 'verifique a impressora.')); setNotice('') }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível imprimir o comprovante.')
      setNotice('')
    }
  }

  const cancelSale = async (sale: Sale) => {
    if (sale.status === 'cancelada' || !window.confirm('Cancelar a venda #' + sale.number + '? O estoque dos produtos será restaurado.')) return
    await run(() => window.loja.cancelSale(sale.id), 'Venda cancelada e estoque restaurado.')
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">O</div><div><strong>Gestão Oliveira</strong><span>GESTÃO COMERCIAL</span></div></div>
      <div className="nav-label">MENU PRINCIPAL</div>
      <nav>{pages.map(item => <button key={item.name} className={page === item.name ? 'nav-item active' : 'nav-item'} onClick={() => { setPage(item.name); setError(''); setNotice('') }}><span className="nav-icon">{item.icon}</span>{item.name}</button>)}</nav>
      <div className="sidebar-footer"><span className={data.cashSession && !data.cashSession.closedAt ? 'status-dot' : 'status-dot closed'} />{data.cashSession && !data.cashSession.closedAt ? 'Caixa aberto' : 'Caixa fechado'}<small>· Dados neste computador</small></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">Gestão Oliveira <span>/</span> {page}</div><span className="user-chip">● Operação local</span></header>
      <section className="page-content">
        {(error || notice) && <div className={error ? 'alert error' : 'alert success'} role="status">{error || notice}<button onClick={() => { setError(''); setNotice('') }}>×</button></div>}
        {loading ? <div className="panel empty">Carregando dados locais...</div> : <>
          {page === 'Início' && <><Heading title="Visão geral" subtitle="Resumo real da loja." action={<button className="button-primary" onClick={() => setPage('Frente de caixa')}>＋ Nova venda</button>} />
            <div className="stats-grid"><Stat label="Faturamento de hoje" value={money(todayTotal)} note="Vendas concluídas" /><Stat label="Vendas hoje" value={String(todaySales.length)} note="Sem contar cancelamentos" /><Stat label="Produtos ativos" value={String(data.products.filter(p => p.active).length)} note="Cadastrados no sistema" /><Stat label="Estoque baixo" value={String(lowStock.length)} note="5 unidades ou menos" /></div>
            <div className="content-grid"><section className="panel"><PanelTitle title="Acesso rápido" /><Shortcut title="Registrar venda" text="Abrir frente de caixa" onClick={() => setPage('Frente de caixa')} /><Shortcut title="Cadastrar produto" text="Adicionar ao estoque" onClick={() => { openNewProduct(); setPage('Produtos') }} /><Shortcut title="Consultar vendas" text="Histórico e cancelamentos" onClick={() => setPage('Vendas')} /></section>
              <section className="panel"><PanelTitle title="Estoque baixo" /><p className="muted">Produtos com 5 unidades ou menos.</p>{lowStock.length ? lowStock.slice(0, 6).map(p => <div className="simple-row" key={p.id}><span>{p.name}</span><strong>{p.stock} {p.unit}</strong></div>) : <div className="empty compact">Nenhum alerta de estoque.</div>}</section></div>
          </>}
          {page === 'Produtos' && <><Heading title="Produtos e estoque" subtitle="Cadastre e atualize os produtos da loja." action={<button className="button-primary" onClick={() => openNewProduct()}>＋ Novo produto</button>} /><input className="search-input" placeholder="Buscar por nome ou categoria..." value={search} onChange={e => setSearch(e.target.value)} /><div className="panel table-panel"><table><thead><tr><th>PRODUTO</th><th>CATEGORIA</th><th>ESTOQUE</th><th>CUSTO</th><th>VENDA</th><th></th></tr></thead><tbody>{activeProducts.map(p => <tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.category}</td><td><span className={p.stock <= 5 ? 'stock-low' : ''}>{p.stock} {p.unit}</span></td><td>{p.costPrice === null ? '—' : money(p.costPrice)}</td><td>{money(p.salePrice)}</td><td className="row-actions"><button onClick={() => openNewProduct(p)}>Editar</button><button onClick={() => { if (window.confirm('Remover ou arquivar ' + p.name + '?')) void run(() => window.loja.deleteProduct(p.id), 'Produto removido/arquivado.') }}>Remover</button></td></tr>)}</tbody></table>{activeProducts.length === 0 && <div className="empty">Nenhum produto cadastrado. Clique em “Novo produto” para começar.</div>}</div></>}
          {page === 'Frente de caixa' && <><Heading title="Frente de caixa" subtitle={data.cashSession && !data.cashSession.closedAt ? 'Caixa aberto — venda pronta para registrar.' : 'Abra o caixa antes de registrar vendas.'} action={!(data.cashSession && !data.cashSession.closedAt) ? <button className="button-primary" onClick={() => setPage('Caixa')}>Abrir caixa</button> : undefined} /><div className="pos-layout"><section className="panel"><input className="search-input full" placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} /><div className="product-pick-grid">{activeProducts.filter(p => (p.name + ' ' + p.category).toLowerCase().includes(search.toLowerCase())).map(p => <button className="product-pick" key={p.id} onClick={() => addProduct(p)}><strong>{p.name}</strong><span>{p.stock > 0 ? `${p.stock} ${p.unit} em estoque` : 'Sem estoque — venda permitida'}</span><b>{money(p.salePrice)}</b></button>)}</div><button className="button-secondary" onClick={addDiversos}>＋ Item Diversos (valor manual)</button></section><section className="panel cart-panel"><PanelTitle title="Venda atual" /><div className="cart-items">{cart.map(item => <div className="cart-row" key={item.key}><div><strong>{item.name}</strong><small>{money(item.unitPrice)} cada</small></div><div className="quantity-controls"><button onClick={() => setCart(c => c.map(i => i.key === item.key ? {...i, quantity: Math.max(1, i.quantity - 1)} : i))}>−</button><span>{item.quantity}</span><button onClick={() => setCart(c => c.map(i => i.key === item.key ? {...i, quantity: i.quantity + 1} : i))}>＋</button><button className="remove" onClick={() => setCart(c => c.filter(i => i.key !== item.key))}>×</button></div><strong>{money(item.quantity * item.unitPrice)}</strong></div>)}{cart.length === 0 && <div className="empty compact">Selecione produtos para iniciar a venda.</div>}</div><div className="cart-total"><span>Total</span><strong>{money(total)}</strong></div><button className="button-primary checkout-button" disabled={!cart.length || !(data.cashSession && !data.cashSession.closedAt)} onClick={() => void finalize()}>Receber pagamento</button></section></div></>}
          {page === 'Vendas' && <><Heading title="Histórico de vendas" subtitle="Consulte vendas registradas e cancele quando necessário." /><div className="panel table-panel"><table><thead><tr><th>VENDA</th><th>DATA/HORA</th><th>ITENS</th><th>PAGAMENTO</th><th>TOTAL</th><th>STATUS</th><th></th></tr></thead><tbody>{data.sales.map(s => <tr key={s.id}><td>#{String(s.number).padStart(6,'0')}</td><td>{dateTime(s.createdAt)}</td><td>{s.items.reduce((n,i)=>n+i.quantity,0)}</td><td>{[...new Set(s.payments.map(p=>p.method))].join(', ')}</td><td><strong>{money(s.total)}</strong></td><td><span className={s.status === 'concluida' ? 'status-pill' : 'status-pill cancelled'}>{s.status === 'concluida' ? 'Concluída' : 'Cancelada'}</span></td><td className="row-actions"><button className="receipt-button" onClick={() => void printSale(s)}>Imprimir</button>{s.status === 'concluida' && <button className="text-button" onClick={() => void cancelSale(s)}>Cancelar</button>}</td></tr>)}</tbody></table>{data.sales.length === 0 && <div className="empty">As vendas registradas aparecerão aqui.</div>}</div></>}
          {page === 'Relatórios' && <><Heading title="Relatórios" subtitle="Resumo calculado a partir das vendas salvas." /><div className="stats-grid"><Stat label="Faturamento total" value={money(data.sales.filter(s=>s.status==='concluida').reduce((n,s)=>n+s.total,0))} note="Vendas não canceladas" /><Stat label="Vendas concluídas" value={String(data.sales.filter(s=>s.status==='concluida').length)} note="Desde o início do uso" /><Stat label="Ticket médio" value={money(data.sales.filter(s=>s.status==='concluida').length ? data.sales.filter(s=>s.status==='concluida').reduce((n,s)=>n+s.total,0)/data.sales.filter(s=>s.status==='concluida').length : 0)} note="Por venda concluída" /><Stat label="Lucro estimado" value={money(data.sales.filter(s=>s.status==='concluida').reduce((n,s)=>n+s.items.reduce((m,i)=>m+(i.costPrice === null ? 0 : (i.unitPrice-i.costPrice)*i.quantity),0),0))} note="Somente itens com custo informado" /></div><section className="panel"><PanelTitle title="Formas de pagamento" />{(['Dinheiro','Crédito','Débito','Pix'] as const).map(method => <div className="simple-row" key={method}><span>{method}</span><strong>{money(data.sales.filter(s=>s.status==='concluida').flatMap(s=>s.payments).filter(p=>p.method===method).reduce((n,p)=>n+p.amount,0))}</strong></div>)}<p className="muted">O lucro estimado será calculado com base no custo cadastrado de cada produto. Itens Diversos sem custo conhecido não entram no cálculo de lucro.</p></section></>}
          {page === 'Caixa' && <><Heading title="Caixa" subtitle="Abertura e fechamento do caixa principal." /><section className="panel cash-panel"><div className="cash-state"><span className={data.cashSession && !data.cashSession.closedAt ? 'status-dot' : 'status-dot closed'} />{data.cashSession && !data.cashSession.closedAt ? 'Caixa aberto' : 'Caixa fechado'}</div>{data.cashSession && !data.cashSession.closedAt ? <><p>Aberto em {dateTime(data.cashSession.openedAt)} · Fundo inicial: {money(data.cashSession.openingAmount)}</p><button className="button-primary" onClick={() => void run(() => window.loja.closeCash(), 'Caixa fechado. Confira o resumo nas mensagens.')}>Fechar caixa</button></> : <><label className="field-label">Valor inicial em dinheiro (R$)<input className="search-input" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)} inputMode="decimal" /></label><button className="button-primary" onClick={() => void run(() => window.loja.openCash(Number(openingAmount.replace(',','.'))), 'Caixa aberto.')}>Abrir caixa</button></>}</section></>}
        </>}
        <footer className="page-footer">Gestão Oliveira · Aplicativo local</footer>
      </section>
    </main>
    {productModal && <div className="modal-backdrop" role="presentation"><form className="modal" onSubmit={saveProduct}><div className="modal-heading"><h2>{editing ? 'Editar produto' : 'Novo produto'}</h2><button type="button" className="icon-button" onClick={() => setProductModal(false)}>×</button></div><label className="field-label">Nome<input required autoFocus value={productForm.name} onChange={e => setProductForm({...productForm,name:e.target.value})} /></label><div className="form-grid"><label className="field-label">Categoria<input value={productForm.category} onChange={e => setProductForm({...productForm,category:e.target.value})} /></label><label className="field-label">Unidade<select value={productForm.unit} onChange={e => setProductForm({...productForm,unit:e.target.value})}><option value="un">Unidade</option><option value="kg">Kg</option><option value="g">Grama</option><option value="L">Litro</option><option value="ml">Ml</option><option value="cx">Caixa</option></select></label><label className="field-label">Preço de custo (R$)<input type="number" min="0" step="0.01" value={productForm.costPrice} onChange={e => setProductForm({...productForm,costPrice:e.target.value})} placeholder="Opcional" /></label><label className="field-label">Preço de venda (R$)<input required type="number" min="0.01" step="0.01" value={productForm.salePrice} onChange={e => setProductForm({...productForm,salePrice:e.target.value})} /></label><label className="field-label">Estoque inicial/atual<input required type="number" min="0" step="1" value={productForm.stock} onChange={e => setProductForm({...productForm,stock:e.target.value})} /></label></div><div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setProductModal(false)}>Voltar</button><button className="button-primary" type="submit">Salvar produto</button></div></form></div>}
    {checkout && <div className="modal-backdrop"><div className="modal checkout-modal"><div className="modal-heading"><h2>Receber pagamento</h2><button className="icon-button" onClick={() => setCheckout(false)}>×</button></div><p className="muted">Total da venda</p><div className="checkout-total">{money(total)}</div><div className="payment-lines">{checkoutPayments.map((payment, index) => <div className="payment-line" key={index}><label className="field-label">Forma<select value={payment.method} onChange={e => setCheckoutPayments(rows => rows.map((row,i) => i === index ? {...row, method:e.target.value as Payment['method']} : row))}><option>Dinheiro</option><option>Pix</option><option>Débito</option><option>Crédito</option></select></label><label className="field-label">Valor (R$)<input type="number" min="0.01" step="0.01" value={payment.amount} onChange={e => setCheckoutPayments(rows => rows.map((row,i) => i === index ? {...row, amount:Number(e.target.value)} : row))} /></label>{checkoutPayments.length > 1 && <button className="icon-button payment-remove" onClick={() => setCheckoutPayments(rows => rows.filter((_,i) => i !== index))}>×</button>}</div>)}</div><button className="button-secondary" onClick={() => setCheckoutPayments(rows => [...rows, {method: rows.some(r=>r.method==='Pix') ? 'Débito' : 'Pix', amount: 0}])}>＋ Dividir pagamento</button><p className="muted">Valores informados: {money(checkoutPayments.reduce((sum,p)=>sum+p.amount,0))} · A soma deve ser igual ao total da venda.</p><div className="modal-actions"><button className="button-secondary" onClick={() => setCheckout(false)}>Voltar</button><button className="button-primary" onClick={() => void confirmSale()}>Confirmar venda</button></div></div></div>}
  </div>
}

function Heading({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) { return <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div> }
function PanelTitle({ title }: { title: string }) { return <div className="panel-heading"><h2>{title}</h2></div> }
function Stat({ label, value, note }: { label: string; value: string; note: string }) { return <article className="stat-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></article> }
function Shortcut({ title, text, onClick }: { title: string; text: string; onClick: () => void }) { return <button className="shortcut" onClick={onClick}><span className="shortcut-icon">↗</span><span><strong>{title}</strong><small>{text}</small></span><span className="arrow">→</span></button> }

export default App
