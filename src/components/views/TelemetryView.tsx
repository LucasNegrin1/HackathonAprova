import React, { useState } from 'react';
import { useEngine } from '../../engine/EngineContext';
import { Activity, Trash2, Radio, Terminal, Cpu, Clock } from 'lucide-react';
import './views.css';

export const TelemetryView: React.FC = () => {
  const { events, clearEvents, renderCount, lastLatencyMs, schema } = useEngine();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0];

  return (
    <div className="view-container animate-fade-in">
      <div className="view-header">
        <div>
          <h2 className="view-title">Barramento de Eventos & Telemetria</h2>
          <p className="view-subtitle">
            Rastreamento de execução reativa, dispatches de nós e performance do ciclo de render.
          </p>
        </div>
        <div className="view-actions">
          <button className="btn-secondary-view" onClick={clearEvents} disabled={events.length === 0}>
            <Trash2 size={14} /> Limpar Log
          </button>
        </div>
      </div>

      {/* Telemetry Metric Summary */}
      <div className="telemetry-stats-row">
        <div className="telemetry-kpi">
          <span className="telemetry-kpi-label"><Cpu size={14} /> Ciclos de Render</span>
          <span className="telemetry-kpi-val text-primary">{renderCount}</span>
        </div>
        <div className="telemetry-kpi">
          <span className="telemetry-kpi-label"><Clock size={14} /> Tempo Médio de Despacho</span>
          <span className="telemetry-kpi-val text-cyan">{lastLatencyMs} ms</span>
        </div>
        <div className="telemetry-kpi">
          <span className="telemetry-kpi-label"><Radio size={14} /> Total de Eventos Registrados</span>
          <span className="telemetry-kpi-val text-emerald">{events.length}</span>
        </div>
        <div className="telemetry-kpi">
          <span className="telemetry-kpi-label"><Terminal size={14} /> Versão do Engine</span>
          <span className="telemetry-kpi-val font-mono">{schema.version}</span>
        </div>
      </div>

      <div className="telemetry-split-layout">
        {/* Event List */}
        <div className="event-stream-panel">
          <div className="panel-header">
            <span>Fluxo de Mensagens ({events.length})</span>
            <span className="live-indicator"><span className="live-dot" /> LIVE</span>
          </div>
          <div className="event-list-scroll">
            {events.length > 0 ? (
              events.map((evt) => {
                const isSelected = selectedEvent?.id === evt.id;
                return (
                  <div
                    key={evt.id}
                    className={`event-item-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedEventId(evt.id)}
                  >
                    <div className="event-row-meta">
                      <span className="event-time font-mono">{evt.timestamp}</span>
                      <span className="event-badge font-mono">{evt.type}</span>
                    </div>
                    {evt.nodeId && (
                      <span className="event-node-id font-mono">origem: {evt.nodeId}</span>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="empty-events-state">
                <Activity size={24} className="text-dim" />
                <p>Nenhum evento registrado ainda.</p>
              </div>
            )}
          </div>
        </div>

        {/* Payload Inspector */}
        <div className="event-detail-panel">
          <div className="panel-header">
            <span>Inspetor de Carga Útil (Payload)</span>
            {selectedEvent && <span className="font-mono text-dim">{selectedEvent.id}</span>}
          </div>
          <div className="payload-content font-mono">
            {selectedEvent ? (
              <pre>{JSON.stringify(selectedEvent, null, 2)}</pre>
            ) : (
              <div className="no-selection-msg">Selecione um evento à esquerda para inspecionar.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
