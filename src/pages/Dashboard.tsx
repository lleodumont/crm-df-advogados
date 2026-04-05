import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Calendar, FileText, DollarSign, TrendingUp, CalendarCheck, BarChart3, Target, Zap, Award, ArrowRight, MousePointer2, PieChart } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';




interface DashboardMetrics {
  totalLeads: number;
  qualifiedCount: number;
  conversionRate: number;
  todayLeads: number;
  meetingsScheduled: number;
  totalScheduledEver: number;
  meetingsHeld: number;
  meetingsNoShow: number;
  meetingsPending: number;
  proposalsPresented: number;
  proposalsValue: number;
  dealsWon: number;
  averageTicket: number;
  totalRevenue: number;
  leadsByDay: { date: string; count: number }[];
  leadsByStatus: { status: string; name: string; color: string; count: number; percentage: number }[];
  leadsByUTMSource: { source: string; count: number }[];
  leadsByUTMMedium: { medium: string; count: number }[];
  leadsByUTMCampaign: { campaign: string; count: number }[];
  leadsByUTMContent: { content: string; count: number }[];
  leadAnswers: { question: string; answer: string; count: number }[];
  funnelData: { stage: string; count: number; percentage: number; color: string }[];
  hotLeadsCount: number;
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const { data: leads } = await (supabase.from('leads').select('*').limit(5000) as any);
      const { data: answers } = await (supabase.from('lead_answers').select('*').limit(20000) as any);
      const { data: proposals } = await (supabase.from('proposals').select('*').limit(2000) as any);
      const { data: meetingsData } = await (supabase.from('meetings').select('*').limit(2000) as any);
      const { data: scheduledMeetingsData } = await (supabase.from('scheduled_activities').select('*').eq('activity_type', 'meeting').limit(2000) as any);
      const { data: pipelineStages } = await (supabase.from('pipeline_stages').select('stage_key, name, color').order('order_index') as any);

      const getLocalDateString = (date: Date) => {
        return new Intl.DateTimeFormat('sv-SE').format(date);
      };

      const totalLeads = leads?.length || 0;
      
      const qualifiedLeads = leads?.filter((l: any) =>
        l.classification === 'qualificado' ||
        l.classification === 'estrategico'
      ) || [];
      
      const qualifiedCount = qualifiedLeads.length;
      const dealsWon = leads?.filter((l: any) => l.status === 'ganho').length || 0;
      const conversionRate = totalLeads > 0 ? (dealsWon / totalLeads) * 100 : 0;

      const today = getLocalDateString(new Date());
      const todayLeads = leads?.filter((l: any) => l.created_at.startsWith(today)).length || 0;

      // Combina meetings da tabela meetings + scheduled_activities com tipo 'meeting'
      const allMeetings = [
        ...(meetingsData || []),
        ...(scheduledMeetingsData || []).map((a: any) => ({
          ...a,
          status: a.status === 'completed' ? 'held' : a.status === 'cancelled' ? 'canceled' : a.status,
        })),
      ];
      const hasMeetingsRecords = allMeetings.length > 0;

      const meetingsScheduled = leads?.filter((l: any) => l.status === 'agendado').length || 0;

      const meetingsHeld = leads?.filter((l: any) =>
        ['compareceu', 'proposta_enviada', 'ganho', 'perdido'].includes(l.status)
      ).length || 0;

      const meetingsNoShow = leads?.filter((l: any) => l.status === 'no_show').length || 0;

      const totalScheduledEver = leads?.filter((l: any) =>
        ['agendado', 'compareceu', 'proposta_enviada', 'ganho', 'perdido'].includes(l.status)
      ).length || 0;

      const meetingsPending = meetingsScheduled;

      const proposalsPresented = leads?.filter((l: any) =>
        ['proposta_enviada', 'ganho', 'perdido'].includes(l.status)
      ).length || 0;

      // Fallback logic for revenue: use leads.deal_value if proposals table is empty
      const hasProposalsRecords = proposals && proposals.length > 0;
      
      let totalRevenue = 0;
      let leadsWithWonProposals = 0;
      
      if (hasProposalsRecords) {
        totalRevenue = proposals
          .filter((p: any) => p.status === 'won')
          .reduce((sum: number, p: any) => sum + (p.value || 0), 0);
          
        leadsWithWonProposals = new Set(
          proposals.filter((p: any) => p.status === 'won').map((p: any) => p.lead_id)
        ).size;
      } else {
        // Use deal_value from leads table
        const wonLeads = leads?.filter((l: any) => l.status === 'ganho') || [];
        totalRevenue = wonLeads.reduce((sum: number, l: any) => sum + (Number(l.deal_value) || 0), 0);
        leadsWithWonProposals = wonLeads.length;
      }

      const averageTicket = leadsWithWonProposals > 0 ? totalRevenue / leadsWithWonProposals : 0;

      // Valor em propostas ainda na mesa (proposta_enviada, não fechadas)
      const proposalsValue = hasProposalsRecords
        ? proposals
            .filter((p: any) => p.status !== 'won' && p.status !== 'lost')
            .reduce((sum: number, p: any) => sum + (p.value || 0), 0)
        : (leads?.filter((l: any) => l.status === 'proposta_enviada') || [])
            .reduce((sum: number, l: any) => sum + (Number(l.deal_value) || 0), 0);

      const last14Days = Array.from({ length: 14 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (13 - i));
        return getLocalDateString(date);
      });

      const leadsByDay = last14Days.map(date => ({
        date,
        count: leads?.filter((l: any) => l.created_at.startsWith(date)).length || 0,
      }));

      // Contagem de leads por status
      const statusCountMap = new Map<string, number>();
      leads?.forEach((l: any) => {
        statusCountMap.set(l.status, (statusCountMap.get(l.status) || 0) + 1);
      });

      // Fallback de cores e nomes caso pipeline_stages esteja vazio
      const fallbackStages = [
        { stage_key: 'novo', name: 'Novo Lead', color: '#3B82F6' },
        { stage_key: 'triagem', name: 'Triagem', color: '#F97316' },
        { stage_key: 'qualificado', name: 'Qualificado', color: '#22C55E' },
        { stage_key: 'agendado', name: 'Reunião Agendada', color: '#A855F7' },
        { stage_key: 'compareceu', name: 'Compareceu', color: '#06B6D4' },
        { stage_key: 'no_show', name: 'No Show', color: '#FB923C' },
        { stage_key: 'proposta_enviada', name: 'Proposta Enviada', color: '#EC4899' },
        { stage_key: 'ganho', name: 'Ganho', color: '#10B981' },
        { stage_key: 'perdido', name: 'Perdido', color: '#EF4444' },
        { stage_key: 'maturacao', name: 'Maturação', color: '#8B5CF6' },
      ];

      const stages: { stage_key: string; name: string; color: string }[] =
        pipelineStages?.length ? pipelineStages : fallbackStages;

      const leadsByStatus = stages
        .map(stage => ({
          status: stage.stage_key,
          name: stage.name,
          color: stage.color,
          count: statusCountMap.get(stage.stage_key) || 0,
          percentage: totalLeads > 0 ? ((statusCountMap.get(stage.stage_key) || 0) / totalLeads) * 100 : 0,
        }))
        .filter(item => item.count > 0);

      const utmSourceMap = new Map<string, number>();
      leads?.forEach((l: any) => {
        if (l.utm_source) {
          utmSourceMap.set(l.utm_source, (utmSourceMap.get(l.utm_source) || 0) + 1);
        }
      });
      const leadsByUTMSource = Array.from(utmSourceMap.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);

      const utmMediumMap = new Map<string, number>();
      leads?.forEach((l: any) => {
        if (l.utm_medium) {
          utmMediumMap.set(l.utm_medium, (utmMediumMap.get(l.utm_medium) || 0) + 1);
        }
      });
      const leadsByUTMMedium = Array.from(utmMediumMap.entries())
        .map(([medium, count]) => ({ medium, count }))
        .sort((a, b) => b.count - a.count);

      const utmCampaignMap = new Map<string, number>();
      leads?.forEach((l: any) => {
        if (l.utm_campaign) {
          utmCampaignMap.set(l.utm_campaign, (utmCampaignMap.get(l.utm_campaign) || 0) + 1);
        }
      });
      const leadsByUTMCampaign = Array.from(utmCampaignMap.entries())
        .map(([campaign, count]) => ({ campaign, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const utmContentMap = new Map<string, number>();
      leads?.forEach((l: any) => {
        if (l.utm_content) {
          utmContentMap.set(l.utm_content, (utmContentMap.get(l.utm_content) || 0) + 1);
        }
      });
      const leadsByUTMContent = Array.from(utmContentMap.entries())
        .map(([content, count]) => ({ content, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const answerMap = new Map<string, Map<string, number>>();
      answers?.forEach((a: any) => {
        if (!answerMap.has(a.question_key)) {
          answerMap.set(a.question_key, new Map());
        }
        const questionMap = answerMap.get(a.question_key)!;
        questionMap.set(a.answer_value, (questionMap.get(a.answer_value) || 0) + 1);
      });

      const leadAnswers: { question: string; answer: string; count: number }[] = [];
      answerMap.forEach((answerCounts, question) => {
        const sortedAnswers = Array.from(answerCounts.entries())
          .map(([answer, count]) => ({ question, answer, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        leadAnswers.push(...sortedAnswers);
      });

      const funnelData = [
        {
          stage: 'Leads Captados',
          count: totalLeads,
          percentage: 100,
          color: 'bg-blue-500',
        },
        {
          stage: 'Qualificados',
          count: qualifiedCount,
          percentage: totalLeads > 0 ? (qualifiedCount / totalLeads) * 100 : 0,
          color: 'bg-green-500',
        },
        {
          stage: 'Agendamentos',
          count: totalScheduledEver,
          percentage: totalLeads > 0 ? (totalScheduledEver / totalLeads) * 100 : 0,
          color: 'bg-purple-500',
        },
        {
          stage: 'Comparecidas',
          count: meetingsHeld,
          percentage: totalLeads > 0 ? (meetingsHeld / totalLeads) * 100 : 0,
          color: 'bg-cyan-500',
        },
        {
          stage: 'Proposta na Mesa',
          count: proposalsPresented,
          percentage: totalLeads > 0 ? (proposalsPresented / totalLeads) * 100 : 0,
          color: 'bg-pink-500',
        },
        {
          stage: 'Negócio Fechado',
          count: dealsWon,
          percentage: totalLeads > 0 ? (dealsWon / totalLeads) * 100 : 0,
          color: 'bg-emerald-500',
        },
      ];

      // Leads "quentes": triagem ou qualificado com score_total >= 15 (qualificado ou acima)
      const hotLeadsCount = leads?.filter((l: any) =>
        ['triagem', 'qualificado'].includes(l.status) &&
        (l.score_total ?? 0) >= 15
      ).length || 0;

      setMetrics({
        totalLeads,
        qualifiedCount,
        conversionRate,
        todayLeads,
        meetingsScheduled,
        totalScheduledEver,
        meetingsHeld,
        meetingsNoShow,
        meetingsPending,
        proposalsPresented,
        proposalsValue,
        dealsWon,
        averageTicket,
        totalRevenue,
        leadsByDay,
        leadsByStatus,
        leadsByUTMSource,
        leadsByUTMMedium,
        leadsByUTMCampaign,
        leadsByUTMContent,
        leadAnswers,
        funnelData,
        hotLeadsCount,
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando métricas...</div>
      </div>
    );
  }

  if (!metrics) return null;

  const maxLeadsPerDay = Math.max(...metrics.leadsByDay.map(d => d.count), 1);

  return (
    <div className="space-y-8 pb-10">
      {/* Header com Resumo Rápido */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance de Vendas</h1>
          <p className="text-sm text-gray-500">Métricas consolidadas e análise de conversão</p>
        </div>
        <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm p-1.5 rounded-xl border border-gray-200 shadow-sm">
          <div className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2">
            <Zap className="w-3 h-3" /> Dashboard Premium
          </div>
          <div className="px-3 py-1.5 text-gray-600 text-xs font-medium border border-transparent">
            Análíse em tempo real
          </div>
        </div>
      </div>

      {/* Seção 1: Indicadores Principais (Core Metrics) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Leads Captados"
          value={metrics.totalLeads}
          icon={Users}
          color="blue"
          description="Total de leads na base"
          href="/leads"
        />
        <MetricCard
          title="Qualificados"
          value={metrics.qualifiedCount}
          icon={Target}
          color="emerald"
          description={`${((metrics.qualifiedCount / (metrics.totalLeads || 1)) * 100).toFixed(1)}% de aproveitamento`}
          href="/leads?classification=qualificado"
        />
        <MetricCard
          title="Conversão (Ganhos)"
          value={`${metrics.conversionRate.toFixed(1)}%`}
          icon={TrendingUp}
          color="indigo"
          description="Leads que fecharam contrato"
          href="/leads?status=ganho"
        />
        <MetricCard
          title="Leads Hoje"
          value={metrics.todayLeads}
          icon={CalendarCheck}
          color="orange"
          description="Captura nas últimas 24h"
          highlight={metrics.todayLeads > 0}
          href="/leads?today=true"
        />
      </div>

      {/* Seção 2: Pipeline de Eficiência (Financial & Scheduling) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-6">
        <MetricCard
          title="Total Agendamentos"
          value={metrics.totalScheduledEver}
          icon={Calendar}
          color="purple"
          compact
          href="/leads?statuses=agendado,compareceu,proposta_enviada,ganho,perdido"
        />
        <MetricCard
          title="Aguardando Reunião"
          value={metrics.meetingsPending}
          icon={Calendar}
          color="blue"
          compact
          description="Ainda não realizadas"
          href="/leads?status=agendado"
        />
        <MetricCard
          title="Comparecidas"
          value={metrics.meetingsHeld}
          icon={Users}
          color="cyan"
          compact
          href="/leads?statuses=compareceu,proposta_enviada,ganho,perdido"
        />
        <MetricCard
          title="Não Compareceu"
          value={metrics.meetingsNoShow}
          icon={Users}
          color="orange"
          compact
          description="Leads no-show"
          href="/leads?status=no_show"
        />
        <MetricCard
          title="Propostas Apresentadas"
          value={metrics.proposalsPresented}
          icon={FileText}
          color="pink"
          compact
          href="/leads?statuses=proposta_enviada,ganho,perdido"
        />
        <MetricCard
          title="Ticket Médio"
          value={metrics.averageTicket > 0 ? `R$ ${metrics.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
          icon={DollarSign}
          color="amber"
          compact
        />
        <MetricCard
          title="Faturamento Total"
          value={metrics.totalRevenue > 0 ? `R$ ${metrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
          icon={Award}
          color="blue"
          compact
        />
        <MetricCard
          title="Propostas na Mesa"
          value={metrics.proposalsValue > 0 ? `R$ ${metrics.proposalsValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
          icon={TrendingUp}
          color="emerald"
          compact
          description="Valor em negociação"
          href="/leads?status=proposta_enviada"
        />
      </div>

      {/* Funil de Conversão Estilizado */}
      <section className="bg-white/70 backdrop-blur-md rounded-2xl border border-gray-200 shadow-xl p-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <TrendingUp className="w-32 h-32 text-blue-600" />
        </div>
        
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-blue-50 rounded-lg">
            <BarChart3 className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Jornada do Cliente</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 relative">
          {metrics.funnelData.map((item, i) => (
            <div key={i} className="relative">
              <div className="bg-white/80 border border-gray-100 rounded-xl p-5 hover:border-blue-200 hover:shadow-md transition-all h-full z-10 relative">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{item.stage}</span>
                  {i > 0 && (
                    <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      {((item.count / (metrics.funnelData[i-1].count || 1)) * 100).toFixed(0)}% step
                    </div>
                  )}
                </div>
                <div className="text-3xl font-black text-gray-900 mb-2">{item.count}</div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-1000"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <div className="mt-3 text-[10px] text-gray-500 font-medium">
                  {item.percentage.toFixed(1)}% do total
                </div>
              </div>
              {i < metrics.funnelData.length - 1 && (
                <div className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 items-center justify-center pointer-events-none">
                  <ArrowRight className="w-5 h-5 text-gray-300" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Gráficos e Distribuição */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Leads por Etapa */}
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-md rounded-2xl border border-gray-200 shadow-lg p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-blue-600" />
              Volume por Etapa do Funil
            </h2>
            <div className="text-xs font-semibold text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
              Total: {metrics.totalLeads} leads
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6">
            {metrics.leadsByStatus.map((item, i) => (
              <div key={i} className="group cursor-default">
                <div className="flex justify-between items-end text-sm mb-2 px-1">
                  <span className="font-bold text-gray-700 group-hover:text-blue-600 transition-colors">
                    {item.name}
                  </span>
                  <span className="text-gray-500 text-xs font-medium">
                    {item.count} <span className="text-gray-300 ml-1">|</span> {item.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden group-hover:shadow-sm transition-all">
                  <div
                    className="h-2.5 rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(item.percentage, 2)}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Atividade Recente */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-700 to-violet-800 rounded-2xl shadow-xl p-8 text-white relative overflow-hidden">
          <div className="absolute -bottom-6 -right-6 opacity-10">
            <Zap className="w-48 h-48 rotate-12" />
          </div>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Zap className="w-6 h-6" /> Insights de IA
          </h2>
          <div className="space-y-6 relative z-10">
            <div className="p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/10">
              <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-1">Métrica Chave</p>
              <p className="text-xl font-bold">Taxa de Qualificação de {((metrics.qualifiedCount / (metrics.totalLeads || 1)) * 100).toFixed(0)}%</p>
              <p className="text-xs text-white/70 mt-2">Você está acima da média do setor jurídico para campanhas digitais.</p>
            </div>
            
            <div
              className="p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 cursor-pointer hover:bg-white/20 transition-colors"
              onClick={() => window.location.href = '/leads?statuses=triagem,qualificado&scoreMin=15'}
            >
              <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-1">Próximo Passo Recomendado</p>
              <p className="text-lg font-bold">
                {metrics.hotLeadsCount > 0
                  ? `Focar em ${metrics.hotLeadsCount} lead${metrics.hotLeadsCount > 1 ? 's' : ''} "Quentes"`
                  : 'Nenhum lead quente no momento'}
              </p>
              <p className="text-xs text-white/70 mt-2">Leads em triagem ou qualificado com score ≥ 15. Clique para ver.</p>
            </div>

            <button 
              onClick={() => window.location.href = '/report'}
              className="w-full py-3 bg-white text-indigo-700 font-bold rounded-xl shadow-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              Ver Relatório Detalhado <MousePointer2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Leads por Dia - Visual Premium */}
      <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-gray-200 shadow-lg p-8">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Volume de Aquisição</h2>
            <p className="text-sm text-gray-400">Captura diária de novos leads nos últimos 14 dias</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
              <div className="w-3 h-3 bg-blue-500 rounded-full" /> Volume Diário
            </div>
          </div>
        </div>
        
        <div className="h-64 flex items-end justify-between gap-2 border-b border-gray-100 pb-2 mb-2">
          {metrics.leadsByDay.map((day, i) => {
            const height = (day.count / maxLeadsPerDay) * 100;
            const date = new Date(day.date);
            const dayNum = date.getDate();
            const month = date.getMonth() + 1;

            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full group">
                <div className="flex-1 w-full flex items-end">
                  <div
                    className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all hover:to-blue-300 hover:shadow-lg cursor-pointer relative"
                    style={{ height: `${Math.max(height, 5)}%` }}
                    title={`${dayNum}/${month}: ${day.count} leads`}
                  >
                    {day.count > 0 && (
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl pointer-events-none">
                        {day.count} leads
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-gray-400 font-bold group-hover:text-blue-600 transition-colors">
                  {dayNum}/{month < 10 ? '0' + month : month}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Análise de Origens (UTMs) */}
      <section className="bg-white/70 backdrop-blur-md rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
        <div className="p-8 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Análise de Aquisição</h2>
            <p className="text-sm text-gray-500">Distribuição por canais e campanhas (UTM Tracking)</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <MousePointer2 className="w-5 h-5 text-gray-400" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* UTM Source */}
          <div className="p-8 border-r border-b lg:border-b-0 border-gray-100">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> Principais Origens (Source)
            </h3>
            <div className="space-y-4">
              {metrics.leadsByUTMSource.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-600">#{i+1}</div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-bold text-gray-700 capitalize">{item.source}</span>
                      <span className="font-black text-gray-900">{item.count}</span>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(item.count / metrics.totalLeads) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* UTM Campaign */}
          <div className="p-8">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" /> Campanhas Ativas (Campaigns)
            </h3>
            <div className="space-y-4">
              {metrics.leadsByUTMCampaign.map((item, i) => (
                <div key={i} className="flex items-center gap-4 group">
                  <div className="w-2 h-2 rounded-full bg-gray-300 group-hover:bg-purple-500 transition-colors" />
                  <div className="flex-1 flex justify-between items-center text-sm">
                    <span className="text-gray-600 font-medium truncate max-w-[250px]">{item.campaign}</span>
                    <span className="bg-gray-100 text-gray-900 px-3 py-1 rounded-lg font-bold shadow-sm">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 bg-gray-50/50 border-t border-gray-100">
          {/* UTM Medium */}
          <div className="p-8 border-r border-gray-100">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Estratégias (Medium)</h3>
            <div className="flex flex-wrap gap-2">
              {metrics.leadsByUTMMedium.map((item, i) => (
                <div key={i} className="bg-white border border-gray-200 px-4 py-2 rounded-xl shadow-sm text-sm">
                  <span className="text-gray-500 mr-2">{item.medium}:</span>
                  <span className="font-bold text-gray-900">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* UTM Content */}
          <div className="p-8">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Anúncios (Content)</h3>
            <div className="space-y-2">
              {metrics.leadsByUTMContent.map((item, i) => (
                <div key={i} className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                  <span className="text-gray-600 truncate max-w-[200px]">{item.content}</span>
                  <span className="font-bold text-blue-600">{item.count} leads</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Respostas Detalhadas */}
      {metrics.leadAnswers.length > 0 && (
        <section className="bg-white/70 backdrop-blur-md rounded-2xl border border-gray-200 shadow-xl p-8">
          <div className="flex items-center gap-3 mb-10">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <FileText className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Perfil de Qualificação</h2>
              <p className="text-sm text-gray-500">Distribuição qualitativa baseada nas respostas dos formulários</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-10">
            {Array.from(new Set(metrics.leadAnswers.map(a => a.question))).map((question, i) => {
              const answers = metrics.leadAnswers.filter(a => a.question === question);
              const PIE_COLORS = ['#6366F1','#22C55E','#F59E0B','#EC4899','#06B6D4','#F97316','#8B5CF6','#EF4444'];
              const pieData = answers.map((a, idx) => ({
                name: a.answer,
                value: a.count,
                color: PIE_COLORS[idx % PIE_COLORS.length],
              }));

              return (
                <div key={i} className="bg-gray-50/30 p-6 rounded-2xl border border-gray-100">
                  <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 border-b pb-3">
                    {question.replace(/_/g, ' ')}
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <RechartsPie>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                        dataKey="value"
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {pieData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string) => [value, name]} />
                      <Legend
                        formatter={(value) => <span className="text-xs text-gray-700">{value}</span>}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  compact?: boolean;
  color?: 'blue' | 'emerald' | 'indigo' | 'orange' | 'purple' | 'cyan' | 'amber' | 'pink';
  description?: string;
  highlight?: boolean;
  href?: string;
}

function MetricCard({ title, value, icon: Icon, color = 'blue', description, highlight, href }: MetricCardProps) {
  const colorClasses: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    orange: 'text-orange-600 bg-orange-50 border-orange-100',
    purple: 'text-purple-600 bg-purple-50 border-purple-100',
    cyan: 'text-cyan-600 bg-cyan-50 border-cyan-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    pink: 'text-pink-600 bg-pink-50 border-pink-100',
  };

  const ringClass = highlight ? 'ring-2 ring-orange-500 ring-offset-2' : '';

  const inner = (
    <div className={`bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl p-6 hover:shadow-xl transition-all h-full group ${ringClass} ${href ? 'cursor-pointer hover:border-blue-300' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl border ${colorClasses[color]} transition-transform group-hover:scale-110 duration-300`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-1">
          {highlight && (
            <div className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </div>
          )}
          {href && <ArrowRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
        </div>
      </div>
      <div>
        <div className="text-sm font-bold text-gray-500 mb-1">{title}</div>
        <div className="text-3xl font-black text-gray-900 tracking-tight">{value}</div>
        {description && (
          <div className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-widest">{description}</div>
        )}
      </div>
    </div>
  );

  if (href) return <a href={href} className="block h-full">{inner}</a>;
  return inner;
}
