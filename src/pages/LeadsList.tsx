import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Filter, Plus, Phone, Mail, TrendingUp, ChevronDown, Tag as TagIcon, X } from 'lucide-react';
import type { Database } from '../lib/database.types';
import { useAuth } from '../contexts/AuthContext';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Tables']['leads']['Row']['status'];
type LeadClassification = Database['public']['Tables']['leads']['Row']['classification'];

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface PipelineStage {
  id: string;
  name: string;
  stage_key: string;
  color: string;
  order_index: number;
}

interface LeadWithTags extends Lead {
  tags?: Tag[];
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
}

interface Filters {
  search: string;
  status: LeadStatus | 'all';
  classification: LeadClassification | 'all';
  source: string;
  scoreMin: number;
  scoreMax: number;
  familyIncomeRange: string;
  tagIds: string[];
  entryDateStart: string;
  entryDateEnd: string;
  wonDateStart: string;
  wonDateEnd: string;
  cargo: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
}

export default function LeadsList() {
  const { profile } = useAuth();
  const [leads, setLeads] = useState<LeadWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [cargoOptions, setCargoOptions] = useState<string[]>([]);
  const [staleOnly, setStaleOnly] = useState(() => {
    return new URLSearchParams(window.location.search).get('stale') === 'true';
  });
  const [staleLeadIds, setStaleLeadIds] = useState<string[]>([]);
  // Filtro de múltiplos status via URL (?statuses=agendado,compareceu,...)
  const [multiStatuses, setMultiStatuses] = useState<string[] | null>(() => {
    const val = new URLSearchParams(window.location.search).get('statuses');
    return val ? val.split(',') : null;
  });

  const [filters, setFilters] = useState<Filters>(() => {
    const params = new URLSearchParams(window.location.search);
    const today = new Date().toISOString().slice(0, 10);
    return {
      search: '',
      status: (params.get('status') as any) || 'all',
      classification: (params.get('classification') as any) || 'all',
      source: 'all',
      scoreMin: params.get('scoreMin') ? Number(params.get('scoreMin')) : 0,
      scoreMax: 100,
      familyIncomeRange: 'all',
      tagIds: [],
      entryDateStart: params.get('today') === 'true' ? today : '',
      entryDateEnd: params.get('today') === 'true' ? today : '',
      wonDateStart: '',
      wonDateEnd: '',
      cargo: '',
      utmSource: '',
      utmMedium: '',
      utmCampaign: '',
      utmContent: '',
      utmTerm: '',
    };
  });

  // Banner para indicar filtro vindo do dashboard
  const urlFilter = (() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('today') === 'true') return 'Leads captados hoje';
    if (params.get('status') === 'ganho') return 'Leads ganhos (contratos fechados)';
    if (params.get('status') === 'reuniao_agendada') return 'Leads aguardando reunião';
    if (params.get('status') === 'reuniao_realizada') return 'Leads que compareceram à reunião';
    if (params.get('status') === 'no_show') return 'Leads que não compareceram';
    if (params.get('classification') === 'qualificado') return 'Leads qualificados';
    if (params.get('statuses') === 'reuniao_agendada,reuniao_realizada,proposta_enviada,ganho,perdido') return 'Total de agendamentos (histórico completo)';
    if (params.get('statuses') === 'reuniao_realizada,proposta_enviada,ganho,perdido') return 'Leads que compareceram à reunião';
    if (params.get('statuses') === 'abordagem,qualificado' && params.get('scoreMin') === '15') return 'Leads "quentes" — abordagem/qualificado com score ≥ 15';
    if (params.get('statuses')) return 'Leads filtrados por múltiplos status';
    return null;
  })();

  useEffect(() => {
    loadStages();
    loadTags();
    loadUsers();
    loadCargoOptions();
    if (staleOnly) loadStaleIds();
  }, []);

  useEffect(() => {
    loadLeads();
  }, [filters, staleLeadIds, multiStatuses]);

  const loadStaleIds = async () => {
    const { data } = await supabase.from('vw_stale_strategic_leads').select('lead_id');
    setStaleLeadIds(data?.map((r: any) => r.lead_id) ?? []);
  };

  const loadStages = async () => {
    try {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;
      setStages(data || []);
    } catch (error) {
      console.error('Error loading stages:', error);
    }
  };

  const loadTags = async () => {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name');

      if (error) throw error;
      setAvailableTags(data || []);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name')
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadCargoOptions = async () => {
    try {
      const { data } = await supabase
        .from('leads')
        .select('cargo')
        .not('cargo', 'is', null)
        .neq('cargo', '');
      const unique = [...new Set((data || []).map((r: any) => r.cargo as string))].sort();
      setCargoOptions(unique);
    } catch (error) {
      console.error('Error loading cargo options:', error);
    }
  };

  const loadLeads = async () => {
    setLoading(true);
    try {
      let query = supabase.from('leads').select('*');

      if (filters.search) {
        if (filters.search.length >= 3) {
          query = query.textSearch('search_vector', filters.search, { type: 'websearch', config: 'portuguese' });
        } else {
          query = query.or(`full_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
        }
      }

      if (multiStatuses) {
        query = query.in('status', multiStatuses);
      } else if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.classification !== 'all') {
        // 'qualificado' inclui também 'estrategico' (super qualificado) pois são mais qualificados ainda
        if (filters.classification === 'qualificado') {
          query = query.in('classification', ['qualificado', 'estrategico']);
        } else {
          query = query.eq('classification', filters.classification);
        }
      }

      if (filters.source !== 'all') {
        query = query.eq('source', filters.source);
      }

      if (filters.familyIncomeRange !== 'all') {
        query = query.eq('family_income_range', filters.familyIncomeRange);
      }

      if (filters.entryDateStart) {
        query = query.gte('created_at', `${filters.entryDateStart}T00:00:00.000Z`);
      }
      if (filters.entryDateEnd) {
        query = query.lte('created_at', `${filters.entryDateEnd}T23:59:59.999Z`);
      }

      if (filters.wonDateStart) {
        query = query.gte('closed_at', `${filters.wonDateStart}T00:00:00.000Z`);
      }
      if (filters.wonDateEnd) {
        query = query.lte('closed_at', `${filters.wonDateEnd}T23:59:59.999Z`);
      }

      if (filters.cargo) query = query.eq('cargo', filters.cargo);

      if (filters.utmSource) query = query.ilike('utm_source', `%${filters.utmSource}%`);
      if (filters.utmMedium) query = query.ilike('utm_medium', `%${filters.utmMedium}%`);
      if (filters.utmCampaign) query = query.ilike('utm_campaign', `%${filters.utmCampaign}%`);
      if (filters.utmContent) query = query.ilike('utm_content', `%${filters.utmContent}%`);
      if (filters.utmTerm) query = query.ilike('utm_term', `%${filters.utmTerm}%`);

      if (filters.scoreMin > 0) query = query.gte('score_total', filters.scoreMin);
      if (filters.scoreMax < 100) query = query.lte('score_total', filters.scoreMax);

      if (staleOnly && staleLeadIds.length > 0) {
        query = query.in('id', staleLeadIds);
      } else if (staleOnly && staleLeadIds.length === 0) {
        // Nenhum lead stale — retorna vazio sem bater no banco
        setLeads([]);
        setLoading(false);
        return;
      }

      const { data: leadsData, error } = await query.order('score_total', { ascending: false }).order('created_at', { ascending: false });

      if (error) throw error;

      let filteredLeads = leadsData || [];

      if (filters.tagIds.length > 0) {
        const { data: leadTagsData, error: leadTagsError } = await supabase
          .from('lead_tags')
          .select('lead_id, tag_id, tags(id, name, color)')
          .in('tag_id', filters.tagIds);

        if (leadTagsError) throw leadTagsError;

        const leadIdsWithSelectedTags = new Set(leadTagsData?.map(lt => lt.lead_id));
        filteredLeads = filteredLeads.filter(lead => leadIdsWithSelectedTags.has(lead.id));
      }

      const leadIds = filteredLeads.map(lead => lead.id);
      if (leadIds.length > 0) {
        const { data: allLeadTags, error: allLeadTagsError } = await supabase
          .from('lead_tags')
          .select('lead_id, tags(id, name, color)')
          .in('lead_id', leadIds);

        if (!allLeadTagsError && allLeadTags) {
          const tagsByLead = allLeadTags.reduce((acc, lt) => {
            if (!acc[lt.lead_id]) acc[lt.lead_id] = [];
            if (lt.tags) {
              acc[lt.lead_id].push(lt.tags as unknown as Tag);
            }
            return acc;
          }, {} as Record<string, Tag[]>);

          filteredLeads = filteredLeads.map(lead => ({
            ...lead,
            tags: tagsByLead[lead.id] || []
          }));
        }
      }

      setLeads(filteredLeads);
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateLeadStatus = async (leadId: string, status: LeadStatus) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status })
        .eq('id', leadId);

      if (error) throw error;

      await supabase.from('activities').insert({
        lead_id: leadId,
        type: 'status_change',
        channel: 'internal',
        user_id: profile?.id,
        content: `Status alterado para: ${status}`,
      });

      loadLeads();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const assignLead = async (leadId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ owner_user_id: userId })
        .eq('id', leadId);

      if (error) throw error;

      const assignedUser = users.find(u => u.id === userId);
      const userName = assignedUser?.full_name || assignedUser?.email || 'um usuário';

      await supabase.from('activities').insert({
        lead_id: leadId,
        type: 'note',
        channel: 'internal',
        user_id: profile?.id,
        content: `Lead atribuído para ${userName}`,
      });

      loadLeads();
    } catch (error) {
      console.error('Error assigning lead:', error);
    }
  };

  const getClassificationColor = (classification: LeadClassification) => {
    switch (classification) {
      case 'estrategico':
        return 'bg-green-100 text-green-800';
      case 'qualificado':
        return 'bg-yellow-100 text-yellow-800';
      case 'morno':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStageDisplay = (statusKey: string) => {
    const stage = stages.find(s => s.stage_key === statusKey);
    return stage ? { name: stage.name, color: stage.color } : { name: statusKey.replace('_', ' '), color: '#6B7280' };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando leads...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {staleOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3 text-sm text-amber-800">
          <span className="text-amber-500">⚠️</span>
          <span>Mostrando <strong>{leads.length} lead{leads.length !== 1 ? 's' : ''} estratégico{leads.length !== 1 ? 's' : ''}</strong> sem atividade há mais de 24h</span>
          <button
            onClick={() => { setStaleOnly(false); window.history.replaceState({}, '', '/leads'); }}
            className="ml-auto text-amber-700 underline font-medium hover:text-amber-900"
          >
            Ver todos os leads
          </button>
        </div>
      )}
      {urlFilter && !staleOnly && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-3 text-sm text-blue-800">
          <span>🔍</span>
          <span>Filtro ativo: <strong>{urlFilter}</strong> — {leads.length} lead{leads.length !== 1 ? 's' : ''}</span>
          <button
            onClick={() => {
              setFilters(f => ({ ...f, status: 'all', classification: 'all', entryDateStart: '', entryDateEnd: '', scoreMin: 0, scoreMax: 100 }));
              setMultiStatuses(null);
              window.history.replaceState({}, '', '/leads');
            }}
            className="ml-auto text-blue-700 underline font-medium hover:text-blue-900"
          >
            Limpar filtro
          </button>
        </div>
      )}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
        <a
          href="/leads/import"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Importar Leads
        </a>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou email..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-5 h-5" />
            Filtros
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as LeadStatus | 'all' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.stage_key}>{stage.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classificação</label>
              <select
                value={filters.classification}
                onChange={(e) => setFilters({ ...filters, classification: e.target.value as LeadClassification | 'all' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todas</option>
                <option value="estrategico">Super qualificado</option>
                <option value="qualificado">Qualificado</option>
                <option value="morno">Morno</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Score Mínimo</label>
              <input
                type="number"
                min="0"
                max="100"
                value={filters.scoreMin}
                onChange={(e) => setFilters({ ...filters, scoreMin: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Score Máximo</label>
              <input
                type="number"
                min="0"
                max="100"
                value={filters.scoreMax}
                onChange={(e) => setFilters({ ...filters, scoreMax: parseInt(e.target.value) || 100 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <TagIcon className="w-4 h-4" />
                Filtrar por Etiquetas
              </label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      const isSelected = filters.tagIds.includes(tag.id);
                      setFilters({
                        ...filters,
                        tagIds: isSelected
                          ? filters.tagIds.filter(id => id !== tag.id)
                          : [...filters.tagIds, tag.id]
                      });
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      filters.tagIds.includes(tag.id)
                        ? 'ring-2 ring-offset-2 shadow-md'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: tag.color,
                      color: 'white'
                    }}
                  >
                    {tag.name}
                    {filters.tagIds.includes(tag.id) && (
                      <X className="w-3 h-3 inline-block ml-1" />
                    )}
                  </button>
                ))}
                {availableTags.length === 0 && (
                  <p className="text-gray-500 text-sm">Nenhuma etiqueta disponível. Crie etiquetas na página de Etiquetas.</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Faixa de Renda</label>
              <select
                value={filters.familyIncomeRange}
                onChange={(e) => setFilters({ ...filters, familyIncomeRange: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todas</option>
                <option value="ate_10k">Até R$ 10 mil</option>
                <option value="10k_25k">R$ 10 mil a R$ 25 mil</option>
                <option value="25k_50k">R$ 25 mil a R$ 50 mil</option>
                <option value="acima_50k">Acima de R$ 50 mil</option>
                <option value="prefiro_nao_informar">Prefiro informar na conversa</option>
              </select>
            </div>

            <div className="md:col-span-4 mt-4 mb-2 border-b border-gray-100 pb-2">
              <h4 className="text-sm font-semibold text-gray-700">Filtros de Data</h4>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de Entrada (De)</label>
              <input
                type="date"
                value={filters.entryDateStart}
                onChange={(e) => setFilters({ ...filters, entryDateStart: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de Entrada (Ate)</label>
              <input
                type="date"
                value={filters.entryDateEnd}
                onChange={(e) => setFilters({ ...filters, entryDateEnd: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de Ganho (De)</label>
              <input
                type="date"
                value={filters.wonDateStart}
                onChange={(e) => setFilters({ ...filters, wonDateStart: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de Ganho (Ate)</label>
              <input
                type="date"
                value={filters.wonDateEnd}
                onChange={(e) => setFilters({ ...filters, wonDateEnd: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
              <select
                value={filters.cargo}
                onChange={(e) => setFilters({ ...filters, cargo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {cargoOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4 mt-4 mb-2 border-b border-gray-100 pb-2">
              <h4 className="text-sm font-semibold text-gray-700">Parâmetros UTM</h4>
            </div>

            <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UTM Source</label>
                <input
                  type="text"
                  placeholder="Ex: facebook"
                  value={filters.utmSource}
                  onChange={(e) => setFilters({ ...filters, utmSource: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UTM Medium</label>
                <input
                  type="text"
                  placeholder="Ex: cpc"
                  value={filters.utmMedium}
                  onChange={(e) => setFilters({ ...filters, utmMedium: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UTM Campaign</label>
                <input
                  type="text"
                  placeholder="Ex: black_friday"
                  value={filters.utmCampaign}
                  onChange={(e) => setFilters({ ...filters, utmCampaign: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UTM Content</label>
                <input
                  type="text"
                  placeholder="Ex: video_1"
                  value={filters.utmContent}
                  onChange={(e) => setFilters({ ...filters, utmContent: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UTM Term</label>
                <input
                  type="text"
                  placeholder="Ex: supermercado"
                  value={filters.utmTerm}
                  onChange={(e) => setFilters({ ...filters, utmTerm: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow">
        <div>
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Lead
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contato
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Classificação
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Origem
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div>
                      <a
                        href={`/leads/${lead.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600"
                      >
                        {lead.full_name}
                      </a>
                      {lead.campaign && (
                        <div className="text-xs text-gray-500">{lead.campaign}</div>
                      )}
                      {lead.tags && lead.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {lead.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-block px-2 py-0.5 text-xs rounded-full"
                              style={{
                                backgroundColor: tag.color,
                                color: 'white'
                              }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-sm text-gray-900 hover:text-blue-600">
                      <Phone className="w-3 h-3" />
                      {lead.phone}
                    </a>
                    {lead.email && (
                      <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
                        <Mail className="w-3 h-3" />
                        {lead.email}
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-bold text-gray-900">{lead.score_total}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getClassificationColor(lead.classification)}`}>
                    {lead.classification}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="relative group">
                    <button 
                      className={`px-3 py-1 text-xs font-medium rounded-full flex items-center gap-1.5 border hover:opacity-80 transition-opacity`}
                      style={{ 
                        backgroundColor: `${getStageDisplay(lead.status).color}15`, 
                        color: getStageDisplay(lead.status).color,
                        borderColor: `${getStageDisplay(lead.status).color}30`
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getStageDisplay(lead.status).color }}></span>
                      {getStageDisplay(lead.status).name}
                      <ChevronDown className="w-3 h-3 ml-0.5" />
                    </button>
                    <div className="absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 hidden group-hover:block z-50">
                      <div className="max-h-60 overflow-y-auto">
                        {stages.map((stage) => (
                          <button
                            key={stage.id}
                            onClick={() => updateLeadStatus(lead.id, stage.stage_key as LeadStatus)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }}></span>
                            {stage.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {lead.source}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(lead.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="relative group">
                    <button 
                      className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors ${
                        lead.owner_user_id 
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                          : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      {lead.owner_user_id 
                        ? (users.find(u => u.id === lead.owner_user_id)?.full_name?.split(' ')[0] || 'Atribuído') 
                        : 'Atribuir Lead'}
                      <ChevronDown className="w-3 h-3 ml-0.5" />
                    </button>
                    <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 hidden group-hover:block z-50">
                      <div className="max-h-60 overflow-y-auto">
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
                          Selecione o responsável
                        </div>
                        {users.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => assignLead(lead.id, user.id)}
                            className={`w-full text-left px-4 py-2 text-sm flex flex-col hover:bg-gray-50 ${
                              lead.owner_user_id === user.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                            }`}
                          >
                            <span className="font-medium">{user.full_name || 'Usuário'}</span>
                            <span className="text-xs opacity-70">{user.email}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {leads.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">Nenhum lead encontrado</div>
          </div>
        )}
      </div>
    </div>
  );
}
