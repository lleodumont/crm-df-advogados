import { describe, it, expect } from 'vitest';

interface Lead {
  id: string;
  status: string;
  score_total: number;
  classification: string;
}

function filterLeads(leads: Lead[], filters: { status: string; scoreMin: number; scoreMax: number }) {
  return leads.filter(l => {
    if (filters.status !== 'all' && l.status !== filters.status) return false;
    if (l.score_total < filters.scoreMin) return false;
    if (l.score_total > filters.scoreMax) return false;
    return true;
  });
}

const mockLeads: Lead[] = [
  { id: '1', status: 'novo', score_total: 85, classification: 'estrategico' },
  { id: '2', status: 'qualificado', score_total: 55, classification: 'qualificado' },
  { id: '3', status: 'novo', score_total: 20, classification: 'morno' },
];

describe('Filtros de Leads', () => {
  it('deve retornar todos com status "all"', () => {
    const result = filterLeads(mockLeads, { status: 'all', scoreMin: 0, scoreMax: 100 });
    expect(result).toHaveLength(3);
  });

  it('deve filtrar por status', () => {
    const result = filterLeads(mockLeads, { status: 'novo', scoreMin: 0, scoreMax: 100 });
    expect(result).toHaveLength(2);
  });

  it('deve filtrar por score mínimo', () => {
    const result = filterLeads(mockLeads, { status: 'all', scoreMin: 50, scoreMax: 100 });
    expect(result).toHaveLength(2);
  });

  it('deve filtrar por range de score', () => {
    const result = filterLeads(mockLeads, { status: 'all', scoreMin: 50, scoreMax: 70 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });
});
