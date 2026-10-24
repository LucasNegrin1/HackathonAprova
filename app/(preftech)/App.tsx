'use client';

import { useState, useMemo, useEffect } from 'react';
import { Sidebar } from './components/support/Sidebar';
import { MetricsTopCards } from './components/support/MetricsTopCards';
import { PriorityTable } from './components/support/PriorityTable';
import { TeamWorkloadPanel } from './components/support/TeamWorkloadPanel';
import { PendingIssuesSection } from './components/support/PendingIssuesSection';
import {
  MOCK_TICKETS,
  MOCK_TEAM_MEMBERS,
  type TeamMember,
  type Ticket
} from './data/mockSupportData';
import { Filter, Menu } from 'lucide-react';
import './index.css';
import './App.css';

export default function App() {
  // Dados reais do Supabase (/api/gestao). Se a API falhar, volta para os dados de exemplo e avisa.
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [origemDados, setOrigemDados] = useState<'carregando' | 'supabase' | 'exemplo'>('carregando');

  useEffect(() => {
    const carregar = async () => {
      try {
        const r = await fetch('/api/gestao', { cache: 'no-store' });
        if (!r.ok) throw new Error(String(r.status));
        const dados = (await r.json()) as { tickets: Ticket[]; members: TeamMember[] };
        setTickets(dados.tickets);
        setMembers(dados.members);
        setOrigemDados('supabase');
      } catch {
        setTickets(MOCK_TICKETS);
        setMembers(MOCK_TEAM_MEMBERS);
        setOrigemDados('exemplo');
      }
    };
    carregar();
    const intervalo = setInterval(carregar, 30_000);
    return () => clearInterval(intervalo);
  }, []);
  const [activeTab, setActiveTab] = useState('overview');
  const [cardFilter, setCardFilter] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Metrics Data Calculation
  const metrics = useMemo(() => {
    return {
      p1Active: tickets.filter((t) => t.priority === 'P1').length,
      slaBreached: tickets.filter((t) => t.slaMinutesRemaining < 0).length,
      slaAtRisk: tickets.filter((t) => t.slaMinutesRemaining >= 0 && t.slaMinutesRemaining <= 30).length,
      stagnant10d: tickets.filter((t) => t.daysStagnant >= 10).length,
      unassigned: tickets.filter((t) => t.assignee.isUnassigned).length,
      waitingClient: tickets.filter((t) => t.status === 'Aguardando Cliente').length
    };
  }, [tickets]);

  // Card Filter Handler (toggle or set)
  const handleCardFilterClick = (filterKey: string) => {
    setCardFilter((prev) => (prev === filterKey ? null : filterKey));
  };

  // Managerial Ranking and Filtering
  const filteredAndSortedTickets = useMemo(() => {
    let result = [...tickets];

    // Card Specific Filter
    if (cardFilter) {
      switch (cardFilter) {
        case 'p1':
          result = result.filter((t) => t.priority === 'P1');
          break;
        case 'breached':
          result = result.filter((t) => t.slaMinutesRemaining < 0);
          break;
        case 'risk':
          result = result.filter((t) => t.slaMinutesRemaining >= 0 && t.slaMinutesRemaining <= 30);
          break;
        case 'stagnant':
          result = result.filter((t) => t.daysStagnant >= 10);
          break;
        case 'unassigned':
          result = result.filter((t) => t.assignee.isUnassigned);
          break;
        case 'waiting':
          result = result.filter((t) => t.status === 'Aguardando Cliente');
          break;
        case 'blocked':
          result = result.filter((t) => t.isBlocked);
          break;
        case 'backlog':
          result = result.filter((t) => t.isProductBacklog);
          break;
        case 'similar':
          result = result.filter((t) => t.isSimilarOrChild);
          break;
        case 'review':
          result = result.filter((t) => t.needsManagerReview);
          break;
        default:
          result = result.filter((t) => t.assignee.name === cardFilter);
          break;
      }
    }

    // Sidebar Tab Filter
    if (activeTab === 'attention') {
      result = result.filter(
        (t) => t.priority === 'P1' || t.slaMinutesRemaining <= 30 || t.daysStagnant >= 10 || t.assignee.isUnassigned
      );
    }

    // Crucial: Managerial Urgency Sorting
    return result.sort((a, b) => {
      // 1. P1 com SLA vencido sempre no topo absoluto
      const aIsP1Breached = a.priority === 'P1' && a.slaMinutesRemaining < 0;
      const bIsP1Breached = b.priority === 'P1' && b.slaMinutesRemaining < 0;
      if (aIsP1Breached && !bIsP1Breached) return -1;
      if (!aIsP1Breached && bIsP1Breached) return 1;

      // 2. Qualquer SLA vencido (ordem do maior atraso para o menor)
      const aBreached = a.slaMinutesRemaining < 0;
      const bBreached = b.slaMinutesRemaining < 0;
      if (aBreached && bBreached) {
        return a.slaMinutesRemaining - b.slaMinutesRemaining;
      }
      if (aBreached && !bBreached) return -1;
      if (!aBreached && bBreached) return 1;

      // 3. P1 não vencido antes de P2/P3/P4
      if (a.priority === 'P1' && b.priority !== 'P1') return -1;
      if (a.priority !== 'P1' && b.priority === 'P1') return 1;

      // 4. SLAs em risco iminente (<= 30 min)
      const aAtRisk = a.slaMinutesRemaining <= 30;
      const bAtRisk = b.slaMinutesRemaining <= 30;
      if (aAtRisk && !bAtRisk) return -1;
      if (!aAtRisk && bAtRisk) return 1;
      if (aAtRisk && bAtRisk) {
        return a.slaMinutesRemaining - b.slaMinutesRemaining;
      }

      // 5. Chamados parados há mais de 10 dias
      const aStagnant = a.daysStagnant >= 10;
      const bStagnant = b.daysStagnant >= 10;
      if (aStagnant && !bStagnant) return -1;
      if (!aStagnant && bStagnant) return 1;
      if (aStagnant && bStagnant) {
        return b.daysStagnant - a.daysStagnant;
      }

      // 6. Chamados sem responsável
      if (a.assignee.isUnassigned && !b.assignee.isUnassigned) return -1;
      if (!a.assignee.isUnassigned && b.assignee.isUnassigned) return 1;

      // 7. Ordenação padrão por prioridade oficial (P2 > P3 > P4)
      const priorityWeights: Record<string, number> = { P1: 4, P2: 3, P3: 2, P4: 1 };
      const weightDiff = (priorityWeights[b.priority] || 0) - (priorityWeights[a.priority] || 0);
      if (weightDiff !== 0) return weightDiff;

      // Por fim, menor tempo de SLA restante
      return a.slaMinutesRemaining - b.slaMinutesRemaining;
    });
  }, [tickets, cardFilter, activeTab]);

  return (
    <div className="ops-dashboard-layout">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        criticalCount={metrics.p1Active + metrics.slaBreached}
        totalTickets={tickets.length}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="ops-dashboard-main">
        {/* Discreet Mobile Header Bar (Only visible < 1024px) */}
        <div className="ops-mobile-bar">
          <button 
            className="mobile-menu-btn"
            onClick={() => setIsMobileMenuOpen(true)}
            title="Abrir menu lateral"
            aria-label="Abrir menu lateral"
          >
            <Menu size={18} />
            <span>Menu Operacional</span>
          </button>
        </div>

        <main className="ops-content-container">
          {origemDados !== 'supabase' && (
            <div className="active-filter-alert-bar">
              <span className="active-filter-text">
                {origemDados === 'carregando' ? 'Carregando chamados do Supabase…' : 'Não foi possível ler o Supabase: exibindo dados de exemplo.'}
              </span>
            </div>
          )}
          {/* Quick Active Filter Pill Bar */}
          {cardFilter && (
            <div className="active-filter-alert-bar">
              <span className="active-filter-text">
                <Filter size={14} /> Filtro ativo:{' '}
                <strong>
                  {cardFilter === 'p1' && 'Prioridade P1'}
                  {cardFilter === 'breached' && 'SLAs Vencidos'}
                  {cardFilter === 'risk' && 'SLAs em Risco (< 30 min)'}
                  {cardFilter === 'stagnant' && 'Parados há mais de 10 dias'}
                  {cardFilter === 'unassigned' && 'Sem Responsável'}
                  {cardFilter === 'waiting' && 'Aguardando Cliente'}
                  {cardFilter === 'blocked' && 'Tickets Bloqueados'}
                  {cardFilter === 'backlog' && 'Backlog de Produto'}
                  {cardFilter === 'similar' && 'Vinculados a Pai'}
                  {cardFilter === 'review' && 'Revisão do Gestor'}
                  {!['p1', 'breached', 'risk', 'stagnant', 'unassigned', 'waiting', 'blocked', 'backlog', 'similar', 'review'].includes(cardFilter) && `Analista: ${cardFilter}`}
                </strong>{' '}
                ({filteredAndSortedTickets.length} resultados)
              </span>
              <button
                className="btn-clear-active-filter"
                onClick={() => setCardFilter(null)}
              >
                Limpar filtro
              </button>
            </div>
          )}

          {/* 2. Compact Priority Cards at Top */}
          <MetricsTopCards
            metrics={metrics}
            activeFilter={cardFilter}
            onFilterClick={handleCardFilterClick}
          />

          {/* 3. Main Priority Table: ATENÇÃO IMEDIATA (Sem rolagem inicial em desktop) */}
          <PriorityTable
            tickets={filteredAndSortedTickets}
            totalFilteredCount={filteredAndSortedTickets.length}
          />

          {/* 4. Team Workload Panel */}
          <TeamWorkloadPanel
            members={members}
            unassignedCount={metrics.unassigned}
            onFilterAssignee={(name) => {
              setCardFilter(name);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />

          {/* 5. Compact Pending Issues Section */}
          <PendingIssuesSection
            tickets={tickets}
            onSelectPendingCategory={(categoryKey) => {
              setCardFilter(categoryKey);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </main>

        <footer className="ops-footer">
          <div className="footer-compliance">
            <span className="compliance-dot" />
            <span>Painel Gerencial de Operações • PREFtech Suporte Sem Espera</span>
          </div>
          <div className="footer-info">
            <span>Classificação P1–P4 regida por Acordo de Nível de Serviço (SLA) Contratual</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
