'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/support/Sidebar';
import { MetricsTopCards } from './components/support/MetricsTopCards';
import { PriorityTable } from './components/support/PriorityTable';
import { TeamWorkloadPanel } from './components/support/TeamWorkloadPanel';
import { PendingIssuesSection } from './components/support/PendingIssuesSection';
import { 
  SupportSettingsModal, 
  DEFAULT_SUPPORT_CONFIG, 
  type SupportConfig 
} from './components/support/SupportSettingsModal';
import { 
  MOCK_TICKETS, 
  MOCK_TEAM_MEMBERS,
  SAMPLE_TICKETS,
  SAMPLE_TEAM_MEMBERS,
  type Ticket,
  type TeamMember
} from './data/mockSupportData';
import { Filter, Menu, Sliders, PlusCircle, Zap, RotateCcw, AlertTriangle } from 'lucide-react';
import './index.css';
import './App.css';

export default function App() {
  const [config, setConfig] = useState<SupportConfig>(() => {
    try {
      const saved = localStorage.getItem('preftech_support_config');
      return saved ? JSON.parse(saved) : DEFAULT_SUPPORT_CONFIG;
    } catch {
      return DEFAULT_SUPPORT_CONFIG;
    }
  });

  // Dados reais do Supabase (/api/gestao). Os botões de demonstração só trocam a visualização.
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [origemDados, setOrigemDados] = useState<'carregando' | 'supabase' | 'exemplo' | 'demonstracao'>('carregando');

  const [activeTab, setActiveTab] = useState('overview');
  const [cardFilter, setCardFilter] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Configuration persistence
  const handleSaveConfig = (newConfig: SupportConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem('preftech_support_config', JSON.stringify(newConfig));
    } catch (e) {
      console.error(e);
    }
  };

  // Cadastros feitos pelo modal ficam só nesta sessão do navegador (não gravam no Supabase):
  // o canal oficial para abrir chamado é o bot. Guardados à parte para sobreviver à atualização periódica.
  const ticketsLocais = useRef<Ticket[]>([]);
  const membrosLocais = useRef<TeamMember[]>([]);
  // "Carregar Dados de Demonstração" e "Limpar Fila" só trocam a visualização e pausam a atualização.
  const emDemonstracao = useRef(false);

  const handleAddTicket = (newTicket: Ticket) => {
    ticketsLocais.current = [newTicket, ...ticketsLocais.current];
    setTickets((prev) => [newTicket, ...prev]);
  };

  const handleAddTeamMember = (newMember: TeamMember) => {
    membrosLocais.current = [...membrosLocais.current, newMember];
    setTeamMembers((prev) => [...prev, newMember]);
  };

  const handleLoadSampleData = () => {
    emDemonstracao.current = true;
    setOrigemDados('demonstracao');
    setTickets(SAMPLE_TICKETS);
    setTeamMembers(SAMPLE_TEAM_MEMBERS);
    setCardFilter(null);
  };

  const handleClearAllData = () => {
    emDemonstracao.current = true;
    setOrigemDados('demonstracao');
    setTickets([]);
    setTeamMembers([]);
    setCardFilter(null);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setCardFilter(null); // Clear card filter when changing view mode
  };

  // Ticket recém-criado pelo bot: a tabela mostra só ele até o usuário pedir "Ver todos".
  const [ticketDestaque, setTicketDestaque] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (emDemonstracao.current) return;
    try {
      const r = await fetch('/api/gestao', { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      const dados = (await r.json()) as { tickets: Ticket[]; members: TeamMember[] };
      setTickets([...ticketsLocais.current, ...dados.tickets]);
      setTeamMembers([...dados.members, ...membrosLocais.current]);
      setOrigemDados('supabase');
    } catch {
      setTickets(MOCK_TICKETS);
      setTeamMembers(MOCK_TEAM_MEMBERS);
      setOrigemDados('exemplo');
    }
  }, []);

  const voltarAosDadosReais = () => {
    emDemonstracao.current = false;
    setOrigemDados('carregando');
    carregar();
  };

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 30_000);
    return () => clearInterval(intervalo);
  }, [carregar]);

  // O chat do bot (iframe /widget) avisa quando cria um ticket: recarrega e mostra o ticket na hora.
  useEffect(() => {
    const aoReceber = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.tipo !== 'aprova-ticket-criado') return;
      setTicketDestaque(String(e.data.protocolo));
      setCardFilter(null);
      carregar();
    };
    window.addEventListener('message', aoReceber);
    return () => window.removeEventListener('message', aoReceber);
  }, [carregar]);

  // Metrics Data Calculation
  const metrics = useMemo(() => {
    const breached = tickets.filter((t) => t.slaMinutesRemaining < 0);
    const stagnant = tickets.filter((t) => t.daysStagnant >= 10);
    return {
      p1Breached: breached.filter((t) => t.priority === 'P1').length,
      maxDelayMinutes: breached.reduce((max, t) => Math.max(max, -t.slaMinutesRemaining), 0),
      avgStagnantDays: stagnant.length ? Math.round(stagnant.reduce((s, t) => s + t.daysStagnant, 0) / stagnant.length) : 0,
      p1Unassigned: tickets.filter((t) => t.priority === 'P1' && t.assignee.isUnassigned).length,
      p1Active: tickets.filter((t) => t.priority === 'P1').length,
      slaBreached: tickets.filter((t) => t.slaMinutesRemaining < 0).length,
      slaAtRisk: tickets.filter((t) => t.slaMinutesRemaining >= 0 && t.slaMinutesRemaining <= config.riskWarningMinutes).length,
      stagnant10d: tickets.filter((t) => t.daysStagnant >= config.stagnantDaysLimit).length,
      unassigned: tickets.filter((t) => t.assignee.isUnassigned).length,
      waitingClient: tickets.filter((t) => t.status === 'Aguardando Cliente').length
    };
  }, [tickets, config.riskWarningMinutes, config.stagnantDaysLimit]);

  // Cumprimento de SLA: chamados de suporte (fora do backlog) dentro do prazo.
  const slaCompliance = useMemo(() => {
    const support = tickets.filter((t) => !t.isProductBacklog);
    return support.length ? (support.filter((t) => t.slaMinutesRemaining >= 0).length / support.length) * 100 : 100;
  }, [tickets]);

  // Card Filter Handler (toggle or set)
  const handleCardFilterClick = (filterKey: string) => {
    setCardFilter((prev) => (prev === filterKey ? null : filterKey));
  };

  // Managerial Ranking and Filtering
  const filteredAndSortedTickets = useMemo(() => {
    let result = [...tickets];

    if (ticketDestaque) {
      return result.filter((t) => t.number === ticketDestaque);
    }

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
          result = result.filter((t) => t.slaMinutesRemaining >= 0 && t.slaMinutesRemaining <= config.riskWarningMinutes);
          break;
        case 'stagnant':
          result = result.filter((t) => t.daysStagnant >= config.stagnantDaysLimit);
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

    // Sidebar Tab Filter: Atenção Imediata isolates only actionable urgency tickets
    if (activeTab === 'attention') {
      result = result.filter(
        (t) => t.priority === 'P1' || t.slaMinutesRemaining <= config.riskWarningMinutes || t.daysStagnant >= config.stagnantDaysLimit || t.assignee.isUnassigned
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

      // 4. SLAs em risco iminente (<= threshold)
      const aAtRisk = a.slaMinutesRemaining <= config.riskWarningMinutes;
      const bAtRisk = b.slaMinutesRemaining <= config.riskWarningMinutes;
      if (aAtRisk && !bAtRisk) return -1;
      if (!aAtRisk && bAtRisk) return 1;
      if (aAtRisk && bAtRisk) {
        return a.slaMinutesRemaining - b.slaMinutesRemaining;
      }

      // 5. Chamados parados há mais de X dias
      const aStagnant = a.daysStagnant >= config.stagnantDaysLimit;
      const bStagnant = b.daysStagnant >= config.stagnantDaysLimit;
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
  }, [tickets, cardFilter, activeTab, ticketDestaque, config.riskWarningMinutes, config.stagnantDaysLimit]);

  return (
    <div className="ops-dashboard-layout">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        criticalCount={metrics.p1Active + metrics.slaBreached + metrics.slaAtRisk}
        totalTickets={tickets.length}
        slaCompliance={slaCompliance}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
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
                {origemDados === 'carregando'
                  ? 'Carregando chamados do Supabase…'
                  : origemDados === 'demonstracao'
                    ? 'Modo demonstração: exibindo dados de exemplo, sem alterar o Supabase.'
                    : 'Não foi possível ler o Supabase: exibindo dados de exemplo.'}
              </span>
              {origemDados === 'demonstracao' && (
                <button className="btn-clear-active-filter" onClick={voltarAosDadosReais}>
                  Voltar aos dados reais
                </button>
              )}
            </div>
          )}
          {ticketDestaque && (
            <div className="active-filter-alert-bar">
              <span className="active-filter-text">
                <Filter size={14} /> Ticket <strong>{ticketDestaque}</strong> criado pelo bot
                {filteredAndSortedTickets.length === 0 && ' (carregando…)'}
              </span>
              <button className="btn-clear-active-filter" onClick={() => setTicketDestaque(null)}>
                Ver todos
              </button>
            </div>
          )}
          {/* Page Top Action Bar */}
          <div className="ops-action-bar">
            <div>
              <h1 className="ops-page-heading">Operações de Suporte & SLAs</h1>
              <span className="ops-page-subheading">
                Fila inteligente regida pela Matriz de Prioridade (P1–P4) e Acordos de Nível de Serviço
              </span>
            </div>

            <div className="ops-action-buttons">
              {tickets.length === 0 ? (
                <button 
                  className="btn-action-outline btn-demo-action"
                  onClick={handleLoadSampleData}
                  title="Carregar conjunto de chamados de exemplo para testar filtros e regras"
                >
                  <Zap size={14} />
                  <span>Carregar Dados de Demonstração</span>
                </button>
              ) : (
                <button 
                  className="btn-action-outline"
                  onClick={handleClearAllData}
                  title="Esvaziar todos os chamados da fila"
                >
                  <RotateCcw size={14} />
                  <span>Limpar Fila</span>
                </button>
              )}

              <button 
                className="btn-action-outline"
                onClick={() => setIsSettingsOpen(true)}
                title="Configurar matriz de prioridades, SLAs e regras"
              >
                <Sliders size={15} />
                <span>Matriz & Regras de SLA</span>
              </button>

              <button 
                className="btn-action-primary"
                onClick={() => setIsSettingsOpen(true)}
                title="Cadastrar novo chamado de suporte"
              >
                <PlusCircle size={15} />
                <span>Registrar Chamado</span>
              </button>
            </div>
          </div>

          {/* Attention Mode Active Banner */}
          {activeTab === 'attention' && (
            <div className="active-filter-alert-bar" style={{ backgroundColor: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' }}>
              <span className="active-filter-text">
                <AlertTriangle size={16} /> Modo Ativo:{' '}
                <strong>Atenção Imediata</strong> — isolando apenas os casos críticos ({filteredAndSortedTickets.length} de {tickets.length} chamados). Chamados estáveis P3/P4 estão ocultados.
              </span>
              <button 
                className="btn-clear-active-filter" 
                style={{ color: '#991b1b' }}
                onClick={() => setActiveTab('overview')}
              >
                Ver todos os chamados ({tickets.length})
              </button>
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
                  {cardFilter === 'risk' && `SLAs em Risco (< ${config.riskWarningMinutes} min)`}
                  {cardFilter === 'stagnant' && `Parados há mais de ${config.stagnantDaysLimit} dias`}
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

          {/* 3. Main Priority Table */}
          <PriorityTable
            tickets={filteredAndSortedTickets}
            totalFilteredCount={filteredAndSortedTickets.length}
            activeTab={activeTab}
            onClearTabFilter={() => setActiveTab('overview')}
            onLoadSampleData={handleLoadSampleData}
            onOpenNewTicketModal={() => setIsSettingsOpen(true)}
          />

          {/* 4. Team Workload Panel */}
          <TeamWorkloadPanel
            members={teamMembers}
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
            <span>
              Matriz Ativa: P1 ({config.p1SlaMinutes}m) • P2 ({config.p2SlaHours}h) • P3 ({config.p3SlaHours}h) • P4 ({config.p4SlaDays}d)
            </span>
          </div>
        </footer>
      </div>

      {/* Support Settings & Priority Matrix Modal */}
      {/* Montado só quando aberto: o modal sorteia o número do novo chamado, o que não pode ocorrer no pré-render. */}
      {isSettingsOpen && (
        <SupportSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          config={config}
          onSaveConfig={handleSaveConfig}
          onAddTicket={handleAddTicket}
          onAddTeamMember={handleAddTeamMember}
          teamMembers={teamMembers}
        />
      )}
    </div>
  );
}
