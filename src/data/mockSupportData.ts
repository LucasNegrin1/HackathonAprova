export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export type TicketStatus = 'Em Atendimento' | 'Aberto' | 'Aguardando Cliente' | 'Bloqueado' | 'Em Análise N3';
export type RequestType = 'Incidente Crítico' | 'Falha de Sistema' | 'Requisição' | 'Dúvida Operacional' | 'Problema Conhecido';

export interface Ticket {
  id: string;
  number: string;
  title: string;
  account: string;
  category: string;
  priority: Priority;
  requestType: RequestType;
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

export const MOCK_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'agent-1',
    name: 'Carlos Albuquerque',
    role: 'Especialista N3',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
    status: 'busy',
    activeTickets: 11, // Sobrecarga (> 8)
    p1Tickets: 2,
    breachedSlaTickets: 2,
    stagnantTickets: 1,
    capacityLimit: 8
  },
  {
    id: 'agent-2',
    name: 'Mariana Duarte',
    role: 'Analista Pleno N2',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=faces',
    status: 'online',
    activeTickets: 9, // Sobrecarga
    p1Tickets: 1,
    breachedSlaTickets: 1,
    stagnantTickets: 2,
    capacityLimit: 8
  },
  {
    id: 'agent-3',
    name: 'Rafael Mendes',
    role: 'Analista N2',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces',
    status: 'online',
    activeTickets: 6,
    p1Tickets: 0,
    breachedSlaTickets: 1,
    stagnantTickets: 0,
    capacityLimit: 8
  },
  {
    id: 'agent-4',
    name: 'Beatriz Fonseca',
    role: 'Analista N1 / Triagem',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=faces',
    status: 'online',
    activeTickets: 5,
    p1Tickets: 0,
    breachedSlaTickets: 0,
    stagnantTickets: 0,
    capacityLimit: 8
  },
  {
    id: 'agent-5',
    name: 'Lucas Siqueira',
    role: 'Engenheiro de Sustentação',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces',
    status: 'online',
    activeTickets: 7,
    p1Tickets: 0,
    breachedSlaTickets: 1,
    stagnantTickets: 1,
    capacityLimit: 8
  }
];

export const MOCK_TICKETS: Ticket[] = [
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
    slaMinutesRemaining: -48, // Vencido há 48 min
    lastUpdateHoursAgo: 0.2, // 12 min atrás
    daysStagnant: 0,
    urgencyReason: 'SLA vencido há 48 min • P1 Crítico',
    needsManagerReview: true,
    managerReviewReason: 'Estouro de SLA P1 requer notificação formal à Diretoria'
  },
  {
    id: 'tk-1079',
    number: '#TK-1079',
    title: 'Falha geral de autenticação SSO via Certificado Digital ICP-Brasil',
    account: 'Secretaria Estadual de Saúde (SES)',
    category: 'Segurança & Autenticação',
    priority: 'P1',
    requestType: 'Incidente Crítico',
    createdAt: '24/10 10:45',
    firstAction: 'Reiniciados módulos do HSM; logs enviados para time de Criptografia',
    status: 'Em Atendimento',
    assignee: { name: 'Mariana Duarte' },
    slaMinutesRemaining: -18, // Vencido há 18 min
    lastUpdateHoursAgo: 0.3,
    daysStagnant: 0,
    urgencyReason: 'SLA vencido há 18 min • P1 Crítico'
  },
  {
    id: 'tk-1090',
    number: '#TK-1090',
    title: 'Queda de conexão no barramento de integração de APIs e Webhooks',
    account: 'Prefeitura de Santos',
    category: 'Integrações & Gateway',
    priority: 'P1',
    requestType: 'Incidente Crítico',
    createdAt: '24/10 11:32',
    firstAction: 'Triagem emergencial; falha de handshake TLS com provedor externo',
    status: 'Aberto',
    assignee: { name: 'Sem Responsável', isUnassigned: true },
    slaMinutesRemaining: 12, // Vence em 12 min!
    lastUpdateHoursAgo: 0.1,
    daysStagnant: 0,
    urgencyReason: 'Vence em 12 min • Sem responsável!'
  },
  {
    id: 'tk-1065',
    number: '#TK-1065',
    title: 'Lentidão severa e timeout no processamento assíncrono de relatórios',
    account: 'Prefeitura de Florianópolis',
    category: 'Performance & Banco de Dados',
    priority: 'P2',
    requestType: 'Falha de Sistema',
    createdAt: '24/10 08:20',
    firstAction: 'Escalado pod do worker; consumo de memória em 94%',
    status: 'Em Atendimento',
    assignee: { name: 'Carlos Albuquerque' },
    slaMinutesRemaining: -26, // Vencido
    lastUpdateHoursAgo: 1.1,
    daysStagnant: 0,
    urgencyReason: 'SLA vencido há 26 min'
  },
  {
    id: 'tk-1044',
    number: '#TK-1044',
    title: 'Erro 500 no módulo de validação de documentos cadastrais',
    account: 'Prefeitura de Ribeirão Preto',
    category: 'Aplicações & Serviços',
    priority: 'P2',
    requestType: 'Falha de Sistema',
    createdAt: '24/10 09:10',
    firstAction: 'Identificado payload JSON com encoding corrompido UTF-8',
    status: 'Em Atendimento',
    assignee: { name: 'Rafael Mendes' },
    slaMinutesRemaining: -12, // Vencido
    lastUpdateHoursAgo: 0.8,
    daysStagnant: 0,
    urgencyReason: 'SLA vencido há 12 min'
  },
  {
    id: 'tk-1093',
    number: '#TK-1093',
    title: 'Worker de ingestão de dados em lote travado após atualização de release',
    account: 'Prefeitura de São José dos Campos',
    category: 'Workers & Background Jobs',
    priority: 'P2',
    requestType: 'Incidente Crítico',
    createdAt: '24/10 11:05',
    firstAction: 'Avaliando rollback de migration e reinício controlado de réplicas',
    status: 'Em Atendimento',
    assignee: { name: 'Lucas Siqueira' },
    slaMinutesRemaining: 22, // Vence em 22 min!
    lastUpdateHoursAgo: 0.4,
    daysStagnant: 0,
    urgencyReason: 'Vence em 22 min (SLA em risco)'
  },
  {
    id: 'tk-0892',
    number: '#TK-0892',
    title: 'Inconsistência de esquema no endpoint do portal de transparência',
    account: 'Câmara Municipal de Sorocaba',
    category: 'API Pública & Dados',
    priority: 'P3',
    requestType: 'Problema Conhecido',
    createdAt: '11/10 14:15',
    firstAction: 'Solicitado alinhamento de contrato OpenAPI com a equipe externa',
    status: 'Bloqueado',
    assignee: { name: 'Mariana Duarte' },
    slaMinutesRemaining: 180,
    lastUpdateHoursAgo: 288, // 12 dias atrás
    daysStagnant: 12, // > 10 dias
    urgencyReason: 'Parado há 12 dias • Bloqueado externamente',
    isBlocked: true,
    blockReason: 'Aguardando publicação do novo schema OpenAPI pelo órgão regulador'
  },
  {
    id: 'tk-0904',
    number: '#TK-0904',
    title: 'Migração de histórico legadado de cadastros e registros',
    account: 'Prefeitura de Bauru',
    category: 'Banco de Dados & Carga',
    priority: 'P3',
    requestType: 'Requisição',
    createdAt: '10/10 09:30',
    firstAction: 'Script de sanitização falhou na tabela de chaves primárias duplicadas',
    status: 'Em Atendimento',
    assignee: { name: 'Lucas Siqueira' },
    slaMinutesRemaining: 240,
    lastUpdateHoursAgo: 312,
    daysStagnant: 13, // > 10 dias
    urgencyReason: 'Parado há 13 dias • Sem avanço',
    isProductBacklog: true,
    backlogIssueKey: 'ENG-4891'
  },
  {
    id: 'tk-1099',
    number: '#TK-1099',
    title: 'Exportação massiva de logs de auditoria gera timeout de rede HTTP 504',
    account: 'Prefeitura de Joinville',
    category: 'Auditoria & Logs',
    priority: 'P2',
    requestType: 'Falha de Sistema',
    createdAt: '24/10 11:48',
    firstAction: 'Chamado recebido via monitoramento; aguardando despacho de analista',
    status: 'Aberto',
    assignee: { name: 'Sem Responsável', isUnassigned: true },
    slaMinutesRemaining: 28,
    lastUpdateHoursAgo: 0.1,
    daysStagnant: 0,
    urgencyReason: 'Sem responsável • Vence em 28 min'
  },
  {
    id: 'tk-0911',
    number: '#TK-0911',
    title: 'Assinatura digital de atos oficiais falha com tokens modelo SafeNet',
    account: 'Governo do Estado (Casa Civil)',
    category: 'Certificação Digital',
    priority: 'P2',
    requestType: 'Problema Conhecido',
    createdAt: '12/10 16:00',
    firstAction: 'Bug replicado no driver v10.8; repassado para time de engenharia',
    status: 'Bloqueado',
    assignee: { name: 'Carlos Albuquerque' },
    slaMinutesRemaining: 320,
    lastUpdateHoursAgo: 264,
    daysStagnant: 11,
    urgencyReason: 'Parado há 11 dias • Bloqueado em Produto',
    isBlocked: true,
    blockReason: 'Dependência da release de firmware pelo fabricante SafeNet',
    isProductBacklog: true,
    backlogIssueKey: 'ENG-5120'
  },
  {
    id: 'tk-1048',
    number: '#TK-1048',
    title: 'Falha na sincronização de permissões de usuários federados (SAML 2.0)',
    account: 'Prefeitura de Piracicaba',
    category: 'Segurança & Identidade',
    priority: 'P3',
    requestType: 'Dúvida Operacional',
    createdAt: '21/10 14:10',
    firstAction: 'Solicitado log de assertions XML do IdP do cliente para análise',
    status: 'Aguardando Cliente',
    assignee: { name: 'Beatriz Fonseca' },
    slaMinutesRemaining: 480,
    lastUpdateHoursAgo: 72,
    daysStagnant: 3,
    urgencyReason: 'Aguardando complemento há 3 dias',
    needsManagerReview: false
  },
  {
    id: 'tk-1077',
    number: '#TK-1077',
    title: 'Falha no gateway de envio de SMS para confirmação de agendamentos',
    account: 'Secretaria Estadual de Governo',
    category: 'Mensageria & Notificações',
    priority: 'P2',
    requestType: 'Incidente Crítico',
    createdAt: '24/10 10:20',
    firstAction: 'Rota primária da operadora restabelecida; verificando reenvio',
    status: 'Em Atendimento',
    assignee: { name: 'Beatriz Fonseca' },
    slaMinutesRemaining: 45,
    lastUpdateHoursAgo: 0.5,
    daysStagnant: 0,
    urgencyReason: 'Vence em 45 min • Chamado vinculado a #TK-1076',
    isSimilarOrChild: true,
    parentTicketNumber: '#TK-1076'
  },
  {
    id: 'tk-0988',
    number: '#TK-0988',
    title: 'Solicitação de permissão de superadministrador para novo auditor',
    account: 'Tribunal de Contas Municipal',
    category: 'Controle de Acessos',
    priority: 'P3',
    requestType: 'Requisição',
    createdAt: '19/10 11:20',
    firstAction: 'Termo de responsabilidade anexado; aguarda aprovação gerencial',
    status: 'Em Atendimento',
    assignee: { name: 'Sem Responsável', isUnassigned: true },
    slaMinutesRemaining: 180,
    lastUpdateHoursAgo: 120,
    daysStagnant: 5,
    urgencyReason: 'Exige revisão do gestor • Sem responsável',
    needsManagerReview: true,
    managerReviewReason: 'Acesso com privilégios de auditoria requer aprovação formal do gestor'
  }
];

export const MOCK_ACCOUNTS = [
  'Todas as contas',
  'Prefeitura de Campinas (SEFAZ)',
  'Secretaria Estadual de Saúde (SES)',
  'Prefeitura de Santos',
  'Prefeitura de Florianópolis',
  'Prefeitura de Ribeirão Preto',
  'Prefeitura de São José dos Campos',
  'Prefeitura de Bauru',
  'Governo do Estado (Casa Civil)',
  'Tribunal de Contas Municipal'
];
