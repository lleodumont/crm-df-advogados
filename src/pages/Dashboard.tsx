import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Calendar, FileText, DollarSign, CheckCircle, TrendingUp, CalendarCheck } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Lead = Database['public']['Tables']['leads']['Row'];

interface DashboardMetrics {
  totalLeads: number;
  qualifiedCount: number;
  conversionRate: number;
  todayLeads: number;
  meetingsScheduled: number;
  meetingsHeld: number;
  proposalsPresented: number;
  dealsWon: number;
  averageTicket: number;
  totalRevenue: number;
  leadsByDay: { date: string; count: number }[];
  leadsByStatus: { status: string; count: number; percentage: number }[];
  leadsByUTMSource: { source: string; count: number }[];
  leadsByUTMMedium: { medium: string; count: number }[];
  leadsByUTMCampaign: { campaign: string; count: number }[];
  leadsByUTMContent: { content: string; count: number }[];
  leadAnswers: { question: string; answer: string; count: number }[];
  funnelData: { stage: string; count: number; percentage: number; color: string }[];
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'all'>('all');

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const { data: leads } = await supabase.from('leads').select('*');
      const { data: meetings } = await supabase.from('scheduled_activities').select('*');
      const { data: answers } = await supabase.from('lead_answers').select('*');

      const totalLeads = leads?.length || 0;
      const qualifiedCount = leads?.filter(l =>
        l.classification === 'hot' || l.classification === 'warm'
      ).length || 0;
      const dealsWon = leads?.filter(l => l.status === 'won').length || 0;
      const conversionRate = totalLeads > 0 ? (dealsWon / totalLeads) * 100 : 0;

      const today = new Date().toISOString().split('T')[0];
      const todayLeads = leads?.filter(l => l.created_at.startsWith(today)).length || 0;

      const meetingsScheduled = meetings?.filter(m => m.status === 'scheduled').length || 0;
      const meetingsHeld = leads?.filter(l => l.status === 'meeting_held').length || 0;
      const proposalsPresented = leads?.filter(l =>
        l.status === 'proposal_sent' || l.status === 'won' || l.status === 'lost'
      ).length || 0;

      const totalRevenue = leads
        ?.filter(l => l.status === 'won')
        .reduce((sum, l) => sum + (l.deal_value || 0), 0) || 0;
      const averageTicket = dealsWon > 0 ? totalRevenue / dealsWon : 0;

      const last14Days = Array.from({ length: 14 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (13 - i));
        return date.toISOString().split('T')[0];
      });

      const leadsByDay = last14Days.map(date => ({
        date,
        count: leads?.filter(l => l.created_at.startsWith(date)).length || 0,
      }));

      const statusMap = new Map<string, { count: number; color: string }>();
      statusMap.set('new', { count: 0, color: 'bg-blue-500' });
      statusMap.set('qualified', { count: 0, color: 'bg-green-500' });
      statusMap.set('meeting_scheduled', { count: 0, color: 'bg-purple-500' });
      statusMap.set('meeting_held', { count: 0, color: 'bg-cyan-500' });
      statusMap.set('won', { count: 0, color: 'bg-emerald-500' });

      leads?.forEach(l => {
        const current = statusMap.get(l.status);
        if (current) {
          statusMap.set(l.status, { ...current, count: current.count + 1 });
        }
      });

      const leadsByStatus = Array.from(statusMap.entries()).map(([status, data]) => ({
        status,
        count: data.count,
        percentage: totalLeads > 0 ? (data.count / totalLeads) * 100 : 0,
      }));

      const utmSourceMap = new Map<string, number>();
      leads?.forEach(l => {
        if (l.utm_source) {
          utmSourceMap.set(l.utm_source, (utmSourceMap.get(l.utm_source) || 0) + 1);
        }
      });
      const leadsByUTMSource = Array.from(utmSourceMap.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);

      const utmMediumMap = new Map<string, number>();
      leads?.forEach(l => {
        if (l.utm_medium) {
          utmMediumMap.set(l.utm_medium, (utmMediumMap.get(l.utm_medium) || 0) + 1);
        }
      });
      const leadsByUTMMedium = Array.from(utmMediumMap.entries())
        .map(([medium, count]) => ({ medium, count }))
        .sort((a, b) => b.count - a.count);

      const utmCampaignMap = new Map<string, number>();
      leads?.forEach(l => {
        if (l.utm_campaign) {
          utmCampaignMap.set(l.utm_campaign, (utmCampaignMap.get(l.utm_campaign) || 0) + 1);
        }
      });
      const leadsByUTMCampaign = Array.from(utmCampaignMap.entries())
        .map(([campaign, count]) => ({ campaign, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const utmContentMap = new Map<string, number>();
      leads?.forEach(l => {
        if (l.utm_content) {
          utmContentMap.set(l.utm_content, (utmContentMap.get(l.utm_content) || 0) + 1);
        }
      });
      const leadsByUTMContent = Array.from(utmContentMap.entries())
        .map(([content, count]) => ({ content, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const answerMap = new Map<string, Map<string, number>>();
      answers?.forEach(a => {
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
          stage: 'Reuniões Agendadas',
          count: meetingsScheduled,
          percentage: totalLeads > 0 ? (meetingsScheduled / totalLeads) * 100 : 0,
          color: 'bg-purple-500',
        },
        {
          stage: 'Comparecidas',
          count: meetingsHeld,
          percentage: totalLeads > 0 ? (meetingsHeld / totalLeads) * 100 : 0,
          color: 'bg-cyan-500',
        },
        {
          stage: 'Negócio Fechado',
          count: dealsWon,
          percentage: totalLeads > 0 ? (dealsWon / totalLeads) * 100 : 0,
          color: 'bg-emerald-500',
        },
      ];

      setMetrics({
        totalLeads,
        qualifiedCount,
        conversionRate,
        todayLeads,
        meetingsScheduled,
        meetingsHeld,
        proposalsPresented,
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total de Leads"
          value={metrics.totalLeads}
          icon={Users}
        />
        <MetricCard
          title="Qualificados"
          value={metrics.qualifiedCount}
          icon={CheckCircle}
        />
        <MetricCard
          title="Taxa de Conversão"
          value={`${metrics.conversionRate.toFixed(0)}%`}
          icon={TrendingUp}
        />
        <MetricCard
          title="Leads Hoje"
          value={metrics.todayLeads}
          icon={CalendarCheck}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Reuniões Agendadas"
          value={metrics.meetingsScheduled}
          icon={Calendar}
          compact
        />
        <MetricCard
          title="Comparecidas"
          value={metrics.meetingsHeld}
          icon={Users}
          compact
        />
        <MetricCard
          title="Vendas"
          value={metrics.dealsWon}
          icon={FileText}
          compact
        />
        <MetricCard
          title="Ticket Médio"
          value={`R$ ${(metrics.averageTicket / 1000).toFixed(1)}k`}
          icon={DollarSign}
          compact
        />
        <MetricCard
          title="Faturamento Total"
          value={`R$ ${(metrics.totalRevenue / 1000).toFixed(0)}k`}
          icon={DollarSign}
          compact
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-300 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Funil de Conversão</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {metrics.funnelData.map((item, i) => (
            <div key={i} className="relative h-full">
              <div className="bg-white border-2 border-gray-300 rounded-lg p-6 hover:border-gray-400 transition-colors h-full flex items-center">
                <div className="text-center w-full">
                  <div className="text-3xl font-bold mb-2 text-gray-900">{item.count}</div>
                  <div className="text-sm font-medium text-gray-600 mb-3">{item.stage}</div>
                  <div className="text-xs bg-gray-100 text-gray-700 rounded-full px-3 py-1 inline-block font-medium">
                    {item.percentage.toFixed(0)}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-300 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Leads por Etapa</h2>
          <p className="text-sm text-gray-500 mb-6">Clique em uma barra para ver os UTMs</p>
          <div className="space-y-4">
            {metrics.leadsByStatus.map((item, i) => {
              const statusLabels: Record<string, string> = {
                new: 'Novo lead',
                qualified: 'Qualificado',
                meeting_scheduled: 'Reunião Agendada',
                meeting_held: 'Compareceu',
                won: 'Negócio Fechado',
              };

              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-gray-800">{statusLabels[item.status] || item.status}</span>
                    <span className="text-gray-600">
                      {item.count} ({item.percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(item.percentage, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-300 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Leads por Dia (últimos 14 dias)</h2>
          <div className="h-64 flex items-end justify-between gap-1.5">
            {metrics.leadsByDay.map((day, i) => {
              const height = (day.count / maxLeadsPerDay) * 100;
              const date = new Date(day.date);
              const dayNum = date.getDate();
              const month = date.getMonth() + 1;

              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="text-xs text-gray-600 font-medium">{day.count || ''}</div>
                  <div
                    className="w-full bg-blue-600 rounded-t-lg transition-all hover:bg-blue-700 cursor-pointer"
                    style={{ height: `${Math.max(height, 4)}%` }}
                    title={`${dayNum}/${month}: ${day.count} leads`}
                  />
                  <div className="text-xs text-gray-500">{dayNum}/{month < 10 ? '0' + month : month}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-300 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Por UTM Source</h2>
          <div className="space-y-3">
            {metrics.leadsByUTMSource.slice(0, 8).map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">{item.source}</span>
                <span className="text-sm font-semibold text-gray-900 min-w-[3rem] text-right">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-300 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Por UTM Medium</h2>
          <div className="space-y-3">
            {metrics.leadsByUTMMedium.slice(0, 8).map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">{item.medium}</span>
                <span className="text-sm font-semibold text-gray-900 min-w-[3rem] text-right">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-300 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Por UTM Campaign</h2>
          <div className="space-y-3">
            {metrics.leadsByUTMCampaign.map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 truncate flex-1">{item.campaign}</span>
                <span className="text-sm font-semibold text-gray-900 min-w-[3rem] text-right ml-4">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-300 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Por UTM Content</h2>
          <div className="space-y-3">
            {metrics.leadsByUTMContent.map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 truncate flex-1">{item.content}</span>
                <span className="text-sm font-semibold text-gray-900 min-w-[3rem] text-right ml-4">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {metrics.leadAnswers.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-300 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Respostas dos Leads</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from(new Set(metrics.leadAnswers.map(a => a.question))).map((question, i) => {
              const answers = metrics.leadAnswers.filter(a => a.question === question);
              const total = answers.reduce((sum, a) => sum + a.count, 0);

              return (
                <div key={i}>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 capitalize">
                    {question.replace(/_/g, ' ')}
                  </h3>
                  <div className="space-y-2">
                    {answers.map((answer, j) => (
                      <div key={j}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-700">{answer.answer}</span>
                          <span className="text-gray-600">
                            {answer.count} ({((answer.count / total) * 100).toFixed(0)}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${(answer.count / total) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  compact?: boolean;
}

function MetricCard({ title, value, icon: Icon, compact }: MetricCardProps) {
  return (
    <div className={`bg-white border border-gray-300 rounded-lg hover:border-gray-400 transition-colors h-full ${compact ? 'p-4' : 'p-6'}`}>
      <div className="flex items-start justify-between h-full">
        <div className="flex-1 flex flex-col justify-between">
          <div className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-gray-600 mb-2`}>{title}</div>
          <div className={`${compact ? 'text-2xl' : 'text-3xl'} font-semibold text-gray-900`}>{value}</div>
        </div>
        <div className="bg-gray-100 p-2 rounded-lg flex-shrink-0">
          <Icon className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} text-gray-600`} />
        </div>
      </div>
    </div>
  );
}
