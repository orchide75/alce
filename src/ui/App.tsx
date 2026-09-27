import { useEffect, useState, type ReactNode } from 'react';
import { useRoute, href } from '../state/router';
import { dismissLoadError, useStore } from '../state/store';
import { Icon } from './components/Icon';
import { Alert, Toasts } from './components/ui';
import { BackupPill } from './pages/DataPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { ProductEditorPage } from './pages/ProductEditorPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { ComparePage } from './pages/ComparePage';
import { SettingsPage } from './pages/SettingsPage';
import { DataPage } from './pages/DataPage';

const NAV: { to: string; label: string; icon: string; match: (p: string[]) => boolean }[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', match: (p) => p.length === 0 },
  { to: '/produse', label: 'Produse', icon: 'products', match: (p) => p[0] === 'produse' && p[1] !== 'nou' },
  { to: '/produse/nou', label: 'Adaugă produs', icon: 'plus', match: (p) => p[0] === 'produse' && p[1] === 'nou' },
  { to: '/simulator', label: 'Simulator scenarii', icon: 'sim', match: (p) => p[0] === 'simulator' },
  { to: '/comparatie', label: 'Comparație produse', icon: 'compare', match: (p) => p[0] === 'comparatie' },
];
const NAV2: typeof NAV = [
  { to: '/setari', label: 'Setări companie', icon: 'settings', match: (p) => p[0] === 'setari' },
  { to: '/date', label: 'Date & backup', icon: 'database', match: (p) => p[0] === 'date' },
];

function page(path: string[]): { title: string; crumb?: string; node: ReactNode } {
  const [a, b, c] = path;
  if (!a) return { title: 'Dashboard', node: <DashboardPage /> };
  if (a === 'produse') {
    if (b === 'nou') return { title: 'Adaugă produs', crumb: 'Produse', node: <ProductEditorPage /> };
    if (b && c === 'editare') return { title: 'Editează produs', crumb: 'Produse', node: <ProductEditorPage productId={b} /> };
    if (b) return { title: 'Detalii produs', crumb: 'Produse', node: <ProductDetailPage productId={b} /> };
    return { title: 'Produse', node: <ProductsPage /> };
  }
  if (a === 'simulator') return { title: 'Simulator scenarii', node: <SimulatorPage /> };
  if (a === 'comparatie') return { title: 'Comparație produse', node: <ComparePage /> };
  if (a === 'setari') return { title: 'Setări companie', node: <SettingsPage /> };
  if (a === 'date') return { title: 'Date & backup', node: <DataPage /> };
  return { title: 'Pagină inexistentă', node: <div className="empty">Pagina nu există. <a href={href('/')}>Înapoi la Dashboard</a></div> };
}

export function App() {
  const route = useRoute();
  const { meta } = useStore();
  const [navOpen, setNavOpen] = useState(false);
  const p = page(route.path);

  useEffect(() => setNavOpen(false), [route]);
  useEffect(() => {
    document.title = `${p.title} · Calculator profit e-commerce`;
  }, [p.title]);

  const link = (n: (typeof NAV)[number]) => (
    <a key={n.to} href={href(n.to)} className={n.match(route.path) ? 'active' : ''}>
      <Icon name={n.icon} />
      {n.label}
    </a>
  );

  return (
    <div className="app">
      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">€</div>
          <div>
            <div className="brand-name">Calculator profit</div>
            <div className="brand-sub">E-commerce · sistem financiar</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map(link)}
          <div className="nav-section">Configurare</div>
          {NAV2.map(link)}
        </nav>
        <div className="sidebar-foot">
          <BackupPill />
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="btn icon ghost mobile-nav-toggle" aria-label="Meniu" onClick={() => setNavOpen((o) => !o)}>
            <Icon name="menu" />
          </button>
          <div className="title">
            {p.crumb && <div className="crumb">{p.crumb}</div>}
            <h1>{p.title}</h1>
          </div>
          {!(route.path[0] === 'produse' && route.path[1] === 'nou') && (
            <a className="btn primary" href={href('/produse/nou')}>
              <Icon name="plus" />
              <span className="hide-sm">Produs nou</span>
            </a>
          )}
        </header>
        <main className="content">
          {meta.loadError && (
            <div className="mb-16">
              <Alert level="error">
                {meta.loadError}{' '}
                <button className="link-btn" onClick={dismissLoadError}>
                  Închide
                </button>
              </Alert>
            </div>
          )}
          {!meta.available && (
            <div className="mb-16">
              <Alert level="warning">
                Stocarea locală nu este disponibilă în acest browser (mod privat sau blocată). Datele NU se salvează automat –
                folosește <a href={href('/date')}>Export JSON</a> înainte să închizi pagina.
              </Alert>
            </div>
          )}
          {p.node}
        </main>
      </div>
      <Toasts />
    </div>
  );
}
