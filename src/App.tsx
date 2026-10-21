import { useState, type ReactNode } from 'react'
import './App.css'

type Page = 'Início' | 'Frente de caixa' | 'Produtos' | 'Vendas' | 'Relatórios' | 'Caixa'

const navigation: { label: Page; icon: string }[] = [
  { label: 'Início', icon: '⌂' },
  { label: 'Frente de caixa', icon: '▣' },
  { label: 'Produtos', icon: '▤' },
  { label: 'Vendas', icon: '↗' },
  { label: 'Relatórios', icon: '▥' },
  { label: 'Caixa', icon: '◷' },
]

const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function App() {
  const [page, setPage] = useState<Page>('Início')
  const [search, setSearch] = useState('')

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">O</div>
          <div><strong>Gestão Oliveira</strong><span>PAINEL DA LOJA</span></div>
        </div>
        <div className="nav-label">MENU</div>
        <nav>
          {navigation.map((item) => (
            <button
              className={page === item.label ? 'nav-item active' : 'nav-item'}
              key={item.label}
              onClick={() => { setPage(item.label); setSearch('') }}
            >
              <span className="nav-icon">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><span className="status-dot" /> Sistema local</div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Gestão Oliveira <span>/</span> {page}</div>
          <div className="user-chip"><span className="user-avatar">O</span><span>Operador</span></div>
        </header>

        <section className="page-content">
          {page === 'Início' && <Dashboard onNavigate={setPage} />}
          {page === 'Frente de caixa' && <PointOfSale />}
          {page === 'Produtos' && <Products search={search} setSearch={setSearch} />}
          {page === 'Vendas' && <Sales />}
          {page === 'Relatórios' && <Reports />}
          {page === 'Caixa' && <CashRegister />}
          <footer className="page-footer">Gestão Oliveira <span>•</span> Versão inicial de interface</footer>
        </section>
      </main>
    </div>
  )
}

function PageHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>
}

function Dashboard({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <>
    <PageHeading title="Visão geral" subtitle="Resumo da loja em um só lugar." action={<button className="button-primary" onClick={() => onNavigate('Frente de caixa')}>＋ Nova venda</button>} />
    <div className="stats-grid">
      <Stat label="Vendas de hoje" value="R$ 0,00" note="Nenhuma venda registrada" />
      <Stat label="Vendas realizadas" value="0" note="Ao longo do dia" />
      <Stat label="Produtos cadastrados" value="0" note="Estoque ainda não conectado" />
    </div>
    <div className="content-grid">
      <section className="panel">
        <div className="panel-heading"><h2>Atalhos</h2><span className="muted">Acesso rápido</span></div>
        <div className="shortcut-list">
          <button className="shortcut" onClick={() => onNavigate('Frente de caixa')}><span className="shortcut-icon">＋</span><span><strong>Iniciar venda</strong><small>Abrir a frente de caixa</small></span><span className="arrow">→</span></button>
          <button className="shortcut" onClick={() => onNavigate('Produtos')}><span className="shortcut-icon">▤</span><span><strong>Ver produtos</strong><small>Consultar o catálogo da loja</small></span><span className="arrow">→</span></button>
          <button className="shortcut" onClick={() => onNavigate('Caixa')}><span className="shortcut-icon">◷</span><span><strong>Conferir caixa</strong><small>Ver situação do caixa</small></span><span className="arrow">→</span></button>
        </div>
      </section>
      <section className="panel welcome-panel">
        <div className="welcome-symbol">O</div>
        <h2>Sua loja, mais organizada.</h2>
        <p>O sistema está sendo preparado. Nesta etapa, os dados ainda não são reais nem ficam salvos.</p>
        <span className="status-pill">Interface em desenvolvimento</span>
      </section>
    </div>
  </>
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="stat-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
}

function PointOfSale() {
  const [query, setQuery] = useState('')
  return <>
    <PageHeading title="Frente de caixa" subtitle="Encontre produtos e monte uma venda." />
    <div className="pos-layout">
      <section className="panel product-picker">
        <label className="field-label" htmlFor="product-search">Buscar produto</label>
        <input id="product-search" className="search-input" placeholder="Digite o nome do produto..." value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="empty-state"><span className="empty-icon">▤</span><strong>Nenhum produto disponível</strong><p>{query ? 'Não encontramos produtos com essa busca.' : 'Os produtos cadastrados aparecerão aqui.'}</p></div>
      </section>
      <section className="panel sale-panel">
        <div className="panel-heading"><h2>Venda atual</h2><span className="muted">0 itens</span></div>
        <div className="empty-cart"><span>＋</span><p>Adicione produtos para começar.</p></div>
        <div className="sale-total"><span>Total</span><strong>R$ 0,00</strong></div>
        <button className="button-primary full-width" disabled>Receber pagamento</button>
        <p className="helper-text">A finalização será ativada quando o estoque estiver conectado.</p>
      </section>
    </div>
  </>
}

function Products({ search, setSearch }: { search: string; setSearch: (value: string) => void }) {
  return <>
    <PageHeading title="Produtos" subtitle="Catálogo e controle de estoque." action={<button className="button-primary" disabled>＋ Novo produto</button>} />
    <section className="panel">
      <div className="toolbar"><input className="search-input" placeholder="Buscar produto..." value={search} onChange={(event) => setSearch(event.target.value)} /><span className="muted">0 produtos</span></div>
      <div className="table-wrap"><table><thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Status</th></tr></thead><tbody><tr><td colSpan={5}><div className="table-empty">Nenhum produto cadastrado ainda.</div></td></tr></tbody></table></div>
    </section>
  </>
}

function Sales() {
  return <>
    <PageHeading title="Vendas" subtitle="Consulte as vendas realizadas." />
    <section className="panel">
      <div className="toolbar"><input className="search-input" placeholder="Buscar venda..." /><button className="button-secondary" disabled>Filtrar período</button></div>
      <div className="table-wrap"><table><thead><tr><th>Venda</th><th>Data e hora</th><th>Pagamento</th><th>Total</th><th>Status</th></tr></thead><tbody><tr><td colSpan={5}><div className="table-empty">As vendas aparecerão aqui após serem registradas.</div></td></tr></tbody></table></div>
    </section>
  </>
}

function Reports() {
  return <>
    <PageHeading title="Relatórios" subtitle="Acompanhe os resultados da loja." />
    <div className="stats-grid report-stats"><Stat label="Faturamento" value={money(0)} note="Período selecionado" /><Stat label="Vendas" value="0" note="Total de vendas" /><Stat label="Lucro estimado" value={money(0)} note="Calculado após cadastro de custos" /></div>
    <section className="panel report-placeholder"><span className="empty-icon">▥</span><h2>Seus resultados aparecerão aqui</h2><p>Os relatórios serão preenchidos automaticamente quando as vendas começarem a ser registradas.</p></section>
  </>
}

function CashRegister() {
  return <>
    <PageHeading title="Caixa" subtitle="Abertura, acompanhamento e fechamento do caixa." />
    <section className="panel cash-panel">
      <div className="cash-status"><span className="status-dot closed" /><div><strong>Caixa fechado</strong><p>Abra o caixa para começar a registrar as movimentações.</p></div></div>
      <div className="cash-amount"><span>Saldo inicial</span><strong>R$ 0,00</strong></div>
      <button className="button-primary" disabled>Abrir caixa</button>
      <p className="helper-text">A abertura e o fechamento com senha serão implementados na etapa de funcionalidades.</p>
    </section>
  </>
}

export default App
