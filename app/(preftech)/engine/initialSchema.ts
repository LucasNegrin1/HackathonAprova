import type { EngineSchema } from './types';

export const INITIAL_SCHEMA: EngineSchema = {
  id: 'schema-gov-001',
  title: 'PrefTech Municipal Core Engine',
  version: '1.2.0',
  author: 'Engenharia PrefTech',
  updatedAt: new Date().toISOString(),
  settings: {
    refreshIntervalMs: 5000,
    allowLiveEdit: true,
    layout: 'grid'
  },
  nodes: [
    {
      id: 'node-metric-1',
      type: 'metrics-card',
      title: 'Processos Protocolados',
      category: 'analytics',
      width: 'third',
      status: 'idle',
      props: {
        label: 'Processos Protocolados',
        value: '14.820',
        change: '+12.6%',
        isPositive: true
      }
    },
    {
      id: 'node-metric-2',
      type: 'metrics-card',
      title: 'Tempo Médio de Resolução',
      category: 'analytics',
      width: 'third',
      status: 'idle',
      props: {
        label: 'Tempo Médio de Resposta',
        value: '2.4 dias',
        change: '-35.1%',
        isPositive: true
      }
    },
    {
      id: 'node-metric-3',
      type: 'metrics-card',
      title: 'Economia Digital Gerada',
      category: 'analytics',
      width: 'third',
      status: 'idle',
      props: {
        label: 'Economia em Papel & Transporte',
        value: 'R$ 480k',
        change: '+28.4%',
        isPositive: true
      }
    },
    {
      id: 'node-stepper-1',
      type: 'workflow-stepper',
      title: 'Motor de Decisão & Workflow',
      category: 'workflow',
      width: 'full',
      status: 'idle',
      props: {
        currentStep: 1,
        steps: [
          { id: '1', name: 'Triagem Digital', desc: 'Validação e indexação inicial de dados' },
          { id: '2', name: 'Análise de Conformidade', desc: 'Verificação com regras de negócio e LGPD' },
          { id: '3', name: 'Parecer Técnico', desc: 'Despacho automatizado do motor de decisão' },
          { id: '4', name: 'Publicação & Notificação', desc: 'Envio ao cidadão e repositório oficial' }
        ]
      }
    },
    {
      id: 'node-form-1',
      type: 'form-builder',
      title: 'Entrada de Dados & Assinatura',
      category: 'input',
      width: 'half',
      status: 'idle',
      props: {}
    },
    {
      id: 'node-api-1',
      type: 'api-connector',
      title: 'Gateway de Integração Governamental',
      category: 'system',
      width: 'half',
      status: 'idle',
      props: {}
    },
    {
      id: 'node-table-1',
      type: 'data-table',
      title: 'Processos em Tramitação Digital',
      category: 'data',
      width: 'full',
      status: 'idle',
      props: {}
    }
  ]
};
