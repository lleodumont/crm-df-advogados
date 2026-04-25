import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShoppingBag, Search, ExternalLink, User } from 'lucide-react';

interface EduzzSale {
  id: string;
  eduzz_transaction_id: string;
  product_name: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  amount: number | null;
  status: string | null;
  utm_campaign: string | null;
  utm_source: string | null;
  created_at: string;
  lead_id: string | null;
  leads?: { full_name: string | null } | null;
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function BaseClientes() {
  const [sales, setSales] = useState<EduzzSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [product, setProduct] = useState('');
  const [products, setProducts] = useState<string[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadSales();
  }, [product]);

  const loadSales = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('eduzz_sales')
        .select('*, leads(full_name)', { count: 'exact' })
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(500);

      if (product) query = query.eq('product_name', product);

      const { data, count } = await query;
      setSales(data || []);
      setTotal(count || 0);

      const names = [...new Set((data || []).map((s) => s.product_name).filter(Boolean))] as string[];
      if (names.length > 0) setProducts((prev) => [...new Set([...prev, ...names])]);
    } catch (err) {
      console.error('Erro ao carregar base de clientes:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = sales.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.buyer_name?.toLowerCase().includes(q) ||
      s.buyer_email?.toLowerCase().includes(q) ||
      s.buyer_phone?.includes(q) ||
      s.eduzz_transaction_id?.includes(q)
    );
  });

  const totalRevenue = filtered.reduce((acc, s) => acc + (s.amount || 0), 0);
  const linked = filtered.filter((s) => s.lead_id).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-7 h-7 text-indigo-600" />
            Base de Clientes
          </h1>
          <p className="text-sm text-gray-500 mt-1">Vendas aprovadas na Eduzz</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-indigo-600">{fmt.format(totalRevenue)}</div>
          <div className="text-xs text-gray-500">{filtered.length} vendas · {linked} vinculados ao CRM</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail, telefone ou fatura..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todos os produtos</option>
          {products.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <ShoppingBag className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">Nenhuma venda encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Produto</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Valor</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Campanha</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Data</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Lead</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{sale.buyer_name || '—'}</div>
                      <div className="text-xs text-gray-400">{sale.buyer_email || ''}</div>
                      {sale.buyer_phone && (
                        <div className="text-xs text-gray-400">{sale.buyer_phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700 max-w-xs truncate">{sale.product_name || '—'}</div>
                      <div className="text-xs text-gray-400">#{sale.eduzz_transaction_id}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {sale.amount ? fmt.format(sale.amount) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {sale.utm_campaign ? (
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">
                          {sale.utm_campaign}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(sale.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      {sale.lead_id ? (
                        <a
                          href={`/leads/${sale.lead_id}`}
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          <User className="w-3 h-3" />
                          {(sale.leads as any)?.full_name || 'Ver lead'}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">Sem lead</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > 500 && (
        <p className="text-xs text-gray-400 text-center">Mostrando 500 de {total} registros. Use o filtro de produto para refinar.</p>
      )}
    </div>
  );
}
