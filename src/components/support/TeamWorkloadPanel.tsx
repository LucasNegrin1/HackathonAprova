import { Users, UserX } from 'lucide-react';
import type { TeamMember } from '../../data/mockSupportData';
import './TeamWorkloadPanel.css';

interface TeamWorkloadPanelProps {
  members: TeamMember[];
  unassignedCount: number;
  onFilterAssignee: (name: string) => void;
}

export const TeamWorkloadPanel: React.FC<TeamWorkloadPanelProps> = ({
  members,
  unassignedCount,
  onFilterAssignee
}) => {
  return (
    <div className="team-workload-section">
      <div className="team-section-header">
        <div className="title-row">
          <Users size={17} className="text-brand" />
          <h3 className="team-section-title">Carga da Equipe & Capacidade</h3>
        </div>
        <span className="team-section-subtitle">
          Destaca sobrecarga (&gt; 8 chamados), P1s sob responsabilidade e fila geral
        </span>
      </div>

      <div className="team-cards-grid">
        {/* Unassigned Queue Special Card */}
        <div 
          className="team-member-card card-unassigned-queue"
          onClick={() => onFilterAssignee('unassigned')}
          title="Filtrar chamados sem responsável"
        >
          <div className="member-card-header">
            <div className="unassigned-avatar-wrap">
              <UserX size={18} />
            </div>
            <div className="member-info">
              <span className="member-name text-warning">Fila Geral (Sem Dono)</span>
              <span className="member-role">Requer triagem imediata</span>
            </div>
          </div>
          <div className="member-metrics-row">
            <div className="metric-col">
              <span className="metric-col-val text-warning font-mono">{unassignedCount}</span>
              <span className="metric-col-lbl">Pendentes</span>
            </div>
            <div className="metric-col">
              <span className="metric-col-val text-critical font-mono">1</span>
              <span className="metric-col-lbl">P1 Crítico</span>
            </div>
            <div className="metric-col">
              <span className="metric-col-val text-warning font-mono">2</span>
              <span className="metric-col-lbl">SLA Risco</span>
            </div>
          </div>
        </div>

        {/* Analysts cards */}
        {members.map((member) => {
          const isOverloaded = member.activeTickets > member.capacityLimit;
          const hasBreached = member.breachedSlaTickets > 0;
          const hasP1 = member.p1Tickets > 0;

          return (
            <div 
              key={member.id} 
              className={`team-member-card ${isOverloaded ? 'member-overloaded' : ''}`}
              onClick={() => onFilterAssignee(member.name)}
              title={`Clique para filtrar chamados de ${member.name}`}
            >
              <div className="member-card-header">
                <div className="member-avatar-box">
                  <span className="member-initials font-mono">
                    {member.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                  </span>
                  <span className={`status-indicator-dot ${member.status}`} />
                </div>
                <div className="member-info">
                  <span className="member-name">{member.name}</span>
                  <span className="member-role">{member.role}</span>
                </div>
                {isOverloaded && (
                  <span className="overload-badge" title="Capacidade máxima excedida">
                    Sobrecarga
                  </span>
                )}
              </div>

              <div className="member-metrics-row">
                <div className="metric-col">
                  <span className={`metric-col-val font-mono ${isOverloaded ? 'text-critical' : ''}`}>
                    {member.activeTickets}
                  </span>
                  <span className="metric-col-lbl">Ativos</span>
                </div>

                <div className="metric-col">
                  <span className={`metric-col-val font-mono ${hasP1 ? 'text-critical' : 'text-dim'}`}>
                    {member.p1Tickets}
                  </span>
                  <span className="metric-col-lbl">P1s</span>
                </div>

                <div className="metric-col">
                  <span className={`metric-col-val font-mono ${hasBreached ? 'text-critical' : 'text-dim'}`}>
                    {member.breachedSlaTickets}
                  </span>
                  <span className="metric-col-lbl">SLAs Venc.</span>
                </div>

                <div className="metric-col">
                  <span className={`metric-col-val font-mono ${member.stagnantTickets > 0 ? 'text-warning' : 'text-dim'}`}>
                    {member.stagnantTickets}
                  </span>
                  <span className="metric-col-lbl">&gt; 10d</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
