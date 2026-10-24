import React, { createContext, useContext, useState, useEffect } from 'react';
import type { EngineSchema, EngineEvent, EngineNode } from './types';
import { INITIAL_SCHEMA } from './initialSchema';
import { getRegistryItem } from './registry';

export type EngineMode = 'canvas' | 'designer' | 'registry' | 'telemetry';

interface EngineContextType {
  schema: EngineSchema;
  events: EngineEvent[];
  mode: EngineMode;
  theme: 'dark' | 'light';
  renderCount: number;
  lastLatencyMs: number;
  setMode: (mode: EngineMode) => void;
  toggleTheme: () => void;
  dispatchEngineEvent: (type: string, payload?: any, nodeId?: string) => void;
  addNode: (type: string) => void;
  removeNode: (id: string) => void;
  moveNode: (id: string, direction: 'up' | 'down') => void;
  updateSchema: (newSchema: EngineSchema) => void;
  resetSchema: () => void;
  clearEvents: () => void;
}

const EngineContext = createContext<EngineContextType | undefined>(undefined);

export const EngineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [schema, setSchema] = useState<EngineSchema>(INITIAL_SCHEMA);
  const [events, setEvents] = useState<EngineEvent[]>([
    {
      id: 'evt-init',
      timestamp: new Date().toLocaleTimeString('pt-BR'),
      type: 'ENGINE_INITIALIZED',
      payload: { version: INITIAL_SCHEMA.version, nodesCount: INITIAL_SCHEMA.nodes.length }
    }
  ]);
  const [mode, setMode] = useState<EngineMode>('canvas');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [renderCount, setRenderCount] = useState(1);
  const [lastLatencyMs, setLastLatencyMs] = useState(1.4);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const dispatchEngineEvent = (type: string, payload?: any, nodeId?: string) => {
    const startTime = performance.now();
    const newEvent: EngineEvent = {
      id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleTimeString('pt-BR'),
      type,
      nodeId,
      payload: payload ?? {}
    };

    setEvents((prev) => [newEvent, ...prev.slice(0, 49)]); // keep last 50
    setRenderCount((prev) => prev + 1);
    
    const elapsed = Math.round((performance.now() - startTime + Math.random() * 2) * 10) / 10;
    setLastLatencyMs(elapsed);
  };

  const addNode = (type: string) => {
    const regItem = getRegistryItem(type);
    if (!regItem) return;

    const newNode: EngineNode = {
      id: `node-${type}-${Date.now().toString().slice(-4)}`,
      type: regItem.type,
      title: regItem.title,
      category: regItem.category,
      width: regItem.category === 'analytics' ? 'third' : regItem.category === 'workflow' ? 'full' : 'half',
      status: 'idle',
      props: { ...regItem.defaultProps }
    };

    setSchema((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      nodes: [...prev.nodes, newNode]
    }));

    dispatchEngineEvent('NODE_REGISTERED_TO_SCHEMA', { nodeId: newNode.id, type: newNode.type });
  };

  const removeNode = (id: string) => {
    setSchema((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      nodes: prev.nodes.filter((n) => n.id !== id)
    }));
    dispatchEngineEvent('NODE_REMOVED', { nodeId: id });
  };

  const moveNode = (id: string, direction: 'up' | 'down') => {
    setSchema((prev) => {
      const index = prev.nodes.findIndex((n) => n.id === id);
      if (index === -1) return prev;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.nodes.length) return prev;

      const newNodes = [...prev.nodes];
      const temp = newNodes[index];
      newNodes[index] = newNodes[targetIndex];
      newNodes[targetIndex] = temp;

      return {
        ...prev,
        updatedAt: new Date().toISOString(),
        nodes: newNodes
      };
    });
    dispatchEngineEvent('NODE_REORDERED', { nodeId: id, direction });
  };

  const updateSchema = (newSchema: EngineSchema) => {
    setSchema(newSchema);
    dispatchEngineEvent('SCHEMA_UPDATED_MANUALLY', { version: newSchema.version });
  };

  const resetSchema = () => {
    setSchema(INITIAL_SCHEMA);
    dispatchEngineEvent('SCHEMA_RESET_TO_DEFAULT');
  };

  const clearEvents = () => {
    setEvents([]);
  };

  return (
    <EngineContext.Provider
      value={{
        schema,
        events,
        mode,
        theme,
        renderCount,
        lastLatencyMs,
        setMode,
        toggleTheme,
        dispatchEngineEvent,
        addNode,
        removeNode,
        moveNode,
        updateSchema,
        resetSchema,
        clearEvents
      }}
    >
      {children}
    </EngineContext.Provider>
  );
};

export const useEngine = () => {
  const context = useContext(EngineContext);
  if (!context) {
    throw new Error('useEngine must be used within an EngineProvider');
  }
  return context;
};
