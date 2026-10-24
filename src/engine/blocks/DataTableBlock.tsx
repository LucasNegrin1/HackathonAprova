import React, { useState } from 'react';
import type { EngineNode } from '../types';
import { Search, Eye, Download } from 'lucide-react';
import './blocks.css';

interface DataTableProps {
  node: EngineNode;
  onEvent: (eventType: string, payload?: any) => void;
}

export const DataTableBlock: React.FC<DataTableProps> = ({ node, onEvent }) => {
  const initialData = [
    { id: 'PR-8921', doc: 'Certidão Negativa Tributária', requester: 'Construtora Metropolitana', status: 'Concluído', date: 'Hoje, 10:42' },
    { id: 'PR-8922', doc: 'Licenciamento Ambiental Simplificado', requester: 'AgroSul S/A', status: 'Em Análise', date: 'Hoje, 09:15' },
    { id: 'PR-8923', doc: 'Inscrição Municipal PJ', requester: 'Inova Softwares Ltda', status: 'Triagem', date: 'Ontem, 17:30' },
    { id: 'PR-8924', doc: 'Consulta de Zoneamento Urbano', requester: 'Arquitetura & Urbanismo', status: 'Concluído', date: 'Ontem, 14:10' },
    { id: 'PR-8925', doc: 'Renovação de Habite-se Residencial', requester: 'Carlos Eduardo Silveira', status: 'Pendente Doc', date: '22 Out, 11:05' }
  ];

  const [searchTerm, setSearchTerm] = useState('');
  const [data] = useState(initialData);

  const filteredData = data.filter((item) => 
    item.doc.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.requester.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRowClick = (item: any) => {
    onEvent('ROW_SELECTED', { nodeId: node.id, item });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Concluído':
        return <span className="status-badge badge-done">Concluído</span>;
      case 'Em Análise':
        return <span className="status-badge badge-progress">Em Análise</span>;
      case 'Triagem':
        return <span className="status-badge badge-triagem">Triagem</span>;
      default:
        return <span className="status-badge badge-pending">Pendente Doc</span>;
    }
  };

  return (
    <div className="engine-card datatable-block">
      <div className="card-header">
        <div>
          <h4 className="card-title">{node.title || 'Fila Unificada de Processos Eletrônicos'}</h4>
          <p className="card-subtitle">Grid reativo sincronizado com eventos da orquestração</p>
        </div>
        <div className="table-top-actions">
          <div className="search-box">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Filtrar por protocolo ou requerente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="table-search-input"
            />
          </div>
          <button 
            className="btn-icon" 
            title="Exportar CSV"
            onClick={() => onEvent('EXPORT_DATA_REQUESTED', { count: filteredData.length })}
          >
            <Download size={15} />
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="engine-table">
          <thead>
            <tr>
              <th>Protocolo</th>
              <th>Assunto / Documento</th>
              <th>Requerente</th>
              <th>Status</th>
              <th>Data</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map((row) => (
                <tr key={row.id} onClick={() => handleRowClick(row)}>
                  <td className="protocol-cell font-mono">{row.id}</td>
                  <td className="doc-cell">{row.doc}</td>
                  <td className="requester-cell">{row.requester}</td>
                  <td>{getStatusBadge(row.status)}</td>
                  <td className="date-cell text-muted">{row.date}</td>
                  <td className="text-right action-cell">
                    <button 
                      className="btn-table-action" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onEvent('VIEW_DOCUMENT_DETAILS', { id: row.id, doc: row.doc });
                      }}
                      title="Ver detalhes"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="empty-row">Nenhum protocolo encontrado com o termo "{searchTerm}".</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
