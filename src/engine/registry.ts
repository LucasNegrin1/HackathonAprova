import type { RegistryItem } from './types';
import { MetricsCardBlock } from './blocks/MetricsCardBlock';
import { WorkflowStepperBlock } from './blocks/WorkflowStepperBlock';
import { FormBuilderBlock } from './blocks/FormBuilderBlock';
import { DataTableBlock } from './blocks/DataTableBlock';
import { ApiConnectorBlock } from './blocks/ApiConnectorBlock';

export const ENGINE_REGISTRY: Record<string, RegistryItem> = {
  'metrics-card': {
    type: 'metrics-card',
    title: 'Card de Métrica / KPI',
    description: 'Exibe indicadores consolidados com comparação temporal e status dinâmico.',
    category: 'analytics',
    icon: 'Activity',
    defaultProps: {
      label: 'Novas Solicitações',
      value: '2.450',
      change: '+18.4%',
      isPositive: true
    },
    component: MetricsCardBlock
  },
  'workflow-stepper': {
    type: 'workflow-stepper',
    title: 'Orquestrador de Fluxo',
    description: 'Etapas de aprovação, auditoria e execução sequencial com transições em tempo real.',
    category: 'workflow',
    icon: 'GitBranch',
    defaultProps: {
      currentStep: 1,
      steps: [
        { id: '1', name: 'Triagem Inicial', desc: 'Conferência automática de documentação' },
        { id: '2', name: 'Análise de Risco', desc: 'Consulta a bases de dados integradas' },
        { id: '3', name: 'Aprovação', desc: 'Emissão de token e assinatura' }
      ]
    },
    component: WorkflowStepperBlock
  },
  'form-builder': {
    type: 'form-builder',
    title: 'Formulário Reativo',
    description: 'Campos validados com tipagem estrita e envio com assinatura digital.',
    category: 'input',
    icon: 'FileText',
    defaultProps: {},
    component: FormBuilderBlock
  },
  'data-table': {
    type: 'data-table',
    title: 'Grid de Dados Reativo',
    description: 'Listagem de processos com filtros dinâmicos, ordenação e ações rápidas.',
    category: 'data',
    icon: 'Table',
    defaultProps: {},
    component: DataTableBlock
  },
  'api-connector': {
    type: 'api-connector',
    title: 'Gateway Conector',
    description: 'Monitoramento de integridade e latência de microserviços e barramento de integração.',
    category: 'system',
    icon: 'Server',
    defaultProps: {},
    component: ApiConnectorBlock
  }
};

export const getRegistryItem = (type: string): RegistryItem | undefined => {
  return ENGINE_REGISTRY[type];
};

export const getAllRegistryItems = (): RegistryItem[] => {
  return Object.values(ENGINE_REGISTRY);
};
