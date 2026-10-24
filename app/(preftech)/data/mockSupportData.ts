export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export type TicketStatus = 'Em Atendimento' | 'Aberto' | 'Aguardando Cliente' | 'Bloqueado' | 'Em Análise N3';
export type RequestType = 'Incidente Crítico' | 'Falha de Sistema' | 'Requisição' | 'Dúvida Operacional' | 'Problema Conhecido' | 'Melhoria/Nova Parametrização';

export interface Ticket {
  id: string;
  number: string;
  title: string;
  account: string;
  category: string;
  priority: Priority;
  requestType?: RequestType;
  createdAt: string;
  firstAction: string;
  status: TicketStatus;
  assignee: {
    name: string;
    avatar?: string;
    isUnassigned?: boolean;
  };
  slaMinutesRemaining: number; // Negativo = SLA vencido em minutos
  lastUpdateHoursAgo: number;
  daysStagnant: number; // Parado há X dias
  urgencyReason: string;
  isBlocked?: boolean;
  blockReason?: string;
  isProductBacklog?: boolean;
  backlogIssueKey?: string;
  isSimilarOrChild?: boolean;
  parentTicketNumber?: string;
  needsManagerReview?: boolean;
  managerReviewReason?: string;
  /** Chamado ainda sem prioridade definida (veio assim da origem). `priority` fica P4 só para a ordenação. */
  unprioritized?: boolean;
  /** Aberto pelo bot de atendimento nas últimas 24h. */
  isNewFromBot?: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  status: 'online' | 'busy' | 'offline';
  activeTickets: number;
  p1Tickets: number;
  breachedSlaTickets: number;
  stagnantTickets: number;
  capacityLimit: number;
}

export const MOCK_TEAM_MEMBERS: TeamMember[] = [];

export const MOCK_TICKETS: Ticket[] = [];

export const MOCK_ACCOUNTS: string[] = [
  'Todas as contas',
  'Prefeitura de Campinas (SEFAZ)',
  'Secretaria Estadual de Saúde (SES)',
  'Prefeitura de Santos',
  'Prefeitura de Florianópolis',
  'Prefeitura de Ribeirão Preto'
];

export const SAMPLE_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'agent-1',
    name: 'Carlos Albuquerque',
    role: 'Especialista N3',
    avatar: '',
    status: 'busy',
    activeTickets: 9, // Sobrecarga (> 8)
    p1Tickets: 2,
    breachedSlaTickets: 1,
    stagnantTickets: 1,
    capacityLimit: 8
  },
  {
    id: 'agent-2',
    name: 'Mariana Duarte',
    role: 'Analista Pleno N2',
    avatar: '',
    status: 'online',
    activeTickets: 5,
    p1Tickets: 0,
    breachedSlaTickets: 0,
    stagnantTickets: 0,
    capacityLimit: 8
  },
  {
    id: 'agent-3',
    name: 'Rafael Mendes',
    role: 'Analista N2',
    avatar: '',
    status: 'online',
    activeTickets: 4,
    p1Tickets: 0,
    breachedSlaTickets: 0,
    stagnantTickets: 0,
    capacityLimit: 8
  }
];

export const SAMPLE_TICKETS: Ticket[] = [
  {
    id: 'tk-1082',
    number: '#TK-1082',
    title: 'Indisponibilidade crítica do cluster RabbitMQ e fila de mensageria',
    account: 'Prefeitura de Campinas (SEFAZ)',
    category: 'Infraestrutura & Mensageria',
    priority: 'P1',
    requestType: 'Incidente Crítico',
    createdAt: '24/10 10:14',
    firstAction: 'DBA e DevOps acionados; deadlock detectado no pool primário',
    status: 'Em Atendimento',
    assignee: { name: 'Carlos Albuquerque' },
    slaMinutesRemaining: -48, // Vencido há 48 min -> ATENÇÃO IMEDIATA
    lastUpdateHoursAgo: 0.2,
    daysStagnant: 0,
    urgencyReason: 'SLA vencido há 48 min • P1 Crítico',
    needsManagerReview: true,
    managerReviewReason: 'Estouro de SLA P1 requer notificação formal à Diretoria'
  },
  {
    id: 'tk-1090',
    number: '#TK-1090',
    title: 'Falha geral na emissão de certidões e guias de ITBI via Portal',
    account: 'Secretaria Estadual de Saúde (SES)',
    category: 'Sistemas Tributários',
    priority: 'P1',
    requestType: 'Incidente Crítico',
    createdAt: '24/10 11:00',
    firstAction: 'Investigando falha de certificado digital mTLS na integração Sefaz',
    status: 'Em Atendimento',
    assignee: { name: 'Carlos Albuquerque' },
    slaMinutesRemaining: 15, // Vence em 15 min -> ATENÇÃO IMEDIATA
    lastUpdateHoursAgo: 0.4,
    daysStagnant: 0,
    urgencyReason: 'P1 com SLA em risco iminente (15 min restantes)',
    isBlocked: true,
    blockReason: 'Aguardando liberação de firewall pelo time de redes do órgão'
  },
  {
    id: 'tk-1075',
    number: '#TK-1075',
    title: 'Erro 502 Bad Gateway no módulo de protocolo unificado municipal',
    account: 'Prefeitura de Ribeirão Preto',
    category: 'Aplicações Web',
    priority: 'P2',
    requestType: 'Falha de Sistema',
    createdAt: '24/10 09:20',
    firstAction: 'Reiniciado container de microsserviço de protocolo',
    status: 'Em Atendimento',
    assignee: { name: 'Mariana Duarte' },
    slaMinutesRemaining: 25, // Vence em 25 min -> ATENÇÃO IMEDIATA
    lastUpdateHoursAgo: 1.1,
    daysStagnant: 0,
    urgencyReason: 'SLA em risco iminente (25 min restantes)'
  },
  {
    id: 'tk-1044',
    number: '#TK-1044',
    title: 'Falha recorrente na sincronização bancária CNAB 240 / 400',
    account: 'Prefeitura de Santos',
    category: 'Integrações Bancárias',
    priority: 'P2',
    requestType: 'Problema Conhecido',
    createdAt: '10/10 14:00',
    firstAction: 'Layout da Caixa Econômica com divergência de header',
    status: 'Aguardando Cliente',
    assignee: { name: 'Mariana Duarte' },
    slaMinutesRemaining: 340,
    lastUpdateHoursAgo: 264,
    daysStagnant: 11, // Parado há 11 dias -> ATENÇÃO IMEDIATA
    urgencyReason: 'Parado há 11 dias sem movimentação',
    isProductBacklog: true,
    backlogIssueKey: 'ENG-4412'
  },
  {
    id: 'tk-1099',
    number: '#TK-1099',
    title: 'Solicitação de acesso administrativo especial para auditoria externa',
    account: 'Tribunal de Contas Municipal',
    category: 'Acessos & Permissões',
    priority: 'P3',
    requestType: 'Requisição',
    createdAt: '24/10 12:15',
    firstAction: 'Aguardando aprovação formal do gestor de segurança',
    status: 'Aberto',
    assignee: { name: 'Sem Responsável', isUnassigned: true }, // Sem responsável -> ATENÇÃO IMEDIATA
    slaMinutesRemaining: 180,
    lastUpdateHoursAgo: 0.5,
    daysStagnant: 0,
    urgencyReason: 'Sem analista responsável • Triagem pendente',
    needsManagerReview: true,
    managerReviewReason: 'Acesso com privilégios de auditoria requer aprovação'
  },
  {
    id: 'tk-1060',
    number: '#TK-1060',
    title: 'Dúvida operacional sobre cálculo de alíquota progressiva de IPTU',
    account: 'Prefeitura de Florianópolis',
    category: 'Sistemas Tributários',
    priority: 'P3', // Estável (NÃO é atenção imediata)
    requestType: 'Dúvida Operacional',
    createdAt: '23/10 15:30',
    firstAction: 'Encaminhado manual de parametrização da Lei Complementar',
    status: 'Em Atendimento',
    assignee: { name: 'Rafael Mendes' },
    slaMinutesRemaining: 680,
    lastUpdateHoursAgo: 4.2,
    daysStagnant: 1,
    urgencyReason: 'Atendimento regular em andamento'
  },
  {
    id: 'tk-1033',
    number: '#TK-1033',
    title: 'Ajuste de máscara monetária no relatório de certidões emitidas',
    account: 'Prefeitura de Campinas (SEFAZ)',
    category: 'Relatórios & BI',
    priority: 'P4', // Estável (NÃO é atenção imediata)
    requestType: 'Requisição',
    createdAt: '22/10 14:00',
    firstAction: 'Ajuste agendado para a próxima sprint de sustentação',
    status: 'Aberto',
    assignee: { name: 'Rafael Mendes' },
    slaMinutesRemaining: 1440,
    lastUpdateHoursAgo: 24,
    daysStagnant: 2,
    urgencyReason: 'Requisição rotineira P4'
  }
];
