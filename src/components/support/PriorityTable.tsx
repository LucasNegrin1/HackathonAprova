import { useState } from 'react';
import { 
  AlertCircle, 
  Flag, 
  Clock, 
  UserX, 
  CheckCircle2, 
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Building2,
  Calendar,
  Layers,
  GitPullRequest,
  Ban,
  Link2,
  AlertTriangle,
  UserCheck,
  Zap,
  Plus
} from 'lucide-react';
import type { Ticket, Priority } from '../../data/mockSupportData';
import './PriorityTable.css';

interface PriorityTableProps {
  tickets: Ticket[];
  totalFilteredCount: number;
  activeTab?: string;
  onClearTabFilter?: () => void;
  onLoadSampleData?: () => void;
  onOpenNewTicketModal?: () => void;
}

export const PriorityTable: React.FC<PriorityTableProps> = ({ 
  tickets,
  totalFilteredCount,
  activeTab = 'overview',
  onClearTabFilter,
  onLoadSampleData,
  onOpenNewTicketModal
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getPriorityBadge = (priority: Priority) => {
    switch (priority) {
      case 'P1':
        return (
          <span className="priority-flag-wrap p1-flag" title="Prioridade P1 - Crítico">
            <Flag size={14} fill="currentColor" />
            <span className="flag-label">P1</span>
          </span>
        );
      case 'P2':
        return (
          <span className="priority-flag-wrap p2-flag" title="Prioridade P2 - Alta">
            <Flag size={14} fill="currentColor" />
            <span className="flag-label">P2</span>
          </span>
        );
      case 'P3':
        return (
          <span className="priority-flag-wrap p3-flag" title="Prioridade P3 - Média">
            <Flag size={14} fill="currentColor" />
            <span className="flag-label">P3</span>
          </span>
        );
      case 'P4':
        return (
          <span className="priority-flag-wrap p4-flag" title="Prioridade P4 - Baixa">
            <Flag size={14} fill="currentColor" />
            <span className="flag-label">P4</span>
          </span>
        );
    }
  };

  const getSlaIndicator = (minutesRemaining: number) => {
    if (minutesRemaining < 0) {
      const delayMinutes = Math.abs(minutesRemaining);
      return (
        <span className="sla-tag sla-breached">
          <AlertCircle size={12} /> Vencido há {delayMinutes}m
        </span>
      );
    } else if (minutesRemaining <= 30) {
      return (
        <span className="sla-tag sla-at-risk">
          <Clock size={12} /> Vence em {minutesRemaining}m
        </span>
      );
    } else {
      const hours = Math.floor(minutesRemaining / 60);
      const mins = minutesRemaining % 60;
      return (
        <span className="sla-tag sla-ok">
          <CheckCircle2 size={12} /> {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}
        </span>
      );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Em Atendimento':
        return <span className="status-cell-badge status-progress">Em Atendimento</span>;
      case 'Aberto':
        return <span className="status-cell-badge status-open">Aberto (Fila)</span>;
      case 'Bloqueado':
        return <span className="status-cell-badge status-blocked">Bloqueado</span>;
      case 'Aguardando Cliente':
        return <span className="status-cell-badge status-waiting">Aguardando Cliente</span>;
      default:
        return <span className="status-cell-badge status-n3">Em Análise N3</span>;
    }
  };

  const formatLastUpdate = (hoursAgo: number, daysStagnant: number) => {
    if (daysStagnant >= 10) {
      return <span className="text-critical font-semibold">Parado há {daysStagnant} dias ⚠️</span>;
    }
    if (hoursAgo < 1) {
      return <span>há {Math.round(hoursAgo * 60)} min</span>;
    }
    return <span>há {Math.round(hoursAgo)}h</span>;
  };

  return (
    <div className="priority-table-section">
      {/* Table Section Header */}
      <div className="table-section-header">
        <div className="section-title-wrap">
          <div className="title-row">
            {activeTab === 'attention' ? (
              <>
                <AlertTriangle size={18} className="text-critical" />
                <h2 className="section-title text-critical">Fila Crítica • Atenção Imediata</h2>
                <span className="items-count-badge badge-critical font-mono">
                  {totalFilteredCount} crítico(s)
                </span>
                {onClearTabFilter && (
                  <button 
                    onClick={onClearTabFilter}
                    style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'underline', marginLeft: '8px', cursor: 'pointer' }}
                  >
                    (Voltar para Visão Geral)
                  </button>
                )}
              </>
            ) : (
              <>
                <ShieldAlert size={18} className="text-brand" />
                <h2 className="section-title">Fila Operacional de Chamados</h2>
                <span className="items-count-badge font-mono">{totalFilteredCount} tickets</span>
              </>
            )}
          </div>
          <p className="section-subtitle">
            {activeTab === 'attention'
              ? 'Exibindo apenas chamados P1, SLAs em risco iminente (< 30 min), estagnados (> 10 dias) ou sem responsável atribuído.'
              : 'Clique no chamado para expandir diagnósticos técnicos, histórico e ações operacionais.'}
          </p>
        </div>

        <div className="table-quick-legend">
          <span className="legend-item"><span className="legend-color red" /> Crítico</span>
          <span className="legend-item"><span className="legend-color orange" /> Em Risco</span>
          <span className="legend-item"><span className="legend-color purple" /> Parado &gt; 10d</span>
        </div>
      </div>

      {/* Responsive Table Grid Container */}
      <div className="table-responsive-container">
        <div className="ops-table-grid">
          {/* Aligned Table Header */}
          <div className="ops-table-header">
            <div className="grid-th col-number">Número</div>
            <div className="grid-th col-prio">Prioridade</div>
            <div className="grid-th col-ticket-account">Chamado & Conta (Prefeitura)</div>
            <div className="grid-th col-status">Status</div>
            <div className="grid-th col-assignee">Responsável</div>
            <div className="grid-th col-sla">Prazo SLA</div>
            <div className="grid-th col-expand-action text-right">Detalhes</div>
          </div>

          {/* Table Body Rows */}
          <div className="ops-table-body">
            {tickets.length > 0 ? (
              tickets.map((ticket) => {
                const isExpanded = expandedId === ticket.id;
                const isCriticallyUrgent = ticket.priority === 'P1' || ticket.slaMinutesRemaining < 0;
                const isUnassigned = ticket.assignee.isUnassigned;

                return (
                  <div key={ticket.id} className="ops-row-wrapper">
                    {/* Primary Row perfectly aligned with the header grid */}
                    <div 
                      className={`ops-table-row ${isCriticallyUrgent ? 'row-critical-highlight' : ''} ${isExpanded ? 'row-active-expanded' : ''}`}
                      onClick={() => toggleExpand(ticket.id)}
                      role="button"
                      tabIndex={0}
                      title="Clique para ver ou ocultar detalhes deste chamado"
                    >
                      {/* 1. Número */}
                      <div className="grid-td col-number">
                        <span className="ticket-number-link font-mono">{ticket.number}</span>
                      </div>

                      {/* 2. Prioridade */}
                      <div className="grid-td col-prio">
                        {getPriorityBadge(ticket.priority)}
                      </div>

                      {/* 3. Descrição do Problema & Conta (Prefeitura) */}
                      <div className="grid-td col-ticket-account">
                        <div className="ticket-title-row">
                          <span className="ticket-title-bold" title={ticket.title}>
                            {ticket.title}
                          </span>
                        </div>
                        <div className="ticket-account-subrow">
                          <span className="account-tag" title={ticket.account}>
                            <Building2 size={12} className="account-icon" />
                            <span className="account-name">{ticket.account}</span>
                          </span>
                        </div>
                      </div>

                      {/* 5. Status */}
                      <div className="grid-td col-status">
                        {getStatusBadge(ticket.status)}
                      </div>

                      {/* 6. Responsável */}
                      <div className="grid-td col-assignee">
                        {isUnassigned ? (
                          <span className="unassigned-badge">
                            <UserX size={12} /> Sem Responsável
                          </span>
                        ) : (
                          <div className="assignee-cell" title={ticket.assignee.name}>
                            <span className="assignee-avatar-circle font-mono">
                              {ticket.assignee.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                            </span>
                            <span className="assignee-name">{ticket.assignee.name}</span>
                          </div>
                        )}
                      </div>

                      {/* 7. Prazo SLA */}
                      <div className="grid-td col-sla font-mono">
                        {getSlaIndicator(ticket.slaMinutesRemaining)}
                      </div>

                      {/* 8. Botão Expandir / Recolher */}
                      <div className="grid-td col-expand-action text-right">
                        <button 
                          className={`btn-expand-chevron ${isExpanded ? 'active' : ''}`}
                          aria-label={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details Panel */}
                    {isExpanded && (
                      <div className="ticket-expanded-panel animate-fade-in">
                        {/* Top Meta Grid */}
                        <div className="expanded-meta-grid">
                          <div className="meta-block">
                            <span className="meta-block-label">
                              <Building2 size={13} /> Órgão / Conta
                            </span>
                            <span className="meta-block-val text-brand-dark font-semibold">
                              {ticket.account}
                            </span>
                          </div>

                          <div className="meta-block">
                            <span className="meta-block-label">
                              <Layers size={13} /> Categoria Técnica
                            </span>
                            <span className="meta-block-val">
                              {ticket.category}
                            </span>
                          </div>

                          <div className="meta-block">
                            <span className="meta-block-label">
                              <Calendar size={13} /> Data de Criação
                            </span>
                            <span className="meta-block-val font-mono">
                              {ticket.createdAt}
                            </span>
                          </div>

                          <div className="meta-block">
                            <span className="meta-block-label">
                              <Clock size={13} /> Última Atualização
                            </span>
                            <span className="meta-block-val font-mono">
                              {formatLastUpdate(ticket.lastUpdateHoursAgo, ticket.daysStagnant)}
                            </span>
                          </div>
                        </div>

                        {/* First Action / Technical Diagnostic Box */}
                        <div className="diagnostic-box">
                          <span className="diagnostic-label">Primeira Ação Resumida / Diagnóstico Inicial:</span>
                          <p className="diagnostic-text">{ticket.firstAction}</p>
                        </div>

                        {/* Special Alerts Conditionals */}
                        {ticket.needsManagerReview && (
                          <div className="alert-card alert-review">
                            <AlertTriangle size={16} className="text-critical" />
                            <div>
                              <span className="alert-title text-critical">Revisão do Gestor Necessária</span>
                              <p className="alert-desc">{ticket.managerReviewReason}</p>
                            </div>
                          </div>
                        )}

                        {ticket.isBlocked && (
                          <div className="alert-card alert-blocked">
                            <Ban size={16} className="text-critical" />
                            <div>
                              <span className="alert-title text-critical">Chamado Bloqueado</span>
                              <p className="alert-desc">{ticket.blockReason}</p>
                            </div>
                          </div>
                        )}

                        {ticket.isProductBacklog && (
                          <div className="alert-card alert-backlog">
                            <GitPullRequest size={16} className="text-emerald" />
                            <div>
                              <span className="alert-title text-emerald">Vinculado ao Backlog da Engenharia</span>
                              <p className="alert-desc">Issue Jira: <strong className="font-mono">{ticket.backlogIssueKey}</strong></p>
                            </div>
                          </div>
                        )}

                        {ticket.isSimilarOrChild && (
                          <div className="alert-card alert-linked">
                            <Link2 size={16} className="text-purple" />
                            <div>
                              <span className="alert-title text-purple">Incidente Vinculado a Chamado-Pai</span>
                              <p className="alert-desc">Incidente Raiz: <strong className="font-mono">{ticket.parentTicketNumber}</strong></p>
                            </div>
                          </div>
                        )}

                        {/* Quick Manager Actions Bar */}
                        <div className="expanded-actions-bar">
                          <span className="actions-hint">Ações operacionais rápidas:</span>
                          <div className="actions-buttons-group">
                            <button 
                              className="btn-action-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                alert(`Ação: Reatribuir chamado ${ticket.number}`);
                              }}
                            >
                              <UserCheck size={13} /> Atribuir / Trocar Analista
                            </button>
                            <button 
                              className="btn-action-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                alert(`Ação: Escalar SLA do chamado ${ticket.number}`);
                              }}
                            >
                              <AlertTriangle size={13} /> Escalar Incidente
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="empty-results-cell" style={{ padding: '36px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
                  {activeTab === 'attention' 
                    ? '🎉 Nenhum chamado crítico requer Atenção Imediata no momento! Todos os SLAs estão sob controle.'
                    : 'Nenhum chamado encontrado na fila de atendimento.'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {onLoadSampleData && (
                    <button 
                      onClick={onLoadSampleData}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: 'var(--brand-primary)', color: '#fff', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      <Zap size={15} /> Carregar Chamados de Teste
                    </button>
                  )}
                  {onOpenNewTicketModal && (
                    <button 
                      onClick={onOpenNewTicketModal}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      <Plus size={15} /> Registrar Novo Chamado
                    </button>
                  )}
                  {activeTab === 'attention' && onClearTabFilter && (
                    <button 
                      onClick={onClearTabFilter}
                      style={{ padding: '8px 14px', color: 'var(--brand-primary)', fontSize: '13px', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      Ver Visão Geral completa
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
