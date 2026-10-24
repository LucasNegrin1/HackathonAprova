import { 
  Flame, 
  AlertOctagon, 
  Clock, 
  AlertTriangle, 
  UserX, 
  Hourglass
} from 'lucide-react';
import './MetricsTopCards.css';

interface MetricsData {
  p1Active: number;
  slaBreached: number;
  slaAtRisk: number;
  stagnant10d: number;
  unassigned: number;
  waitingClient: number;
}

interface MetricsTopCardsProps {
  metrics: MetricsData;
  activeFilter: string | null;
  onFilterClick: (filterKey: string) => void;
}

export const MetricsTopCards: React.FC<MetricsTopCardsProps> = ({ 
  metrics,
  activeFilter,
  onFilterClick
}) => {
  return (
    <section className="metrics-top-container">
      {/* 1. P1 Ativos */}
      <div 
        className={`metric-compact-card card-p1 ${activeFilter === 'p1' ? 'active-filter-ring' : ''}`}
        onClick={() => onFilterClick('p1')}
        title="Clique para filtrar a tabela apenas por chamados P1"
      >
        <div className="card-top-indicator">
          <div className="metric-icon-box p1-icon">
            <Flame size={16} />
          </div>
          <span className="metric-urgency-tag p1-tag">CRÍTICO</span>
        </div>
        <div className="metric-content">
          <span className="metric-number font-mono">{metrics.p1Active}</span>
          <span className="metric-title">P1 Ativos</span>
          <div className="metric-subdetail">
            <span className="subdetail-dot red-dot pulse-critical" />
            <span>2 com SLA vencido</span>
          </div>
        </div>
      </div>

      {/* 2. SLAs Vencidos */}
      <div 
        className={`metric-compact-card card-breached ${activeFilter === 'breached' ? 'active-filter-ring' : ''}`}
        onClick={() => onFilterClick('breached')}
        title="Clique para filtrar por tickets com SLA estourado"
      >
        <div className="card-top-indicator">
          <div className="metric-icon-box breached-icon">
            <AlertOctagon size={16} />
          </div>
          <span className="metric-urgency-tag breached-tag">ESTOURADO</span>
        </div>
        <div className="metric-content">
          <span className="metric-number font-mono">{metrics.slaBreached}</span>
          <span className="metric-title">SLAs Vencidos</span>
          <div className="metric-subdetail text-critical">
            <span>Maior atraso: 48 min</span>
          </div>
        </div>
      </div>

      {/* 3. SLAs em Risco */}
      <div 
        className={`metric-compact-card card-risk ${activeFilter === 'risk' ? 'active-filter-ring' : ''}`}
        onClick={() => onFilterClick('risk')}
        title="Clique para filtrar por SLAs vencendo em menos de 30 min"
      >
        <div className="card-top-indicator">
          <div className="metric-icon-box risk-icon">
            <Clock size={16} />
          </div>
          <span className="metric-urgency-tag risk-tag">EM RISCO</span>
        </div>
        <div className="metric-content">
          <span className="metric-number font-mono">{metrics.slaAtRisk}</span>
          <span className="metric-title">SLAs em Risco</span>
          <div className="metric-subdetail text-warning">
            <span>Vencem em &lt; 30 min</span>
          </div>
        </div>
      </div>

      {/* 4. Parados há > 10 dias */}
      <div 
        className={`metric-compact-card card-stagnant ${activeFilter === 'stagnant' ? 'active-filter-ring' : ''}`}
        onClick={() => onFilterClick('stagnant')}
        title="Clique para filtrar tickets estagnados há mais de 10 dias"
      >
        <div className="card-top-indicator">
          <div className="metric-icon-box stagnant-icon">
            <AlertTriangle size={16} />
          </div>
          <span className="metric-urgency-tag stagnant-tag">&gt; 10 DIAS</span>
        </div>
        <div className="metric-content">
          <span className="metric-number font-mono">{metrics.stagnant10d}</span>
          <span className="metric-title">Parados &gt; 10d</span>
          <div className="metric-subdetail text-muted">
            <span>Média de 12 dias</span>
          </div>
        </div>
      </div>

      {/* 5. Sem Responsável */}
      <div 
        className={`metric-compact-card card-unassigned ${activeFilter === 'unassigned' ? 'active-filter-ring' : ''}`}
        onClick={() => onFilterClick('unassigned')}
        title="Clique para filtrar chamados sem analista atribuído"
      >
        <div className="card-top-indicator">
          <div className="metric-icon-box unassigned-icon">
            <UserX size={16} />
          </div>
          <span className="metric-urgency-tag unassigned-tag">TRIAGEM</span>
        </div>
        <div className="metric-content">
          <span className="metric-number font-mono">{metrics.unassigned}</span>
          <span className="metric-title">Sem Responsável</span>
          <div className="metric-subdetail text-warning">
            <span>1 P1 na fila geral</span>
          </div>
        </div>
      </div>

      {/* 6. Aguardando Complemento */}
      <div 
        className={`metric-compact-card card-waiting ${activeFilter === 'waiting' ? 'active-filter-ring' : ''}`}
        onClick={() => onFilterClick('waiting')}
        title="Clique para filtrar tickets com cliente"
      >
        <div className="card-top-indicator">
          <div className="metric-icon-box waiting-icon">
            <Hourglass size={16} />
          </div>
          <span className="metric-urgency-tag waiting-tag">CLIENTE</span>
        </div>
        <div className="metric-content">
          <span className="metric-number font-mono">{metrics.waitingClient}</span>
          <span className="metric-title">Aguardando Compl.</span>
          <div className="metric-subdetail text-muted">
            <span>Pausados no cliente</span>
          </div>
        </div>
      </div>
    </section>
  );
};
