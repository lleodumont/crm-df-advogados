import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, Users, TrendingDown, ShoppingCart, BarChart3, Target, RefreshCw } from 'lucide-react';

interface DateRange { since: string; until: string; }
interface MetaCampaign {
  campaign_id: string;
  campaign_name: string;
  impressions: string;
  clicks: string;
  spend: string;
  reach: string;
  cpc: string;
  cpm: string;
  ctr: string;
}
interface CrmLead {
  id: string;
  campaign_id: string | null;
  utm_campaign: string | null;
  classification: string;
  status: string;
  created_at: string;
}
interface EduzzSale {
  id: string;
  amount: number;
  utm_campaign: string | null;
  lead_id: string | null;
  created_at: string;
}
interface CampaignRow {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  leads: number;
  qualified: number;
  sales: number;
  revenue: number;
  cpl: number;
  cac: number;
}

function getDefaultRange(): DateRange {
  const now = new Date();
  const since = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const until = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { since, until };
}

export default function MarketingDashboard() {
  const [range, setRange] = useState<DateRange>(getDefaultRange());
  const [metaCampaigns, setMetaCampaigns] = useState<MetaCampaign[]>([]);
  const [crmLeads, setCrmLeads] = useState<CrmLead[]>([]);
  const [eduzzSales, setEduzzSales] = useState<EduzzSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  useEffect(() => { loadAll(); }, [range]);

  const loadAll = async () => {
    setLoading(true);
    setMetaError(null);
    await Promise.all([loadMeta(), loadCrm(), loadEduzz()]);
    setLoading(false);
  };

  const loadMeta = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-ads-proxy?level=campaign&since=${range.since}&until=${range.until}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        }
      );
      if (!res.ok) throw new Error(`Meta proxy error ${res.status}`);
      const json = await res.json();
      setMetaCampaigns(json.data ?? []);
    } catch (e) {
      setMetaError((e as Error).message);
    }
  };

  const loadCrm = async () => {
    const { data } = await supabase
      .from('leads')
      .select('id, campaign_id, utm_campaign, classification, status, created_at')
      .gte('created_at', range.since)
      .lte('created_at', range.until + 'T23:59:59');
    setCrmLeads((data as CrmLead[]) ?? []);
  };

  const loadEduzz = async () => {
    const { data } = await supabase
      .from('eduzz_sales')
      .select('id, amount, utm_campaign, lead_id, created_at')
      .eq('status', 'approved')
      .gte('created_at', range.since)
      .lte('created_at', range.until + 'T23:59:59');
    setEduzzSales((data as EduzzSale[]) ?? []);
  };

  const buildRows = (): CampaignRow[] => {
    const rows: CampaignRow[] = metaCampaigns.map((mc) => {
      const leads = crmLeads.filter(
        (l) => l.campaign_id === mc.campaign_id ||
               (l.utm_campaign && l.utm_campaign.toLowerCase().includes(mc.campaign_name.toLowerCase()))
      );
      const qualified = leads.filter(
        (l) => l.classification === 'qualificado' || l.classification === 'estrategico'
      ).length;

      const leadIds = leads.map((l) => l.id).filter(Boolean);
      const sales = eduzzSales.filter(
        (s) => (s.lead_id && leadIds.includes(s.lead_id)) ||
               (s.utm_campaign === mc.campaign_name)
      );

      const spend   = parseFloat(mc.spend || '0');
      const nLeads  = leads.length;
      const nSales  = sales.length;
      const revenue = sales.reduce((acc, s) => acc + (s.amount || 0), 0);

      return {
        campaign_id:   mc.campaign_id,
        campaign_name: mc.campaign_name,
        spend,
        impressions: parseInt(mc.impressions || '0'),
        clicks:      parseInt(mc.clicks || '0'),
        ctr:         parseFloat(mc.ctr || '0'),
        leads:       nLeads,
        qualified,
        sales:       nSales,
        revenue,
        cpl: nLeads  > 0 ? spend / nLeads  : 0,
        cac: nSales  > 0 ? spend / nSales  : 0,
      };
    });

    const trackedCampaignIds = new Set(
      metaCampaigns.map((mc) => mc.campaign_id)
    );
    const untrackedLeads = crmLeads.filter((l) => !l.campaign_id || !trackedCampaignIds.has(l.campaign_id));
    if (untrackedLeads.length > 0) {
      rows.push({
        campaign_id:   '__untracked__',
        campaign_name: 'Sem campanha / Orgânico',
        spend: 0, impressions: 0, clicks: 0, ctr: 0,
        leads: untrackedLeads.length,
        qualified: untrackedLeads.filter((l) => l.classification === 'qualificado' || l.classification === 'estrategico').length,
        sales: 0, revenue: 0, cpl: 0, cac: 0,
      });
    }

    return rows.sort((a, b) => b.spend - a.spend);
  };

  const rows = buildRows();

  const totals = rows.reduce(
    (acc, r) => ({
      spend:   acc.spend   + r.spend,
      leads:   acc.leads   + r.leads,
      sales:   acc.sales   + r.sales,
      revenue: acc.revenue + r.revenue,
    }),
    { spend: 0, leads: 0, sales: 0, revenue: 0 }
  );

  const avgCPL = totals.leads > 0 ? totals.spend / totals.leads : 0;
  const avgCAC = totals.sales > 0 ? totals.spend / totals.sales : 0;

  const fmt = (n: number, decimals = 2) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing & Comercial</h1>
          <p className="text-sm text-gray-500 mt-1">Meta Ads × CRM × Eduzz — funil completo</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">De:</label>
            <input
              type="date"
              value={range.since}
              onChange={(e) => setRange((r) => ({ ...r, since: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Até:</label>
            <input
              type="date"
              value={range.until}
              onChange={(e) => setRange((r) => ({ ...r, until: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={loadAll}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Meta error banner */}
      {metaError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <strong>Erro Meta Ads:</strong> {metaError}. Verifique se META_ACCESS_TOKEN e META_AD_ACCOUNT estão configurados no Supabase.
        </div>
      )}

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-2/3 mb-3" />
              <div className="h-6 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard icon={<DollarSign className="w-5 h-5 text-orange-600" />} bg="bg-orange-50"
            label="Gasto Total" value={`R$ ${fmt(totals.spend)}`} />
          <KpiCard icon={<Users className="w-5 h-5 text-blue-600" />} bg="bg-blue-50"
            label="Leads" value={String(totals.leads)} />
          <KpiCard icon={<TrendingDown className="w-5 h-5 text-green-600" />} bg="bg-green-50"
            label="CPL Médio" value={avgCPL > 0 ? `R$ ${fmt(avgCPL)}` : '—'} />
          <KpiCard icon={<ShoppingCart className="w-5 h-5 text-purple-600" />} bg="bg-purple-50"
            label="Vendas (Eduzz)" value={String(totals.sales)} />
          <KpiCard icon={<BarChart3 className="w-5 h-5 text-indigo-600" />} bg="bg-indigo-50"
            label="Receita" value={`R$ ${fmt(totals.revenue)}`} />
          <KpiCard icon={<Target className="w-5 h-5 text-red-600" />} bg="bg-red-50"
            label="CAC Médio" value={avgCAC > 0 ? `R$ ${fmt(avgCAC)}` : '—'} />
        </div>
      )}

      {/* Campaign Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Performance por Campanha</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Carregando dados...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            Nenhum dado encontrado. Verifique se o Meta Ads está configurado e há leads no período selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Campanha</th>
                  <th className="px-4 py-3 text-right">Gasto</th>
                  <th className="px-4 py-3 text-right">Impressões</th>
                  <th className="px-4 py-3 text-right">Cliques</th>
                  <th className="px-4 py-3 text-right">CTR</th>
                  <th className="px-4 py-3 text-right">Leads</th>
                  <th className="px-4 py-3 text-right">CPL</th>
                  <th className="px-4 py-3 text-right">Qualif.</th>
                  <th className="px-4 py-3 text-right">Vendas</th>
                  <th className="px-4 py-3 text-right">Receita</th>
                  <th className="px-4 py-3 text-right">CAC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.campaign_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate" title={r.campaign_name}>
                      {r.campaign_name}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {r.spend > 0 ? `R$ ${fmt(r.spend)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {r.impressions > 0 ? r.impressions.toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {r.clicks > 0 ? r.clicks.toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {r.ctr > 0 ? `${fmt(r.ctr, 2)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-blue-700">{r.leads}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {r.cpl > 0 ? `R$ ${fmt(r.cpl)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{r.qualified}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-purple-700">{r.sales}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {r.revenue > 0 ? `R$ ${fmt(r.revenue)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.cac > 0 ? (
                        <span className={`font-semibold ${r.cac < 500 ? 'text-green-600' : r.cac < 1000 ? 'text-yellow-600' : 'text-red-600'}`}>
                          R$ {fmt(r.cac)}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold text-gray-800 border-t-2 border-gray-200">
                <tr>
                  <td className="px-4 py-3">TOTAL</td>
                  <td className="px-4 py-3 text-right">R$ {fmt(totals.spend)}</td>
                  <td colSpan={3} />
                  <td className="px-4 py-3 text-right text-blue-700">{totals.leads}</td>
                  <td className="px-4 py-3 text-right">{avgCPL > 0 ? `R$ ${fmt(avgCPL)}` : '—'}</td>
                  <td className="px-4 py-3 text-right">{rows.reduce((a, r) => a + r.qualified, 0)}</td>
                  <td className="px-4 py-3 text-right text-purple-700">{totals.sales}</td>
                  <td className="px-4 py-3 text-right">R$ {fmt(totals.revenue)}</td>
                  <td className="px-4 py-3 text-right">{avgCAC > 0 ? `R$ ${fmt(avgCAC)}` : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon, bg, label, value }: { icon: React.ReactNode; bg: string; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className={`${bg} p-2 rounded-lg`}>{icon}</div>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
