import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Phone, Mail, TrendingUp, Calendar, Plus, X, FileText, Clock } from 'lucide-react';
import type { Database } from '../lib/database.types';
import { useAuth } from '../contexts/AuthContext';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Tables']['leads']['Row']['status'];
type LeadClassification = Database['public']['Tables']['leads']['Row']['classification'];
type LeadAnswer = Database['public']['Tables']['lead_answers']['Row'];

const statusColumns: { status: LeadStatus; label: string; color: string; dotColor: string }[] = [
  { status: 'novo', label: 'NOVO', color: 'bg-gray-50', dotColor: 'bg-gray-400' },
  { status: 'triagem', label: 'EM ATENDIMENTO', color: 'bg-orange-50', dotColor: 'bg-orange-400' },
  { status: 'qualificado', label: 'AGENDADO', color: 'bg-yellow-50', dotColor: 'bg-yellow-500' },
  { status: 'agendado', label: 'AGENDADO', color: 'bg-cyan-50', dotColor: 'bg-cyan-400' },
  { status: 'compareceu', label: 'COMPARECEU', color: 'bg-blue-50', dotColor: 'bg-blue-500' },
  { status: 'proposta_enviada', label: 'PROPOSTA', color: 'bg-purple-50', dotColor: 'bg-purple-500' },
  { status: 'ganho', label: 'GANHO', color: 'bg-green-50', dotColor: 'bg-green-500' },
  { status: 'perdido', label: 'PERDIDO', color: 'bg-red-50', dotColor: 'bg-red-400' },
];

export default function Pipeline() {
  const { profile } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadAnswers, setLeadAnswers] = useState<LeadAnswer[]>([]);
  const [newLead, setNewLead] = useState({
    full_name: '',
    phone: '',
    email: '',
    source: 'manual',
    campaign: '',
    notes: '',
  });

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .neq('status', 'maturacao')
        .order('score_total', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateLeadStatus = async (leadId: string, newStatus: LeadStatus) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', leadId);

      if (error) throw error;

      await supabase.from('activities').insert({
        lead_id: leadId,
        type: 'status_change',
        channel: 'internal',
        user_id: profile?.id,
        content: `Status alterado para: ${newStatus}`,
      });

      loadLeads();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleDragStart = (leadId: string) => {
    setDraggedLead(leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    if (draggedLead) {
      updateLeadStatus(draggedLead, status);
      setDraggedLead(null);
    }
  };

  const getClassificationBadge = (classification: LeadClassification) => {
    const colors = {
      estrategico: 'bg-green-500',
      qualificado: 'bg-yellow-500',
      morno: 'bg-gray-400',
    };
    return colors[classification] || colors.morno;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}min`;
    } else if (diffHours < 24) {
      return `${diffHours}h`;
    } else if (diffDays === 1) {
      return '1d';
    } else if (diffDays < 30) {
      return `${diffDays}d`;
    } else {
      return formatDate(dateString);
    }
  };

  const getClassificationColor = (classification: string) => {
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

  const formatQuestionKey = (key: string) => {
    const translations: Record<string, string> = {
      'stage': 'Estágio de Decisão',
      'urgency_now': 'Urgência',
      'has_assets': 'Possui Bens',
      'assets_range': 'Faixa de Patrimônio',
      'separated': 'Está Separado',
      'has_children': 'Possui Filhos',
      'divorce_formalized': 'Divórcio Formalizado',
      'decisao_real': 'Decisão Real (Triagem)',
      'urgencia_real': 'Urgência Real (Triagem)',
      'patrimonio_real': 'Patrimônio Real (Triagem)',
    };
    return translations[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatAnswerValue = (value: string) => {
    const translations: Record<string, string> = {
      'sim': 'Sim',
      'nao': 'Não',
      'decidi_estruturar': 'Decidiu estruturar o divórcio',
      'avaliando': 'Apenas avaliando',
      'quase_decidido': 'Quase decidido',
      'ja_existe_processo': 'Já existe processo judicial',
      'ameaca_processo': 'Ameaça de processo',
      'organizar_com_calma': 'Quer organizar com calma',
      'ate_200k': 'Até R$ 200 mil',
      '200k_500k': 'R$ 200 mil - R$ 500 mil',
      '500k_1m': 'R$ 500 mil - R$ 1 milhão',
      'acima_1m': 'Acima de R$ 1 milhão',
      'tomada': 'Decisão tomada',
      'possibilidade_reconciliar': 'Possibilidade de reconciliar',
      'apenas_avaliando': 'Apenas avaliando',
      'simples': 'Simples (sem bens complexos)',
      'empresa_imovel': 'Empresa ou imóvel financiado',
      'muito_complexo': 'Muito complexo (múltiplos ativos)',
    };
    return translations[value] || value;
  };

  const openLeadDetail = async (lead: Lead) => {
    setSelectedLead(lead);
    try {
      const { data, error } = await supabase
        .from('lead_answers')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeadAnswers(data || []);
    } catch (error) {
      console.error('Error loading lead answers:', error);
      setLeadAnswers([]);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newLead.full_name || !newLead.phone) {
      alert('Nome e telefone são obrigatórios');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('leads')
        .insert({
          full_name: newLead.full_name,
          phone: newLead.phone,
          email: newLead.email || null,
          source: newLead.source,
          campaign: newLead.campaign || null,
          notes: newLead.notes || null,
          owner_user_id: profile?.id,
          status: 'novo',
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        await supabase.from('activities').insert({
          lead_id: data.id,
          type: 'note',
          channel: 'internal',
          user_id: profile?.id,
          content: 'Lead criado manualmente no pipeline',
        });
      }

      setShowNewLeadModal(false);
      setNewLead({
        full_name: '',
        phone: '',
        email: '',
        source: 'manual',
        campaign: '',
        notes: '',
      });
      loadLeads();
    } catch (error) {
      console.error('Error creating lead:', error);
      alert('Erro ao criar lead. Tente novamente.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando pipeline...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Pipeline</h1>
        <button
          onClick={() => setShowNewLeadModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Lead
        </button>
      </div>

      {showNewLeadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Criar Novo Lead</h2>
              <button
                onClick={() => setShowNewLeadModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={newLead.full_name}
                  onChange={(e) => setNewLead({ ...newLead, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Digite o nome completo"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Origem
                  </label>
                  <select
                    value={newLead.source}
                    onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="manual">Manual</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="google">Google</option>
                    <option value="website">Website</option>
                    <option value="referral">Indicação</option>
                    <option value="other">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Campanha
                  </label>
                  <input
                    type="text"
                    value={newLead.campaign}
                    onChange={(e) => setNewLead({ ...newLead, campaign: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nome da campanha"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={newLead.notes}
                  onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Observações sobre o lead..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewLeadModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Criar Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedLead(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-900">{selectedLead.full_name}</h2>
              <button
                onClick={() => setSelectedLead(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Score Total</div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                      <span className="text-2xl font-bold text-gray-900">{selectedLead.score_total}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Classificação</div>
                    <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full capitalize ${getClassificationColor(selectedLead.classification)}`}>
                      {selectedLead.classification}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Status</div>
                    <span className="text-sm font-medium text-gray-900 capitalize">{selectedLead.status.replace('_', ' ')}</span>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Origem</div>
                    <span className="text-sm font-medium text-gray-900">{selectedLead.source}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <div className="text-xs text-gray-600">Decisão</div>
                    <div className="text-lg font-bold text-gray-900">{selectedLead.score_decision}/40</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Urgência</div>
                    <div className="text-lg font-bold text-gray-900">{selectedLead.score_urgency}/30</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Patrimônio</div>
                    <div className="text-lg font-bold text-gray-900">{selectedLead.score_assets}/25</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Fit Oferta</div>
                    <div className="text-lg font-bold text-gray-900">{selectedLead.score_fit}/5</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Contato</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="text-xs text-gray-500">Telefone</div>
                      <a
                        href={`https://wa.me/${selectedLead.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {selectedLead.phone}
                      </a>
                    </div>
                  </div>
                  {selectedLead.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Email</div>
                        <a
                          href={`mailto:${selectedLead.email}`}
                          className="text-sm font-medium text-blue-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {selectedLead.email}
                        </a>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="text-xs text-gray-500">Entrada</div>
                      <div className="text-sm font-medium text-gray-900">{formatDateTime(selectedLead.created_at)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {selectedLead.campaign && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Campanha</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-sm font-medium text-gray-900">{selectedLead.campaign}</div>
                  </div>
                </div>
              )}

              {selectedLead.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Notas</h3>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="text-sm text-gray-900">{selectedLead.notes}</div>
                  </div>
                </div>
              )}

              {leadAnswers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Respostas do Formulário</h3>
                  <div className="space-y-2">
                    {leadAnswers
                      .filter(a => !a.question_key.startsWith('utm_') && !a.question_key.includes('_id'))
                      .map((answer) => (
                        <div key={answer.id} className="bg-white border border-gray-200 rounded-lg p-3 flex justify-between items-start">
                          <div className="flex-1">
                            <div className="text-xs font-medium text-gray-700 mb-1">{formatQuestionKey(answer.question_key)}</div>
                            <div className="text-sm text-gray-900 font-medium">{formatAnswerValue(answer.answer_value)}</div>
                          </div>
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded ml-2">{answer.source}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {leadAnswers.some(a => a.question_key.startsWith('utm_') || a.question_key.includes('_id')) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Parâmetros de Rastreamento</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {leadAnswers
                      .filter(a => a.question_key.startsWith('utm_') || a.question_key.includes('_id'))
                      .map((answer) => (
                        <div key={answer.id} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="text-xs text-blue-600 mb-1">{answer.question_key}</div>
                          <div className="text-sm font-medium text-gray-900 break-all">{answer.answer_value}</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <a
                  href={`/leads/${selectedLead.id}`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FileText className="w-4 h-4" />
                  Ver Detalhes Completos
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {statusColumns.map((column) => {
          const columnLeads = leads.filter((lead) => lead.status === column.status);

          return (
            <div
              key={column.status}
              className="flex-shrink-0 w-80"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.status)}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${column.dotColor}`} />
                <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {column.label}
                </h2>
                <span className="text-xs font-semibold text-gray-400 ml-auto">{columnLeads.length}</span>
              </div>

              <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
                {columnLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => handleDragStart(lead.id)}
                    onClick={() => openLeadDetail(lead)}
                    className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        {lead.classification === 'estrategico' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 mb-1">
                            ESTRATÉGICO
                          </span>
                        )}
                        {lead.classification === 'qualificado' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700 mb-1">
                            QUALIFICADO
                          </span>
                        )}
                        <h3 className="font-semibold text-gray-900 text-sm truncate">
                          {lead.full_name}
                        </h3>
                      </div>
                      <span className="text-xs text-gray-400 ml-2 flex-shrink-0">#{lead.id.slice(0, 6)}</span>
                    </div>

                    {lead.source && (
                      <div className="mb-2">
                        <span className="text-xs text-gray-500">
                          {lead.source === 'facebook' ? 'SaaS' : lead.source} • Tier 1
                        </span>
                      </div>
                    )}

                    {(lead.utm_source || lead.utm_campaign) && (
                      <div className="mb-2">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" />
                          <span className="italic">
                            {lead.utm_campaign || lead.utm_source || 'Sem agendamento'}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-900">
                          R$ {((lead.deal_value || 15000) / 1000).toFixed(1).replace('.', ',')}k
                        </span>
                      </div>
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-600">
                        {lead.full_name.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  </div>
                ))}

                {columnLeads.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    Arraste leads aqui
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
