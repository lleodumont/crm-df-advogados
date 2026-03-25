import { describe, it, expect } from 'vitest';

// Espelha a lógica de scoring do banco para testes unitários
function calculateScore({
  decision = 0,
  urgency = 0,
  assets = 0,
  fit = 0,
  behavioral = 0,
}: {
  decision?: number;
  urgency?: number;
  assets?: number;
  fit?: number;
  behavioral?: number;
}) {
  const total = Math.min(decision + urgency + assets + fit + behavioral, 100);
  const classification = total >= 70 ? 'estrategico' : total >= 40 ? 'qualificado' : 'morno';
  return { total, classification };
}

describe('Lead Scoring', () => {
  it('deve classificar como estratégico com score >= 70', () => {
    const result = calculateScore({ decision: 40, urgency: 20, assets: 10 });
    expect(result.total).toBe(70);
    expect(result.classification).toBe('estrategico');
  });

  it('deve classificar como qualificado com score entre 40 e 69', () => {
    const result = calculateScore({ decision: 25, urgency: 15 });
    expect(result.total).toBe(40);
    expect(result.classification).toBe('qualificado');
  });

  it('deve classificar como morno com score < 40', () => {
    const result = calculateScore({ decision: 5 });
    expect(result.total).toBe(5);
    expect(result.classification).toBe('morno');
  });

  it('nunca deve ultrapassar 100', () => {
    const result = calculateScore({ decision: 40, urgency: 30, assets: 25, fit: 5, behavioral: 25 });
    expect(result.total).toBe(100);
  });

  it('score comportamental aumenta com respostas WhatsApp', () => {
    const semResposta = calculateScore({ decision: 30 });
    const comResposta = calculateScore({ decision: 30, behavioral: 15 });
    expect(comResposta.total).toBeGreaterThan(semResposta.total);
  });
});
