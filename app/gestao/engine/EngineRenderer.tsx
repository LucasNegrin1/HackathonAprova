import React from 'react';
import { useEngine } from './EngineContext';
import { getRegistryItem } from './registry';
import { Trash2, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import './EngineRenderer.css';

export const EngineRenderer: React.FC = () => {
  const { schema, dispatchEngineEvent, removeNode, moveNode } = useEngine();

  return (
    <div className={`engine-canvas layout-${schema.settings.layout}`}>
      <div className="canvas-nodes-grid">
        {schema.nodes.map((node, index) => {
          const registryItem = getRegistryItem(node.type);

          if (!registryItem) {
            return (
              <div key={node.id} className="engine-node-wrapper width-full error-node">
                <AlertCircle size={18} className="text-rose" />
                <span>Tipo de bloco não reconhecido no registro: <code>{node.type}</code></span>
              </div>
            );
          }

          const Component = registryItem.component;
          const widthClass = `width-${node.width || 'full'}`;

          return (
            <div key={node.id} className={`engine-node-wrapper ${widthClass} animate-fade-in`}>
              <div className="node-control-bar">
                <div className="node-meta">
                  <span className="node-category-pill">{node.category}</span>
                  <span className="node-id font-mono">{node.id}</span>
                </div>
                <div className="node-tools">
                  <button
                    className="tool-btn"
                    onClick={() => moveNode(node.id, 'up')}
                    disabled={index === 0}
                    title="Mover para cima"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    className="tool-btn"
                    onClick={() => moveNode(node.id, 'down')}
                    disabled={index === schema.nodes.length - 1}
                    title="Mover para baixo"
                  >
                    <ChevronDown size={13} />
                  </button>
                  <button
                    className="tool-btn tool-btn-danger"
                    onClick={() => removeNode(node.id)}
                    title="Remover bloco do schema"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="node-component-container">
                <Component
                  node={node}
                  onEvent={(eventType, payload) => dispatchEngineEvent(eventType, payload, node.id)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
