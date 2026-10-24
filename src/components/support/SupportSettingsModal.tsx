import { useState } from 'react';
import { 
  X, 
  Sliders, 
  Clock, 
  Users, 
  PlusCircle, 
  Check, 
  AlertTriangle, 
  RotateCcw,
  Flag,
  ShieldCheck,
  UserPlus
} from 'lucide-react';
import type { Ticket, TeamMember, Priority } from '../../data/mockSupportData';
import './SupportSettingsModal.css';

export interface SupportConfig {
  p1SlaMinutes: number;
  p2SlaHours: number;
  p3SlaHours: number;
  p4SlaDays: number;
  riskWarningMinutes: number;
  stagnantDaysLimit: number;
  analystCapacityLimit: number;
  autoNotifyManagerP1: boolean;
  managerNotificationEmail: string;
}

export const DEFAULT_SUPPORT_CONFIG: SupportConfig = {
  p1SlaMinutes: 60,
  p2SlaHours: 4,
  p3SlaHours: 24,
  p4SlaDays: 3,
  riskWarningMinutes: 30,
  stagnantDaysLimit: 10,
  analystCapacityLimit: 8,
  autoNotifyManagerP1: true,
  managerNotificationEmail: 'plantao.suporte@preftech.gov.br'
};

interface SupportSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SupportConfig;
  onSaveConfig: (newConfig: SupportConfig) => void;
  onAddTicket: (ticket: Ticket) => void;
  onAddTeamMember: (member: TeamMember) => void;
  teamMembers: TeamMember[];
}

export const SupportSettingsModal: React.FC<SupportSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onAddTicket,
  onAddTeamMember,
  teamMembers
}) => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'capacity' | 'new-ticket' | 'new-member'>('matrix');
  const [formConfig, setFormConfig] = useState<SupportConfig>(config);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New Ticket Form State
  const [ticketNumber, setTicketNumber] = useState(`#TK-${Math.floor(1000 + Math.random() * 9000)}`);
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketAccount, setTicketAccount] = useState('Prefeitura de Campinas (SEFAZ)');
  const [ticketCategory, setTicketCategory] = useState('Infraestrutura & Mensageria');
  const [customCategory, setCustomCategory] = useState('');
  const [ticketPriority, setTicketPriority] = useState<Priority>('P1');
  const [ticketFirstAction, setTicketFirstAction] = useState('');
  const [ticketAssignee, setTicketAssignee] = useState<string>('unassigned');
  const [ticketSlaOffsetMinutes, setTicketSlaOffsetMinutes] = useState<number>(45);
  const [ticketCreatedSuccess, setTicketCreatedSuccess] = useState(false);

  // New Member Form State
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('Analista Pleno N2');
  const [memberCapacity, setMemberCapacity] = useState(8);
  const [memberCreatedSuccess, setMemberCreatedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSaveMatrix = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(formConfig);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleResetDefaults = () => {
    setFormConfig(DEFAULT_SUPPORT_CONFIG);
    onSaveConfig(DEFAULT_SUPPORT_CONFIG);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketTitle.trim()) return;

    const isUnassigned = ticketAssignee === 'unassigned';
    const foundMember = teamMembers.find((m) => m.name === ticketAssignee);

    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const finalCategory = ticketCategory === 'Outro' 
      ? (customCategory.trim() || 'Outro')
      : ticketCategory;

    const newTicket: Ticket = {
      id: `tk-${Date.now()}`,
      number: ticketNumber,
      title: ticketTitle.trim(),
      account: ticketAccount.trim(),
      category: finalCategory,
      priority: ticketPriority,
      createdAt: dateStr,
      firstAction: ticketFirstAction.trim() || 'Chamado registrado pela equipe de suporte; aguardando triagem',
      status: isUnassigned ? 'Aberto' : 'Em Atendimento',
      assignee: {
        name: isUnassigned ? 'Sem Responsável' : (foundMember?.name || ticketAssignee),
        isUnassigned: isUnassigned
      },
      slaMinutesRemaining: Number(ticketSlaOffsetMinutes),
      lastUpdateHoursAgo: 0.1,
      daysStagnant: 0,
      urgencyReason: ticketSlaOffsetMinutes < 0 
        ? `SLA vencido há ${Math.abs(ticketSlaOffsetMinutes)} min • ${ticketPriority}`
        : `${ticketPriority} • Prazo em ${ticketSlaOffsetMinutes} min`,
      needsManagerReview: ticketPriority === 'P1' && ticketSlaOffsetMinutes < 0
    };

    onAddTicket(newTicket);
    setTicketCreatedSuccess(true);
    setTicketTitle('');
    setTicketFirstAction('');
    setCustomCategory('');
    setTicketNumber(`#TK-${Math.floor(1000 + Math.random() * 9000)}`);
    setTimeout(() => setTicketCreatedSuccess(false), 3000);
  };

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim()) return;

    const newMember: TeamMember = {
      id: `member-${Date.now()}`,
      name: memberName.trim(),
      role: memberRole,
      avatar: '',
      status: 'online',
      activeTickets: 0,
      p1Tickets: 0,
      breachedSlaTickets: 0,
      stagnantTickets: 0,
      capacityLimit: Number(memberCapacity) || 8
    };

    onAddTeamMember(newMember);
    setMemberCreatedSuccess(true);
    setMemberName('');
    setTimeout(() => setMemberCreatedSuccess(false), 3000);
  };

  return (
    <div className="settings-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="settings-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="settings-modal-header">
          <div className="header-title-box">
            <div className="settings-icon-badge">
              <Sliders size={20} />
            </div>
            <div>
              <h2 className="settings-title">Configurações Operacionais de Suporte</h2>
              <p className="settings-subtitle">
                Personalize a Matriz de Prioridade, tempos de SLA e cadastre regras da equipe
              </p>
            </div>
          </div>
          <button className="settings-close-btn" onClick={onClose} aria-label="Fechar configurações">
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="settings-tabs-bar">
          <button 
            className={`settings-tab-btn ${activeTab === 'matrix' ? 'active' : ''}`}
            onClick={() => setActiveTab('matrix')}
          >
            <Clock size={16} />
            <span>Matriz de Prioridade & SLA</span>
          </button>

          <button 
            className={`settings-tab-btn ${activeTab === 'capacity' ? 'active' : ''}`}
            onClick={() => setActiveTab('capacity')}
          >
            <Users size={16} />
            <span>Capacidade da Equipe</span>
          </button>

          <button 
            className={`settings-tab-btn ${activeTab === 'new-ticket' ? 'active' : ''}`}
            onClick={() => setActiveTab('new-ticket')}
          >
            <PlusCircle size={16} />
            <span>Cadastrar Novo Chamado</span>
          </button>

          <button 
            className={`settings-tab-btn ${activeTab === 'new-member' ? 'active' : ''}`}
            onClick={() => setActiveTab('new-member')}
          >
            <UserPlus size={16} />
            <span>Adicionar Analista</span>
          </button>
        </div>

        {/* Tab 1: Matriz de Prioridade */}
        {activeTab === 'matrix' && (
          <form className="settings-form-body" onSubmit={handleSaveMatrix}>
            <div className="settings-section-card">
              <div className="section-title-wrap">
                <Flag size={16} className="text-brand" />
                <h3 className="section-title">Tempos Contratuais de Resolução por Nível</h3>
              </div>
              <p className="section-desc">
                Defina os limites máximos de atendimento para cada classificação de chamado.
              </p>

              <div className="matrix-inputs-grid">
                <div className="input-group">
                  <label className="input-label text-critical">
                    Prioridade P1 (Crítico / Parada Total)
                  </label>
                  <div className="input-with-unit">
                    <input 
                      type="number" 
                      min="5" 
                      max="1440"
                      className="form-input font-mono"
                      value={formConfig.p1SlaMinutes}
                      onChange={(e) => setFormConfig({ ...formConfig, p1SlaMinutes: Number(e.target.value) })}
                    />
                    <span className="unit-label">minutos</span>
                  </div>
                  <span className="input-hint">Indisponibilidade de serviços públicos e infraestrutura</span>
                </div>

                <div className="input-group">
                  <label className="input-label text-warning">
                    Prioridade P2 (Alta / Degradação Severa)
                  </label>
                  <div className="input-with-unit">
                    <input 
                      type="number" 
                      min="1" 
                      max="72"
                      className="form-input font-mono"
                      value={formConfig.p2SlaHours}
                      onChange={(e) => setFormConfig({ ...formConfig, p2SlaHours: Number(e.target.value) })}
                    />
                    <span className="unit-label">horas</span>
                  </div>
                  <span className="input-hint">Falha grave sem contorno afetando múltiplos setores</span>
                </div>

                <div className="input-group">
                  <label className="input-label text-primary">
                    Prioridade P3 (Média / Falha com Contorno)
                  </label>
                  <div className="input-with-unit">
                    <input 
                      type="number" 
                      min="1" 
                      max="168"
                      className="form-input font-mono"
                      value={formConfig.p3SlaHours}
                      onChange={(e) => setFormConfig({ ...formConfig, p3SlaHours: Number(e.target.value) })}
                    />
                    <span className="unit-label">horas</span>
                  </div>
                  <span className="input-hint">Problema pontual com solução de contorno temporária</span>
                </div>

                <div className="input-group">
                  <label className="input-label text-muted">
                    Prioridade P4 (Baixa / Dúvida e Solicitação)
                  </label>
                  <div className="input-with-unit">
                    <input 
                      type="number" 
                      min="1" 
                      max="30"
                      className="form-input font-mono"
                      value={formConfig.p4SlaDays}
                      onChange={(e) => setFormConfig({ ...formConfig, p4SlaDays: Number(e.target.value) })}
                    />
                    <span className="unit-label">dias úteis</span>
                  </div>
                  <span className="input-hint">Dúvidas operacionais, requisições de acesso rotineiras</span>
                </div>
              </div>
            </div>

            <div className="settings-section-card">
              <div className="section-title-wrap">
                <AlertTriangle size={16} className="text-warning" />
                <h3 className="section-title">Gatilhos de Alerta e Estagnação</h3>
              </div>

              <div className="form-row-2col">
                <div className="input-group">
                  <label className="input-label">Alerta de Risco Iminente de SLA</label>
                  <div className="input-with-unit">
                    <input 
                      type="number" 
                      min="5" 
                      max="120"
                      className="form-input font-mono"
                      value={formConfig.riskWarningMinutes}
                      onChange={(e) => setFormConfig({ ...formConfig, riskWarningMinutes: Number(e.target.value) })}
                    />
                    <span className="unit-label">min restantes</span>
                  </div>
                  <span className="input-hint">Destaca chamado em amarelo quando faltar este tempo</span>
                </div>

                <div className="input-group">
                  <label className="input-label">Limite para Alerta de Estagnação</label>
                  <div className="input-with-unit">
                    <input 
                      type="number" 
                      min="1" 
                      max="60"
                      className="form-input font-mono"
                      value={formConfig.stagnantDaysLimit}
                      onChange={(e) => setFormConfig({ ...formConfig, stagnantDaysLimit: Number(e.target.value) })}
                    />
                    <span className="unit-label">dias sem interação</span>
                  </div>
                  <span className="input-hint">Considera chamado estagnado após esse período</span>
                </div>
              </div>

              <div className="checkbox-setting-row">
                <label className="checkbox-label-container">
                  <input 
                    type="checkbox" 
                    checked={formConfig.autoNotifyManagerP1}
                    onChange={(e) => setFormConfig({ ...formConfig, autoNotifyManagerP1: e.target.checked })}
                  />
                  <div>
                    <span className="checkbox-title">Notificação Automática de Estouro P1</span>
                    <span className="checkbox-desc">Dispara alerta para o gestor operacional sempre que um P1 ultrapassar o prazo</span>
                  </div>
                </label>
              </div>

              {formConfig.autoNotifyManagerP1 && (
                <div className="input-group" style={{ marginTop: '12px' }}>
                  <label className="input-label">E-mail ou Webhook de Plantão</label>
                  <input 
                    type="text" 
                    className="form-input font-mono"
                    value={formConfig.managerNotificationEmail}
                    onChange={(e) => setFormConfig({ ...formConfig, managerNotificationEmail: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="settings-footer-actions">
              <button 
                type="button" 
                className="btn-secondary-reset" 
                onClick={handleResetDefaults}
              >
                <RotateCcw size={14} /> Restaurar Padrões ITIL
              </button>

              <button type="submit" className="btn-primary-save">
                {saveSuccess ? (
                  <>
                    <Check size={16} /> Configurações Salvas!
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} /> Salvar Parâmetros da Matriz
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Capacidade da Equipe */}
        {activeTab === 'capacity' && (
          <form className="settings-form-body" onSubmit={handleSaveMatrix}>
            <div className="settings-section-card">
              <div className="section-title-wrap">
                <Users size={16} className="text-brand" />
                <h3 className="section-title">Parâmetros de Carga Operacional</h3>
              </div>
              <p className="section-desc">
                Configure a regra de detecção de sobrecarga dos analistas do suporte.
              </p>

              <div className="input-group" style={{ maxWidth: '380px' }}>
                <label className="input-label">Limite Padrão de Chamados Simultâneos</label>
                <div className="input-with-unit">
                  <input 
                    type="number" 
                    min="1" 
                    max="30"
                    className="form-input font-mono"
                    value={formConfig.analystCapacityLimit}
                    onChange={(e) => setFormConfig({ ...formConfig, analystCapacityLimit: Number(e.target.value) })}
                  />
                  <span className="unit-label">chamados / analista</span>
                </div>
                <span className="input-hint">Analistas com mais chamados serão sinalizados com alerta de Sobrecarga</span>
              </div>
            </div>

            <div className="settings-footer-actions">
              <button type="submit" className="btn-primary-save">
                {saveSuccess ? <><Check size={16} /> Salvo com Sucesso!</> : <><Check size={16} /> Salvar Regras de Capacidade</>}
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Cadastrar Novo Chamado */}
        {activeTab === 'new-ticket' && (
          <form className="settings-form-body" onSubmit={handleCreateTicket}>
            <div className="settings-section-card">
              <div className="section-title-wrap">
                <PlusCircle size={16} className="text-brand" />
                <h3 className="section-title">Registro Direto de Chamado</h3>
              </div>
              <p className="section-desc">
                Crie um novo ticket diretamente no painel para testar ou registrar um atendimento oficial.
              </p>

              {ticketCreatedSuccess && (
                <div className="alert-success-banner">
                  <Check size={16} /> Chamado criado e posicionado na tabela com base na matriz de urgência!
                </div>
              )}

              <div className="form-row-2col">
                <div className="input-group">
                  <label className="input-label">Código do Chamado</label>
                  <input 
                    type="text" 
                    className="form-input font-mono" 
                    value={ticketNumber} 
                    onChange={(e) => setTicketNumber(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Prioridade da Matriz</label>
                  <select 
                    className="form-select font-semibold"
                    value={ticketPriority}
                    onChange={(e) => setTicketPriority(e.target.value as Priority)}
                  >
                    <option value="P1">P1 - Crítico (Emergência / Indisponibilidade)</option>
                    <option value="P2">P2 - Alta (Degradação Severa)</option>
                    <option value="P3">P3 - Média (Falha com Contorno)</option>
                    <option value="P4">P4 - Baixa (Dúvida / Requisição)</option>
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Título / Descrição Resumida do Problema</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ex: Falha na emissão de guias de IPTU no portal do cidadão"
                  value={ticketTitle} 
                  onChange={(e) => setTicketTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-row-2col">
                <div className="input-group">
                  <label className="input-label">Órgão Público / Prefeitura</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={ticketAccount} 
                    onChange={(e) => setTicketAccount(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Categoria Técnica</label>
                  <select 
                    className="form-select" 
                    value={ticketCategory} 
                    onChange={(e) => setTicketCategory(e.target.value)}
                    required
                  >
                    <option value="Infraestrutura & Mensageria">1 - Infraestrutura & Mensageria</option>
                    <option value="Segurança & Autenticação">2 - Segurança & Autenticação</option>
                    <option value="Aplicações & Serviços">3 - Aplicações & Serviços</option>
                    <option value="API Pública & Dados">4 - API Pública & Dados</option>
                    <option value="Outro">5 - Outro</option>
                  </select>
                  {ticketCategory === 'Outro' && (
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ marginTop: '8px' }}
                      placeholder="Especifique a categoria técnica..."
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      required
                    />
                  )}
                </div>
              </div>

              <div className="form-row-2col">
                <div className="input-group">
                  <label className="input-label">Atribuir a Analista</label>
                  <select 
                    className="form-select"
                    value={ticketAssignee}
                    onChange={(e) => setTicketAssignee(e.target.value)}
                  >
                    <option value="unassigned">Fila Geral (Sem Responsável)</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.name}>{m.name} ({m.role})</option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Prazo de SLA Restante (minutos)</label>
                  <div className="input-with-unit">
                    <input 
                      type="number" 
                      className="form-input font-mono"
                      value={ticketSlaOffsetMinutes}
                      onChange={(e) => setTicketSlaOffsetMinutes(Number(e.target.value))}
                    />
                    <span className="unit-label">min (negativo = vencido)</span>
                  </div>
                  <span className="input-hint">Dica: use -15 para simular SLA estourado há 15 min</span>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Diagnóstico Inicial / Primeira Ação</label>
                <textarea 
                  className="form-textarea" 
                  rows={2}
                  placeholder="Ex: Logs analisados; identificado timeout na chamada à API bancária"
                  value={ticketFirstAction}
                  onChange={(e) => setTicketFirstAction(e.target.value)}
                />
              </div>
            </div>

            <div className="settings-footer-actions">
              <button type="submit" className="btn-primary-save">
                <PlusCircle size={16} /> Inserir Chamado na Operação
              </button>
            </div>
          </form>
        )}

        {/* Tab 4: Adicionar Analista */}
        {activeTab === 'new-member' && (
          <form className="settings-form-body" onSubmit={handleCreateMember}>
            <div className="settings-section-card">
              <div className="section-title-wrap">
                <UserPlus size={16} className="text-brand" />
                <h3 className="section-title">Cadastrar Novo Analista no Suporte</h3>
              </div>
              <p className="section-desc">
                Adicione membros para a equipe de N1, N2 ou N3 monitorarem filas e receberem atribuições.
              </p>

              {memberCreatedSuccess && (
                <div className="alert-success-banner">
                  <Check size={16} /> Analista adicionado à equipe com sucesso!
                </div>
              )}

              <div className="form-row-2col">
                <div className="input-group">
                  <label className="input-label">Nome Completo</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ex: João da Silva"
                    value={memberName} 
                    onChange={(e) => setMemberName(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Nível / Cargo</label>
                  <select 
                    className="form-select"
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                  >
                    <option value="Analista N1 / Triagem">Analista N1 / Triagem</option>
                    <option value="Analista Pleno N2">Analista Pleno N2</option>
                    <option value="Especialista N3">Especialista N3</option>
                    <option value="Engenheiro de Sustentação">Engenheiro de Sustentação</option>
                    <option value="Coordenador de Suporte">Coordenador de Suporte</option>
                  </select>
                </div>
              </div>

              <div className="input-group" style={{ maxWidth: '300px' }}>
                <label className="input-label">Limite Individual de Capacidade</label>
                <div className="input-with-unit">
                  <input 
                    type="number" 
                    min="1" 
                    max="20"
                    className="form-input font-mono"
                    value={memberCapacity}
                    onChange={(e) => setMemberCapacity(Number(e.target.value))}
                  />
                  <span className="unit-label">chamados</span>
                </div>
              </div>
            </div>

            <div className="settings-footer-actions">
              <button type="submit" className="btn-primary-save">
                <UserPlus size={16} /> Cadastrar Analista
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
