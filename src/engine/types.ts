export type BlockCategory = 'analytics' | 'input' | 'workflow' | 'data' | 'system';

export type NodeStatus = 'idle' | 'executing' | 'success' | 'error';

export interface EngineNode {
  id: string;
  type: string;
  title: string;
  category: BlockCategory;
  width: 'full' | 'half' | 'third';
  status?: NodeStatus;
  props: Record<string, any>;
}

export interface EngineSchema {
  id: string;
  title: string;
  version: string;
  author: string;
  updatedAt: string;
  settings: {
    refreshIntervalMs?: number;
    allowLiveEdit: boolean;
    layout: 'grid' | 'linear';
  };
  nodes: EngineNode[];
}

export interface EngineEvent {
  id: string;
  timestamp: string;
  type: string;
  nodeId?: string;
  payload: any;
}

export interface RegistryItem {
  type: string;
  title: string;
  description: string;
  category: BlockCategory;
  icon: string;
  defaultProps: Record<string, any>;
  component: React.ComponentType<{ node: EngineNode; onEvent: (eventType: string, payload?: any) => void }>;
}
