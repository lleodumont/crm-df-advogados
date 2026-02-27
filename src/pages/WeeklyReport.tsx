import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, TrendingDown, Target, AlertTriangle } from 'lucide-react';

export default function WeeklyReport() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      generateReport();
    }
  }, [startDate, endDate]);

  const generateReport = async () => {
    setLoading(true);
    try {
      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59');

      const { data: meetings } = await supabase
        .from('meetings')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59');

      const { data: proposals } = await supabase
        .from('proposals')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59');

      const totalLeads = leads?.length || 0;
      const qualificados = leads?.filter(l => l.classification === 'qualificado').length || 0;
      const estrategicos = leads?.filter(l => l.classification === 'estrategico').length || 0;

      const agendados = meetings?.filter(m => m.status !== 'canceled').length || 0;
      const realizadas = meetings?.filter(m => m.status === 'held').length || 0;
      const noShow = meetings?.filter(m => m.status === 'no_show').length || 0;

      const propostas = proposals?.length || 0;
      const ganhos = proposals?.filter(p => p.status === 'won').length || 0;
      const perdidos = proposals?.filter(p => p.status === 'lost').length || 0;

      const receita = proposals?.filter(p => p.status === 'won').reduce((sum, p) => sum + p.value, 0) || 0;
      const ticketMedio = ganhos > 0 ? receita / ganhos : 0;

      const conversaoLeadToMeeting = totalLeads > 0 ? (agendados / totalLeads) * 100 : 0;
      const conversaoMeetingToProposal = realizadas > 0 ? (propostas / realizadas) * 100 : 0;
      const conversaoProposalToWon = propostas > 0 ? (ganhos / propostas) * 100 : 0;

      const gargalo =
        conversaoLeadToMeeting < 20 ? 'Lead → Agendamento' :
        conversaoMeetingToProposal < 50 ? 'Reunião → Proposta' :
        conversaoProposalToWon < 30 ? 'Proposta → Fechamento' :
        'Nenhum gargalo crítico';

      const acoes = [];
      if (conversaoLeadToMeeting < 20) {
        acoes.push('Melhorar triagem e qualificação de leads antes do agendamento');
      }
      if (noShow > agendados * 0.3) {
        acoes.push('Implementar confirmação de reuniões 24h antes para reduzir no-show');
      }
      if (conversaoProposalToWon < 30) {
        acoes.push('Revisar precificação e estrutura de propostas com a equipe comercial');
      }
      if (estrategicos > 0 && ganhos === 0) {
        acoes.push('Priorizar atendimento aos leads qualificados de alto valor com score alto');
      }
      if (totalLeads > 0 && agendados === 0) {
        acoes.push('Acelerar processo de triagem e agendamento de leads');
      }
      if (acoes.length === 0) {
        acoes.push('Manter o ritmo atual e continuar acompanhando métricas');
        acoes.push('Investir em captação de leads qualificados');
        acoes.push('Documentar processos que estão funcionando bem');
      }

      setReportData({
        totalLeads,
        qualificados,
        estrategicos,
        agendados,
        realizadas,
        noShow,
        propostas,
        ganhos,
        perdidos,
        receita,
        ticketMedio,
        conversaoLeadToMeeting,
        conversaoMeetingToProposal,
        conversaoProposalToWon,
        gargalo,
        acoes: acoes.slice(0, 3),
      });
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Gerando relatório...</div>
      </div>
    );
  }

  if (!reportData) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Relatório Semanal</h1>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-600">até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Resumo Executivo</h2>

        <div className="prose max-w-none">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Visão Geral</h3>
          <p className="text-gray-700 mb-4">
            No período de {new Date(startDate).toLocaleDateString('pt-BR')} a {new Date(endDate).toLocaleDateString('pt-BR')},
            recebemos <strong>{reportData.totalLeads} leads</strong>, sendo{' '}
            <strong>{reportData.qualificados} qualificados</strong> e{' '}
            <strong>{reportData.estrategicos} qualificados de alto valor</strong>.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mb-3">Reuniões</h3>
          <p className="text-gray-700 mb-4">
            Foram agendadas <strong>{reportData.agendados} reuniões</strong>, com{' '}
            <strong>{reportData.realizadas} realizadas</strong> e{' '}
            <strong>{reportData.noShow} no-shows</strong>.
            {reportData.agendados > 0 && (
              <> O show rate foi de <strong>{((reportData.realizadas / reportData.agendados) * 100).toFixed(1)}%</strong>.</>
            )}
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mb-3">Propostas e Resultados</h3>
          <p className="text-gray-700 mb-4">
            Apresentamos <strong>{reportData.propostas} propostas</strong>, com{' '}
            <strong>{reportData.ganhos} ganhos</strong> e{' '}
            <strong>{reportData.perdidos} perdidos</strong>.
            {reportData.propostas > 0 && (
              <> A taxa de fechamento foi de <strong>{reportData.conversaoProposalToWon.toFixed(1)}%</strong>.</>
            )}
          </p>

          {reportData.receita > 0 && (
            <p className="text-gray-700 mb-4">
              A receita total foi de <strong>R$ {reportData.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>,
              com ticket médio de <strong>R$ {reportData.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.
            </p>
          )}

          <div className="bg-gray-50 rounded-lg p-6 my-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Funil de Conversão
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">Lead → Agendamento</span>
                  <span className="font-medium text-gray-900">{reportData.conversaoLeadToMeeting.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${reportData.conversaoLeadToMeeting < 20 ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(reportData.conversaoLeadToMeeting, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">Reunião → Proposta</span>
                  <span className="font-medium text-gray-900">{reportData.conversaoMeetingToProposal.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${reportData.conversaoMeetingToProposal < 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(reportData.conversaoMeetingToProposal, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">Proposta → Fechamento</span>
                  <span className="font-medium text-gray-900">{reportData.conversaoProposalToWon.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${reportData.conversaoProposalToWon < 30 ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(reportData.conversaoProposalToWon, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 my-6">
            <h3 className="text-lg font-semibold text-yellow-900 mb-3 flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              Gargalo Principal
            </h3>
            <p className="text-yellow-800 font-medium">{reportData.gargalo}</p>
            <p className="text-sm text-yellow-700 mt-2">
              Esta é a etapa com maior queda de conversão que requer atenção imediata.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 my-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Ações Recomendadas
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-blue-800">
              {reportData.acoes.map((acao: string, index: number) => (
                <li key={index} className="font-medium">{acao}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
