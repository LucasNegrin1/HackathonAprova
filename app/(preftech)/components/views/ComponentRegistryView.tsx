import React, { useState } from 'react';
import { useEngine } from '../../engine/EngineContext';
import { getAllRegistryItems } from '../../engine/registry';
import { Plus, Check, Layers, Box } from 'lucide-react';
import './views.css';

export const ComponentRegistryView: React.FC = () => {
  const { addNode, setMode } = useEngine();
  const items = getAllRegistryItems();
  const [addedItem, setAddedItem] = useState<string | null>(null);

  const handleAdd = (type: string) => {
    addNode(type);
    setAddedItem(type);
    setTimeout(() => setAddedItem(null), 2000);
  };

  return (
    <div className="view-container animate-fade-in">
      <div className="view-header">
        <div>
          <h2 className="view-title">Catálogo de Blocos do Front Engine</h2>
          <p className="view-subtitle">
            Componentes registrados e prontos para composição modular de telas e fluxos.
          </p>
        </div>
        <button className="btn-secondary-view" onClick={() => setMode('canvas')}>
          <Layers size={14} /> Voltar ao Studio
        </button>
      </div>

      <div className="registry-cards-grid">
        {items.map((item) => {
          const isRecentlyAdded = addedItem === item.type;
          return (
            <div key={item.type} className="registry-card">
              <div className="registry-card-top">
                <div className="registry-icon-badge">
                  <Box size={20} />
                </div>
                <span className="badge badge-primary">{item.category}</span>
              </div>
              <div className="registry-card-info">
                <h3 className="registry-card-title">{item.title}</h3>
                <p className="registry-card-desc">{item.description}</p>
                <div className="registry-type-pill font-mono">type: "{item.type}"</div>
              </div>
              <div className="registry-card-footer">
                <button
                  className={`btn-primary ${isRecentlyAdded ? 'btn-success-added' : ''}`}
                  onClick={() => handleAdd(item.type)}
                >
                  {isRecentlyAdded ? (
                    <>
                      <Check size={15} /> Bloco Adicionado!
                    </>
                  ) : (
                    <>
                      <Plus size={15} /> Inserir no Canvas
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
