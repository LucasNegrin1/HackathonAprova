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
        className={`metric-compact-card card-p1 ${metrics.p1Active > 0 ? 'has-active-alert' : 'is-zero'} ${activeFilter === 'p1' ? 'active-filter-ring' : ''}`}
        onClick={() => onFilterClick('p1')}
        title="Clique para filtrar a tabela apenas por chamados P1"
      >
        <div className="card-top-indicator">
          <div className="metric-icon-box p1-icon">
            <Flame size={15} />
          </div>
          <span className="metric-urgency-tag p1-tag">
            {metrics.p1Active > 0 ? 'CRÍTICO' : 'P1'}
          </span>
        </div>
        <div className="metric-content">
          <span className="metric-number font-mono">{metrics.p1Active}</span>
          <span className="metric-title">P1 Ativos</span>
          <div className="metric-subdetail">
            {metrics.p1Active > 0 ? (
              <span className="text-critical font-medium">Requer atenção imediata</span>
            ) : (
              <span className="text-muted">Nenhum P1 ativo</span>
            )}
          </div>
        </div>
      </div>

      {/* 2. SLAs Vencidos */}
      <div 
        className={`metric-compact-card card-breached ${metrics.slaBreached > 0 ? 'has-active-alert' : 'is-zero'} ${activeFilter === 'breached' ? 'active-filter-ring' : ''}`}
        onClick={() => onFilterClick('breached')}
        title="Clique para filtrar por tickets com SLA estourado"
      >
        <div className="card-top-indicator">
          <div className="metric-icon-box breached-icon">
            <AlertOctagon size={15} />
          </div>
          <span className="metric-urgency-tag breached-tag">
            {metrics.slaBreached > 0 ? 'ESTOURADO' : 'SLA'}
          </span>
        </div>
        <div className="metric-content">
          <span className="metric-number font-mono">{metrics.slaBreached}</span>
          <span className="metric-title">SLAs Vencidos</span>
          <div className="metric-subdetail">
            {metrics.slaBreached > 0 ? (
              <span className="text-critical font-medium">{metrics.slaBreached} estourado(s)</span>
            ) : (
              <span className="text-muted">Nenhum SLA vencido</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. SLAs em Risco */}
      <div 
        className={`metric-compact-card card-risk ${metrics.slaAtRisk > 0 ? 'has-active-alert' : 'is-zero'} ${activeFilter === 'risk' ? 'active-filter-ring' : ''}`}
        onClick={() => onFilterClick('risk')}
        title="Clique para filtrar por SLAs vencendo em menos de 30 min"
      >
        <div className="card-top-indicator">
          <div className="metric-icon-box risk-icon">
            <Clock size={15} />
          </div>
          <span className="metric-urgency-tag risk-tag">
            {metrics.slaAtRisk > 0 ? 'EM RISCO' : '< 30 MIN'}
          </span>
        </div>
        <div className="metric-content">
          <span className="metric-number font-mono">{metrics.slaAtRisk}</span>
          <span className="metric-title">SLAs em Risco</span>
          <div className="metric-subdetail">
            {metrics.slaAtRisk > 0 ? (
              <span className="text-warning font-medium">Vencem em &lt; 30 min</span>
            ) : (
              <span className="text-muted">Nenhum em risco iminente</span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Parados há > 10 dias */}
      <div 
        className={`metric-compact-card card-stagnant ${metrics.stagnant10d > 0 ? 'has-active-alert' : 'is-zero'} ${activeFilter === 'stagnant' ? 'active-filter-ring' : ''}`}
        onClick={() => onFilterClick('stagnant')}
        title="Clique para filtrar tickets estagnados há mais de 10 dias"
      >
        <div className="card-top-indicator">
          <div className="metric-icon-box stagnant-icon">
            <AlertTriangle size={15} />
          </div>
          <span className="metric-urgency-tag stagnant-tag">
            {metrics.stagnant10d > 0 ? '> 10 DIAS' : 'ESTAGNADOS'}
          </span>
        </div>
        <div className="metric-content">
          <span className="metric-number font-mono">{metrics.stagnant10d}</span>
          <span className="metric-title">Parados &gt; 10d</span>
          <div className="metric-subdetail">
            {metrics.stagnant10d > 0 ? (
              <span className="text-muted font-medium">{metrics.stagnant10d} sem movimentação</span>
            ) : (
              <span className="text-muted">Nenhum chamado estagnado</span>
            )}
          </div>
        </div>
      </div>

      {/* 5. Sem Responsável */}
      <div 
        className={`metric-compact-card card-unassigned ${metrics.unassigned > 0 ? 'has-active-alert' : 'is-zero'} ${activeFilter === 'unassigned' ? 'active-filter-ring' : ''}`}
        onClick={() => onFilterClick('unassigned')}
        title="Clique para filtrar chamados sem analista atribuído"
      >
        <div className="card-top-indicator">
          <div className="metric-icon-box unassigned-icon">
            <UserX size={15} />
          </div>
          <span className="metric-urgency-tag unassigned-tag">
            {metrics.unassigned > 0 ? 'TRIAGEM' : 'FILA'}
          </span>
        </div>
        <div className="metric-content">
          <span className="metric-number font-mono">{metrics.unassigned}</span>
          <span className="metric-title">Sem Responsável</span>
          <div className="metric-subdetail">
            {metrics.unassigned > 0 ? (
              <span className="text-warning font-medium">{metrics.unassigned} na fila geral</span>
            ) : (
              <span className="text-muted">Todos atribuídos</span>
            )}
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
            <Hourglass size={15} />
          </div>
          <span className="metric-urgency-tag waiting-tag">CLIENTE</span>
        </div>
        <div className="metric-content">
          <span className="metric-number font-mono">{metrics.waitingClient}</span>
          <span className="metric-title">Aguardando Compl.</span>
          <div className="metric-subdetail">
            {metrics.waitingClient > 0 ? (
              <span className="text-muted">{metrics.waitingClient} pausado(s)</span>
            ) : (
              <span className="text-muted">Nenhum pendente</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
