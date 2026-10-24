import React, { useState } from 'react';
import { useEngine } from '../../engine/EngineContext';
import { getAllRegistryItems } from '../../engine/registry';
import { 
  Cpu, 
  Layers, 
  Code2, 
  Activity, 
  Boxes, 
  Plus, 
  Sun, 
  Moon, 
  Zap, 
  ChevronDown
} from 'lucide-react';
import './layout.css';

export const Header: React.FC = () => {
  const { mode, setMode, theme, toggleTheme, lastLatencyMs, addNode } = useEngine();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const registryItems = getAllRegistryItems();

  return (
    <header className="engine-header">
      <div className="header-brand">
        <div className="brand-logo-wrap">
          <Cpu className="brand-icon" size={20} />
          <div className="brand-glow" />
        </div>
        <div className="brand-text-wrap">
          <div className="brand-title-row">
            <span className="brand-title">PrefTech</span>
            <span className="brand-tag">Front Engine</span>
          </div>
          <span className="brand-status">
            <span className="status-indicator-live" />
            Core Runtime v1.2.0
          </span>
        </div>
      </div>

      <nav className="header-nav">
        <button
          className={`nav-tab ${mode === 'canvas' ? 'active' : ''}`}
          onClick={() => setMode('canvas')}
        >
          <Layers size={16} />
          <span>Canvas Studio</span>
        </button>

        <button
          className={`nav-tab ${mode === 'designer' ? 'active' : ''}`}
          onClick={() => setMode('designer')}
        >
          <Code2 size={16} />
          <span>Schema JSON</span>
        </button>

        <button
          className={`nav-tab ${mode === 'registry' ? 'active' : ''}`}
          onClick={() => setMode('registry')}
        >
          <Boxes size={16} />
          <span>Catálogo de Blocos</span>
        </button>

        <button
          className={`nav-tab ${mode === 'telemetry' ? 'active' : ''}`}
          onClick={() => setMode('telemetry')}
        >
          <Activity size={16} />
          <span>Telemetria & Eventos</span>
        </button>
      </nav>

      <div className="header-controls">
        {/* Latency Pill */}
        <div className="latency-badge" title="Tempo de despacho do ciclo de render">
          <Zap size={13} className="text-cyan" />
          <span className="font-mono">{lastLatencyMs}ms</span>
        </div>

        {/* Quick Add Node Dropdown */}
        <div className="quick-add-container">
          <button
            className="btn-quick-add"
            onClick={() => setShowAddMenu(!showAddMenu)}
          >
            <Plus size={15} />
            <span>Adicionar Bloco</span>
            <ChevronDown size={13} />
          </button>

          {showAddMenu && (
            <div className="quick-add-dropdown animate-fade-in">
              <div className="dropdown-title">Registrar Novo Bloco</div>
              {registryItems.map((item) => (
                <button
                  key={item.type}
                  className="dropdown-item"
                  onClick={() => {
                    addNode(item.type);
                    setShowAddMenu(false);
                    setMode('canvas');
                  }}
                >
                  <span className="item-name">{item.title}</span>
                  <span className="item-cat">{item.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button 
          className="btn-theme-toggle" 
          onClick={toggleTheme}
          title={`Alternar para modo ${theme === 'dark' ? 'claro' : 'escuro'}`}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
    </header>
  );
};
