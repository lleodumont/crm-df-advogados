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

    const getLocalDateString = (date: Date) => {
      return new Intl.DateTimeFormat('sv-SE').format(date);
    };

    setStartDate(getLocalDateString(start));
    setEndDate(getLocalDateString(end));
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      generateReport();
    }
  }, [startDate, endDate]);

  const generateReport = async () => {
    setLoading(true);
    try {
      // Calculate start and end of week in ISO format for Supabase queries
      const startOfWeek = new Date(startDate);
      startOfWeek.setHours(0, 0, 0, 0);
      const startOfWeekISO = startOfWeek.toISOString();

      const endOfWeek = new Date(endDate);
      endOfWeek.setHours(23, 59, 59, 999);
      const endOfWeekISO = endOfWeek.toISOString();

      const { data: leads } = await (supabase.from('leads').select('*') as any);
      const { data: meetingsRaw } = await (supabase.from('meetings').select('*').gte('scheduled_at', startOfWeekISO).lte('scheduled_at', endOfWeekISO) as any);
      const { data: scheduledMeetingsRaw } = await (supabase.from('scheduled_activities').select('*').eq('activity_type', 'meeting').gte('scheduled_at', startOfWeekISO).lte('scheduled_at', endOfWeekISO) as any);
      const meetings = [
        ...(meetingsRaw || []),
        ...(scheduledMeetingsRaw || []).map((a: any) => ({
          ...a,
          status: a.status === 'completed' ? 'held' : a.status === 'cancelled' ? 'canceled' : a.status,
        })),
      ];
      const { data: proposals } = await (supabase.from('proposals').select('*').gte('presented_at', startOfWeekISO).lte('presented_at', endOfWeekISO) as any);
      const { data: ganhos } = await (supabase.from('leads').select('*').eq('status', 'ganho').gte('closed_at', startOfWeekISO).lte('closed_at', endOfWeekISO) as any);

      const totalLeads = leads?.filter((l: any) => l.created_at >= startOfWeekISO && l.created_at <= endOfWeekISO).length || 0;
      
      const qualificadosQuery = leads?.filter((l: any) => 
        l.created_at >= startOfWeekISO && 
        l.created_at <= endOfWeekISO && 
        (l.classification === 'qualificado' || !['novo', 'triagem'].includes(l.status))
      ) || [];
      const qualificados = qualificadosQuery.length;
      
      const estrategicos = leads?.filter((l: any) => 
        l.created_at >= startOfWeekISO && 
        l.created_at <= endOfWeekISO && 
        l.classification === 'estrategico'
      ).length || 0;

      const agendados = meetings?.length || 0;
      const realizadas = meetings?.filter((m: any) => m.status === 'held').length || 0;
      const noShow = meetings?.filter((m: any) => m.status === 'no_show').length || 0;

      const propostas = proposals?.length || 0;
      const totalGanhos = ganhos?.length || 0;
      const perdidos = proposals?.filter((p: any) => p.status === 'lost').length || 0;

      const receita = proposals?.filter((p: any) => p.status === 'won').reduce((sum: number, p: any) => sum + (p.value || 0), 0) || 0;
      const ticketMedio = totalGanhos > 0 ? receita / totalGanhos : 0;

      const conversaoLeadToMeeting = (qualificados + estrategicos) > 0 ? (agendados / (qualificados + estrategicos)) * 100 : 0;
      const conversaoMeetingToProposal = realizadas > 0 ? (propostas / realizadas) * 100 : 0;
      const conversaoProposalToWon = propostas > 0 ? (totalGanhos / propostas) * 100 : 0;

      // Buscar leads parados via view
      const { data: staleLeads } = await supabase.from('vw_stale_strategic_leads').select('*').limit(5);

      const gargalo =
        conversaoLeadToMeeting < 20 ? 'Lead → Agendamento (Baixa conversão na triagem)' :
        conversaoMeetingToProposal < 50 ? 'Reunião → Proposta (Gargalo na apresentação de valor)' :
        conversaoProposalToWon < 30 ? 'Proposta → Fechamento (Dificuldade no fechamento/negociação)' :
        (staleLeads && staleLeads.length > 0) ? 'Velocidade (Leads estratégicos sem contato > 24h)' :
        'Nenhum gargalo crítico';

      const acoes = [];
      
      // Lógica Dinâmica baseada em Leads Parados
      if (staleLeads && staleLeads.length > 0) {
        acoes.push(`Retomar contato imediato com ${staleLeads.length} leads estratégicos parados há mais de 24h`);
      }

      // Lógica baseada em Taxas
      if (conversaoLeadToMeeting < 20) {
        acoes.push('Revisar script de triagem: leads não estão vendo valor no agendamento');
      }
      if (noShow > agendados * 0.3) {
        acoes.push('Ativar lembretes automáticos: show rate está abaixo do benchmark (70%)');
      }
      if (conversaoProposalToWon < 30 && perdidos > 0) {
        acoes.push('Analisar motivos de perda: taxa de fechamento de propostas está baixa');
      }
      
      // Lógica de Priorização
      if (estrategicos > 0 && agendados < estrategicos * 0.5) {
        acoes.push('Foco Total: Menos de 50% dos leads estratégicos possuem reunião agendada');
      }

      if (acoes.length === 0) {
        acoes.push('Manter cadência: processo está saudável e dentro dos benchmarks');
        acoes.push('Explorar novos canais: capacidade ociosa detectada no funil');
      }

      setReportData({
        totalLeads,
        qualificados,
        estrategicos,
        agendados,
        realizadas,
        noShow,
        propostas,
        ganhos: totalGanhos,
        perdidos,
        receita,
        ticketMedio,
        conversaoLeadToMeeting,
        conversaoMeetingToProposal,
        conversaoProposalToWon,
        gargalo,
        acoes: acoes.slice(0, 3),
        staleLeadsCount: staleLeads?.length || 0
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
            <strong>{reportData.estrategicos} super qualificados</strong>.
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
