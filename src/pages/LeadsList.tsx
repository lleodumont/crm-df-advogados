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

interface LeadWithTags extends Lead {
  tags?: Tag[];
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
}

export default function LeadsList() {
  const { profile } = useAuth();
  const [leads, setLeads] = useState<LeadWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: 'all',
    classification: 'all',
    source: 'all',
    scoreMin: 0,
    scoreMax: 100,
    familyIncomeRange: 'all',
    tagIds: [],
  });

  useEffect(() => {
    loadLeads();
    loadTags();
  }, [filters]);

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

  const loadLeads = async () => {
    setLoading(true);
    try {
      let query = supabase.from('leads').select('*');

      if (filters.search) {
        query = query.or(`full_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      }

      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.classification !== 'all') {
        query = query.eq('classification', filters.classification);
      }

      if (filters.source !== 'all') {
        query = query.eq('source', filters.source);
      }

      if (filters.familyIncomeRange !== 'all') {
        query = query.eq('family_income_range', filters.familyIncomeRange);
      }

      query = query.gte('score_total', filters.scoreMin).lte('score_total', filters.scoreMax);

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

  const assignToMe = async (leadId: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ owner_user_id: profile?.id })
        .eq('id', leadId);

      if (error) throw error;

      await supabase.from('activities').insert({
        lead_id: leadId,
        type: 'note',
        channel: 'internal',
        user_id: profile?.id,
        content: `Lead atribuído para ${profile?.full_name || profile?.email}`,
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

  const getStatusColor = (status: LeadStatus) => {
    switch (status) {
      case 'ganho':
        return 'bg-green-100 text-green-800';
      case 'perdido':
        return 'bg-red-100 text-red-800';
      case 'proposta_enviada':
        return 'bg-blue-100 text-blue-800';
      case 'compareceu':
        return 'bg-blue-100 text-blue-800';
      case 'agendado':
        return 'bg-cyan-100 text-cyan-800';
      case 'qualificado':
        return 'bg-yellow-100 text-yellow-800';
      case 'triagem':
        return 'bg-orange-100 text-orange-800';
      case 'maturacao':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
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
                <option value="novo">Novo</option>
                <option value="triagem">Triagem</option>
                <option value="qualificado">Qualificado</option>
                <option value="agendado">Agendado</option>
                <option value="compareceu">Compareceu</option>
                <option value="proposta_enviada">Proposta Enviada</option>
                <option value="ganho">Ganho</option>
                <option value="perdido">Perdido</option>
                <option value="maturacao">Maturação</option>
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
                <option value="estrategico">Qualificado de alto valor</option>
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
                      color: 'white',
                      ringColor: tag.color
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
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
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
                    <button className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusColor(lead.status)} flex items-center gap-1`}>
                      {lead.status.replace('_', ' ')}
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <div className="absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 hidden group-hover:block z-10">
                      {['novo', 'triagem', 'qualificado', 'agendado', 'compareceu', 'proposta_enviada', 'ganho', 'perdido', 'maturacao'].map((status) => (
                        <button
                          key={status}
                          onClick={() => updateLeadStatus(lead.id, status as LeadStatus)}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg capitalize"
                        >
                          {status.replace('_', ' ')}
                        </button>
                      ))}
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
                  {!lead.owner_user_id && (
                    <button
                      onClick={() => assignToMe(lead.id)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Atribuir a mim
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {leads.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">Nenhum lead encontrado</div>
          </div>
        )}
      </div>
    </div>
  );
}
