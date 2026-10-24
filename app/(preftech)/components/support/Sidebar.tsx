import { 
  LayoutDashboard, 
  AlertTriangle, 
  Users, 
  Clock, 
  HelpCircle,
  Settings,
  TrendingDown,
  X
} from 'lucide-react';
import './Sidebar.css';

const SLA_TARGET = 98;

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  criticalCount: number;
  totalTickets: number;
  slaCompliance: number;
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  criticalCount,
  totalTickets,
  slaCompliance,
  isOpen,
  onClose,
  onOpenSettings
}) => {
  const handleNavClick = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'team') {
      const el = document.getElementById('team-workload-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (tab === 'pending') {
      const el = document.getElementById('pending-issues-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div 
        className={`sidebar-backdrop ${isOpen ? 'active' : ''}`} 
        onClick={onClose} 
        aria-hidden="true"
      />

      <aside className={`support-sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        {/* Brand Header with Close Button for Mobile */}
        <div className="sidebar-brand-container">
          <div className="sidebar-brand-inner">
            <svg 
              viewBox="0 0 280 68" 
              className="preftech-official-logo"
              role="img" 
              aria-label="PREFtech - Suporte Sem Espera"
            >
              <defs>
                <linearGradient id="sidebar-light-logo-g" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#4F46E5"/>
                  <stop offset="1" stopColor="#1E1B4B"/>
                </linearGradient>
              </defs>
              <g transform="translate(2 2)">
                <path d="M12 6h40a8 8 0 0 1 8 8v28a8 8 0 0 1-8 8H28l-12 9v-9h-4a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8z" fill="url(#sidebar-light-logo-g)"/>
                <circle cx="32" cy="28" r="14" fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="3.5"/>
                <path d="M32 14a14 14 0 0 1 14 14" fill="none" stroke="#22D3A6" strokeWidth="3.5" strokeLinecap="round"/>
                <path d="M25.5 28.5l4.5 4.5 8.5-9" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
              </g>
              <text x="76" y="44" fontFamily="'Plus Jakarta Sans', Inter, sans-serif" fontSize="32" letterSpacing="-0.5">
                <tspan fontWeight="800" fill="#0F0D2E">PREF</tspan><tspan fontWeight="600" fill="#22D3A6">tech</tspan>
              </text>
              <text x="78" y="58" fontFamily="'Plus Jakarta Sans', Inter, sans-serif" fontSize="8.5" fontWeight="700" letterSpacing="2" fill="#4F46E5">SUPORTE SEM ESPERA</text>
            </svg>
          </div>

          <button 
            className="sidebar-close-btn" 
            onClick={onClose} 
            title="Fechar menu lateral"
            aria-label="Fechar menu lateral"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-section-title">PAINEL OPERACIONAL</div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => handleNavClick('overview')}
          >
            <div className="nav-icon-label">
              <LayoutDashboard size={17} />
              <span>Visão Geral</span>
            </div>
            <span className="nav-badge-count">{totalTickets}</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'attention' ? 'active' : ''}`}
            onClick={() => handleNavClick('attention')}
          >
            <div className="nav-icon-label">
              <AlertTriangle size={17} className={activeTab === 'attention' ? 'text-white' : 'text-critical'} />
              <span className="font-semibold">Atenção Imediata</span>
            </div>
            {criticalCount > 0 && (
              <span className="nav-badge-critical">{criticalCount}</span>
            )}
          </button>

          <button 
            className={`nav-item ${activeTab === 'team' ? 'active' : ''}`}
            onClick={() => handleNavClick('team')}
          >
            <div className="nav-icon-label">
              <Users size={17} />
              <span>Carga da Equipe</span>
            </div>
          </button>

          <button 
            className={`nav-item ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => handleNavClick('pending')}
          >
            <div className="nav-icon-label">
              <Clock size={17} />
              <span>Pendências & Bloqueios</span>
            </div>
          </button>
        </nav>

        <div className="sidebar-section-title">POLÍTICAS & SLA</div>

        <div className="sidebar-secondary-nav">
          <button 
            className="nav-item-secondary"
            onClick={onOpenSettings}
            title="Abrir configurações da Matriz de Prioridade e SLAs"
          >
            <Settings size={16} />
            <span>Matriz de Prioridade (P1–P4)</span>
          </button>
          <button 
            className="nav-item-secondary"
            onClick={onOpenSettings}
            title="Abrir configurações de plantão e equipe"
          >
            <HelpCircle size={16} />
            <span>Escala de Plantão N2/N3</span>
          </button>
        </div>

        {/* SLA Health Indicator Card at bottom */}
        {/* Visual da v0.2; o percentual vem do cálculo real de SLA (App.tsx). */}
        <div className={`sidebar-health-card ${slaCompliance < SLA_TARGET ? 'health-card-warning' : 'health-card-healthy'}`}>
          <div className="health-card-top">
            <span className="health-title">Cumprimento de SLA</span>
            <span className="health-val font-mono">{slaCompliance.toFixed(1)}%</span>
          </div>
          <div className="health-bar-bg">
            <div className="health-bar-fill" style={{ width: `${slaCompliance}%` }} />
          </div>
          <div className="health-detail">
            {slaCompliance < SLA_TARGET ? (
              <>
                <TrendingDown size={13} className="text-warning" />
                <span>Meta: {SLA_TARGET.toFixed(1)}% (Abaixo do target)</span>
              </>
            ) : (
              <span>Meta: {SLA_TARGET.toFixed(1)}% (Dentro do target)</span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
