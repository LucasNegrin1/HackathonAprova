import { 
  Hourglass, 
  Ban, 
  GitPullRequest, 
  Link2, 
  ShieldAlert, 
  ArrowUpRight 
} from 'lucide-react';
import type { Ticket } from '../../data/mockSupportData';
import './PendingIssuesSection.css';

interface PendingIssuesSectionProps {
  tickets: Ticket[];
  onSelectPendingCategory: (categoryKey: string) => void;
}

export const PendingIssuesSection: React.FC<PendingIssuesSectionProps> = ({
  tickets,
  onSelectPendingCategory
}) => {
  // Aggregate data for the 5 compact pending categories
  const waitingComplement = tickets.filter((t) => t.status === 'Aguardando Cliente');
  const blockedTickets = tickets.filter((t) => t.isBlocked);
  const productBacklog = tickets.filter((t) => t.isProductBacklog);
  const similarOrChild = tickets.filter((t) => t.isSimilarOrChild);
  const managerReview = tickets.filter((t) => t.needsManagerReview);

  return (
    <div id="pending-issues-section" className="pending-section-wrap">
      <div className="pending-section-header">
        <h3 className="pending-main-title">Pendências & Bloqueios Operacionais</h3>
        <span className="pending-main-subtitle">
          Categorias críticas que dependem de ações externas, de engenharia ou homologação do gestor
        </span>
      </div>

      <div className="pending-cards-grid">
        {/* 1. Aguardando Complemento */}
        <div 
          className="pending-mini-card"
          onClick={() => onSelectPendingCategory('waiting')}
        >
          <div className="pending-card-top">
            <div className="pending-icon-box waiting-box">
              <Hourglass size={15} />
            </div>
            <span className="pending-count font-mono">{waitingComplement.length}</span>
          </div>
          <span className="pending-card-label">Aguardando Complemento</span>
          <p className="pending-card-desc">Pausados aguardando resposta ou logs do cliente</p>
          <div className="pending-card-footer">
            <span className="pending-action-link">
              Ver chamados <ArrowUpRight size={12} />
            </span>
          </div>
        </div>

        {/* 2. Tickets Bloqueados */}
        <div 
          className="pending-mini-card blocked-card"
          onClick={() => onSelectPendingCategory('blocked')}
        >
          <div className="pending-card-top">
            <div className="pending-icon-box blocked-box">
              <Ban size={15} />
            </div>
            <span className="pending-count text-critical font-mono">{blockedTickets.length}</span>
          </div>
          <span className="pending-card-label text-critical">Tickets Bloqueados</span>
          <p className="pending-card-desc">Impedimento técnico ou dependência jurídica/órgão</p>
          <div className="pending-card-footer">
            <span className="pending-action-link">
              Intervir agora <ArrowUpRight size={12} />
            </span>
          </div>
        </div>

        {/* 3. Encaminhados ao Backlog de Produto */}
        <div 
          className="pending-mini-card"
          onClick={() => onSelectPendingCategory('backlog')}
        >
          <div className="pending-card-top">
            <div className="pending-icon-box backlog-box">
              <GitPullRequest size={15} />
            </div>
            <span className="pending-count font-mono">{productBacklog.length}</span>
          </div>
          <span className="pending-card-label">Backlog de Produto</span>
          <p className="pending-card-desc">Bugs confirmados e vinculados à Engenharia (Jira)</p>
          <div className="pending-card-footer">
            <span className="pending-action-link">
              Acompanhar sprint <ArrowUpRight size={12} />
            </span>
          </div>
        </div>

        {/* 4. Semelhantes ou Vinculados a Chamados-Pai */}
        <div 
          className="pending-mini-card"
          onClick={() => onSelectPendingCategory('similar')}
        >
          <div className="pending-card-top">
            <div className="pending-icon-box linked-box">
              <Link2 size={15} />
            </div>
            <span className="pending-count font-mono">{similarOrChild.length}</span>
          </div>
          <span className="pending-card-label">Vinculados a Pai</span>
          <p className="pending-card-desc">Incidentes massivos com resolução centralizada</p>
          <div className="pending-card-footer">
            <span className="pending-action-link">
              Ver agrupados <ArrowUpRight size={12} />
            </span>
          </div>
        </div>

        {/* 5. Exigem Revisão do Gestor */}
        <div 
          className="pending-mini-card review-card"
          onClick={() => onSelectPendingCategory('review')}
        >
          <div className="pending-card-top">
            <div className="pending-icon-box review-box">
              <ShieldAlert size={15} />
            </div>
            <span className="pending-count text-critical font-mono">{managerReview.length}</span>
          </div>
          <span className="pending-card-label text-critical font-semibold">Revisão do Gestor</span>
          <p className="pending-card-desc">Estouro de P1, solicitação de bypass ou permissão sensível</p>
          <div className="pending-card-footer">
            <span className="pending-action-link text-critical">
              Decisão necessária <ArrowUpRight size={12} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
