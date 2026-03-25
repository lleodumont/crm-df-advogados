import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, MessageSquare, Send, Inbox, Calendar, TrendingUp } from 'lucide-react';

interface AttendantStats {
  userId: string;
  name: string;
  email: string;
  role: string;
  conversations: number;
  sent: number;
  received: number;
  total: number;
}

type Period = 'today' | 'week' | 'month' | 'custom';

function getPeriodDates(period: Period, customStart: string, customEnd: string): { start: string; end: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (period === 'today') {
    const today = toISO(now);
    return { start: `${today}T00:00:00`, end: `${today}T23:59:59` };
  }
  if (period === 'week') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    return { start: `${toISO(monday)}T00:00:00`, end: new Date().toISOString() };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: `${toISO(start)}T00:00:00`, end: new Date().toISOString() };
  }
  return {
    start: customStart ? `${customStart}T00:00:00` : `${toISO(now)}T00:00:00`,
    end: customEnd ? `${customEnd}T23:59:59` : new Date().toISOString(),
  };
}

export default function AttendanceReport() {
  const [stats, setStats] = useState<AttendantStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    if (period === 'custom' && (!customStart || !customEnd)) return;
    loadStats();
  }, [period, customStart, customEnd]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const { start, end } = getPeriodDates(period, customStart, customEnd);

      // 1. Buscar todos os usuários
      const { data: users } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role')
        .order('full_name');

      if (!users?.length) { setStats([]); return; }

      // 2. Mensagens do período com lead e owner
      const { data: messages } = await supabase
        .from('whatsapp_messages')
        .select('id, direction, sent_by, lead_id, leads(owner_user_id)')
        .gte('created_at', start)
        .lte('created_at', end);

      if (!messages) { setStats([]); return; }

      // 3. Agregar por usuário
      const userMap: Record<string, { sent: number; received: number; conversations: Set<string> }> = {};
      users.forEach(u => {
        userMap[u.id] = { sent: 0, received: 0, conversations: new Set() };
      });

      messages.forEach((msg: any) => {
        const ownerId = msg.leads?.owner_user_id;

        if (msg.direction === 'outbound' && msg.sent_by && userMap[msg.sent_by]) {
          userMap[msg.sent_by].sent++;
          if (msg.lead_id) userMap[msg.sent_by].conversations.add(msg.lead_id);
        }

        if (msg.direction === 'inbound' && ownerId && userMap[ownerId]) {
          userMap[ownerId].received++;
          if (msg.lead_id) userMap[ownerId].conversations.add(msg.lead_id);
        }
      });

      const result: AttendantStats[] = users.map(u => ({
        userId: u.id,
        name: u.full_name || u.email || 'Sem nome',
        email: u.email || '',
        role: u.role || '',
        conversations: userMap[u.id]?.conversations.size ?? 0,
        sent: userMap[u.id]?.sent ?? 0,
        received: userMap[u.id]?.received ?? 0,
        total: (userMap[u.id]?.sent ?? 0) + (userMap[u.id]?.received ?? 0),
      }));

      // Ordena por total de mensagens desc
      result.sort((a, b) => b.total - a.total);
      setStats(result);
    } catch (err) {
      console.error('Error loading attendance report:', err);
    } finally {
      setLoading(false);
    }
  };

  const totals = stats.reduce(
    (acc, s) => ({
      conversations: acc.conversations + s.conversations,
      sent: acc.sent + s.sent,
      received: acc.received + s.received,
      total: acc.total + s.total,
    }),
    { conversations: 0, sent: 0, received: 0, total: 0 }
  );

  const chartData = stats
    .filter(s => s.total > 0)
    .map(s => ({
      name: s.name.split(' ')[0],
      'Enviadas': s.sent,
      'Recebidas': s.received,
    }));

  const periodLabel: Record<Period, string> = {
    today: 'Hoje',
    week: 'Esta semana',
    month: 'Este mês',
    custom: 'Personalizado',
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Relatório de Atendimentos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Produtividade da equipe por período</p>
        </div>

        {/* Seletor de período */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['today', 'week', 'month', 'custom'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {periodLabel[p]}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="text-sm text-gray-700 outline-none"
              />
              <span className="text-gray-400 text-sm">até</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="text-sm text-gray-700 outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Cards de totais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Conversas', value: totals.conversations, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Mensagens enviadas', value: totals.sent, icon: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Mensagens recebidas', value: totals.received, icon: Inbox, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total de mensagens', value: totals.total, icon: MessageSquare, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Gráfico */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Mensagens por atendente</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Enviadas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Recebidas" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Detalhamento por atendente</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Carregando...</div>
        ) : stats.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Nenhum dado no período</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 text-left">Atendente</th>
                <th className="px-6 py-3 text-left">Cargo</th>
                <th className="px-6 py-3 text-center">Conversas</th>
                <th className="px-6 py-3 text-center">Enviadas</th>
                <th className="px-6 py-3 text-center">Recebidas</th>
                <th className="px-6 py-3 text-center">Total</th>
                <th className="px-6 py-3 text-left">Atividade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.map((s, i) => {
                const maxTotal = stats[0]?.total || 1;
                const pct = Math.round((s.total / maxTotal) * 100);
                return (
                  <tr key={s.userId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                          {s.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{s.name}</p>
                          <p className="text-xs text-gray-400">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                        {s.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-semibold text-purple-700">{s.conversations}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-semibold text-blue-700">{s.sent}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-semibold text-green-700">{s.received}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-bold text-gray-900">{s.total}</span>
                    </td>
                    <td className="px-6 py-4 w-40">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
