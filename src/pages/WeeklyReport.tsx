import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, TrendingDown, Target, AlertTriangle, ArrowDown } from 'lucide-react';

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

      const { data: leads } = await (supabase.from('leads').select('*').limit(5000) as any);
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

      // Funil cumulativo (leads do período, contagem cumulativa por etapa)
      const periodLeads = leads?.filter((l: any) => l.created_at >= startOfWeekISO && l.created_at <= endOfWeekISO) || [];
      const hasStatus = (statuses: string[]) => periodLeads.filter((l: any) => statuses.includes(l.status)).length;

      const funnelStages = [
        { label: 'Leads Captados',   count: totalLeads },
        { label: 'Qualificados',     count: hasStatus(['qualificado','agendado','compareceu','no_show','proposta_enviada','ganho','perdido']) },
        { label: 'Agendamentos',     count: hasStatus(['agendado','compareceu','no_show','proposta_enviada','ganho','perdido']) },
        { label: 'Comparecidas',     count: hasStatus(['compareceu','proposta_enviada','ganho','perdido']) },
        { label: 'Proposta na Mesa', count: hasStatus(['proposta_enviada','ganho','perdido']) },
        { label: 'Negócio Fechado',  count: hasStatus(['ganho']) },
      ];

      // Buscar leads parados via view
      const { data: staleLeads } = await supabase.from('vw_stale_strategic_leads').select('*').limit(5);

      const gargaloInfo: { titulo: string; descricao: string } =
        conversaoLeadToMeeting < 20
          ? {
              titulo: 'Triagem → Agendamento',
              descricao: `Apenas ${conversaoLeadToMeeting.toFixed(1)}% dos leads qualificados chegam a agendar uma reunião. O benchmark saudável é ≥ 30%. Possíveis causas: abordagem inicial fraca, demora no primeiro contato ou script de triagem sem urgência. Ação: revisar o primeiro contato e reduzir o tempo entre o lead chegar e o WhatsApp ser enviado.`,
            }
          : conversaoMeetingToProposal < 50
          ? {
              titulo: 'Reunião → Proposta',
              descricao: `Apenas ${conversaoMeetingToProposal.toFixed(1)}% das reuniões realizadas resultam em proposta. O benchmark saudável é ≥ 60%. Possíveis causas: reunião sem fechamento claro, cliente não percebeu valor suficiente ou consultor não trouxe proposta na mesma sessão. Ação: treinar fechamento da reunião e sempre sair com próximo passo definido.`,
            }
          : conversaoProposalToWon < 30
          ? {
              titulo: 'Proposta → Fechamento',
              descricao: `Apenas ${conversaoProposalToWon.toFixed(1)}% das propostas apresentadas resultam em contrato assinado. O benchmark saudável é ≥ 40%. Possíveis causas: preço percebido como alto, cliente sem urgência real ou proposta enviada sem follow-up estruturado. Ação: analisar motivos de perda e implementar sequência de follow-up pós-proposta.`,
            }
          : staleLeads && staleLeads.length > 0
          ? {
              titulo: 'Velocidade de Contato',
              descricao: `${staleLeads.length} lead(s) estratégico(s) estão sem contato há mais de 24h. Leads com score alto perdem temperatura rapidamente — a janela ideal de retorno é de até 1h após o interesse demonstrado. Ação: contato imediato com esses leads, priorizando os de maior score.`,
            }
          : {
              titulo: 'Nenhum gargalo crítico',
              descricao: 'O funil está operando dentro dos benchmarks esperados. Continue monitorando a cadência de follow-ups e a qualidade dos agendamentos.',
            };

      const acoes = [];
      if (staleLeads && staleLeads.length > 0)
        acoes.push(`Retomar contato imediato com ${staleLeads.length} leads estratégicos parados há mais de 24h`);
      if (conversaoLeadToMeeting < 20)
        acoes.push('Revisar script de triagem: leads não estão vendo valor no agendamento');
      if (noShow > agendados * 0.3)
        acoes.push('Ativar lembretes automáticos: show rate está abaixo do benchmark (70%)');
      if (conversaoProposalToWon < 30 && perdidos > 0)
        acoes.push('Analisar motivos de perda: taxa de fechamento de propostas está baixa');
      if (estrategicos > 0 && agendados < estrategicos * 0.5)
        acoes.push('Foco Total: Menos de 50% dos leads estratégicos possuem reunião agendada');
      if (acoes.length === 0) {
        acoes.push('Manter cadência: processo está saudável e dentro dos benchmarks');
        acoes.push('Explorar novos canais: capacidade ociosa detectada no funil');
      }

      setReportData({
        funnelStages,
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
        gargaloInfo,
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
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <h1 className="text-xl md:text-3xl font-bold text-gray-900">Relatório Semanal</h1>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Funil de Conversão
            </h3>
            <div className="space-y-1">
              {reportData.funnelStages.map((stage: { label: string; count: number }, index: number) => {
                const prev = index > 0 ? reportData.funnelStages[index - 1] : null;
                const convRate = prev && prev.count > 0 ? (stage.count / prev.count) * 100 : null;
                const maxCount = reportData.funnelStages[0]?.count || 1;
                const barWidth = maxCount > 0 ? Math.max((stage.count / maxCount) * 100, 2) : 2;
                const isLow = convRate !== null && convRate < 40;
                return (
                  <div key={stage.label}>
                    {index > 0 && (
                      <div className="flex items-center gap-2 py-1 pl-4">
                        <ArrowDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className={`text-xs font-semibold ${isLow ? 'text-red-600' : 'text-green-600'}`}>
                          {convRate !== null ? `${convRate.toFixed(1)}% converteram` : '—'}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-36 flex-shrink-0">{stage.label}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-5 relative">
                        <div
                          className={`h-5 rounded-full transition-all ${index === reportData.funnelStages.length - 1 ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-900 w-8 text-right flex-shrink-0">{stage.count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 my-6">
            <h3 className="text-lg font-semibold text-yellow-900 mb-2 flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              Gargalo Principal
            </h3>
            <p className="text-yellow-900 font-bold mb-2">{reportData.gargaloInfo.titulo}</p>
            <p className="text-yellow-800 text-sm leading-relaxed">{reportData.gargaloInfo.descricao}</p>
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
