import { Search, RefreshCw, Calendar, Building2, UserCircle, Menu } from 'lucide-react';
import { MOCK_ACCOUNTS, MOCK_TEAM_MEMBERS } from '../../data/mockSupportData';
import './SupportHeader.css';

interface SupportHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  selectedAccount: string;
  setSelectedAccount: (account: string) => void;
  selectedAssignee: string;
  setSelectedAssignee: (assignee: string) => void;
  lastUpdated: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  onToggleMobileMenu: () => void;
}

export const SupportHeader: React.FC<SupportHeaderProps> = ({
  searchQuery,
  setSearchQuery,
  selectedPeriod,
  setSelectedPeriod,
  selectedAccount,
  setSelectedAccount,
  selectedAssignee,
  setSelectedAssignee,
  lastUpdated,
  onRefresh,
  isRefreshing,
  onToggleMobileMenu
}) => {
  return (
    <header className="support-header">
      {/* Top Title & Operational Status Row */}
      <div className="header-top-row">
        <div className="header-left-group">
          {/* Mobile Hamburger Menu Button */}
          <button 
            className="mobile-menu-trigger-btn"
            onClick={onToggleMobileMenu}
            title="Abrir menu de navegação"
            aria-label="Abrir menu de navegação"
          >
            <Menu size={20} />
          </button>

          <div className="header-title-block">
            <div className="title-with-pill">
              <h1 className="header-title">Visão geral do suporte</h1>
              <span className="live-sync-badge">
                <span className="live-dot" /> AO VIVO
              </span>
            </div>
            <p className="header-subtitle">
              Painel Gerencial de Operações • Identificação e triagem imediata de gargalos e prioridades operacionais
            </p>
          </div>
        </div>

        <div className="header-refresh-info">
          <div className="sync-timestamp">
            <span className="sync-label">Última atualização:</span>
            <span className="sync-time font-mono">{lastUpdated}</span>
          </div>
          <button 
            className="btn-refresh" 
            onClick={onRefresh}
            title="Atualizar dados operacionais agora"
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Global Search and Visible Filters Bar (Sem exigir cliques/menus escondidos) */}
      <div className="header-controls-bar">
        {/* Global Search Input */}
        <div className="global-search-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="global-search-input"
            placeholder="Buscar por número (#TK-...), conta, analista, assunto ou categoria..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>

        {/* Visible Filters Group */}
        <div className="visible-filters-group">
          {/* Period Filter */}
          <div className="filter-item">
            <div className="filter-label">
              <Calendar size={13} />
              <span>Período:</span>
            </div>
            <select
              className="filter-select"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              <option value="hoje">Hoje (Tempo Real)</option>
              <option value="24h">Últimas 24 horas</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="mes">Mês Vigente (Outubro)</option>
            </select>
          </div>

          {/* Account Filter */}
          <div className="filter-item">
            <div className="filter-label">
              <Building2 size={13} />
              <span>Conta:</span>
            </div>
            <select
              className="filter-select"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
            >
              {MOCK_ACCOUNTS.map((acc) => (
                <option key={acc} value={acc}>{acc}</option>
              ))}
            </select>
          </div>

          {/* Assignee Filter */}
          <div className="filter-item">
            <div className="filter-label">
              <UserCircle size={13} />
              <span>Responsável:</span>
            </div>
            <select
              className="filter-select"
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
            >
              <option value="todos">Todos os analistas</option>
              <option value="unassigned">⚠️ Apenas Sem Responsável</option>
              {MOCK_TEAM_MEMBERS.map((member) => (
                <option key={member.id} value={member.name}>{member.name}</option>
              ))}
            </select>
          </div>

          {(selectedAccount !== 'Todas as contas' || selectedAssignee !== 'todos' || searchQuery) && (
            <button
              className="btn-reset-filters"
              onClick={() => {
                setSelectedAccount('Todas as contas');
                setSelectedAssignee('todos');
                setSearchQuery('');
              }}
              title="Restaurar filtros padrão"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
