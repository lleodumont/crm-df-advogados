import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Phone, Mail, TrendingUp, Calendar, FileText, DollarSign, Clock, MessageSquare, ArrowLeft, BarChart3, CheckCircle, Tag as TagIcon, Plus, X } from 'lucide-react';
import type { Database } from '../lib/database.types';
import { useAuth } from '../contexts/AuthContext';
import WhatsAppChat from '../components/WhatsAppChat';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadAnswer = Database['public']['Tables']['lead_answers']['Row'];
type Activity = Database['public']['Tables']['activities']['Row'];
type Meeting = Database['public']['Tables']['meetings']['Row'];
type Proposal = Database['public']['Tables']['proposals']['Row'];
type ScheduledActivity = Database['public']['Tables']['scheduled_activities']['Row'];

interface Tag {
  id: string;
  name: string;
  color: string;
}

export default function LeadDetail() {
  const id = window.location.pathname.split('/')[2];
  const { profile } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [answers, setAnswers] = useState<LeadAnswer[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [scheduledActivities, setScheduledActivities] = useState<ScheduledActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'validation' | 'meetings' | 'proposals' | 'scheduled' | 'whatsapp'>('timeline');
  const [leadTags, setLeadTags] = useState<Tag[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [showTagSelector, setShowTagSelector] = useState(false);

  const [validationForm, setValidationForm] = useState({
    decisao_real: '',
    urgencia_real: '',
    patrimonio_real: '',
  });

  const [newActivity, setNewActivity] = useState('');
  const [newMeeting, setNewMeeting] = useState({
    scheduled_at: '',
    notes: '',
  });
  const [newProposal, setNewProposal] = useState({
    presented_at: '',
    value: '',
    payment_terms: '',
  });
  const [newScheduledActivity, setNewScheduledActivity] = useState({
    activity_type: 'call' as const,
    title: '',
    description: '',
    scheduled_at: '',
    priority: 'medium' as const,
    duration_minutes: '',
  });

  useEffect(() => {
    if (id) {
      loadLeadData();
    }
  }, [id]);

  const loadLeadData = async () => {
    setLoading(true);
    try {
      const [leadRes, answersRes, activitiesRes, meetingsRes, proposalsRes, scheduledRes, tagsRes, allTagsRes] = await Promise.all([
        supabase.from('leads').select('*').eq('id', id).maybeSingle(),
        supabase.from('lead_answers').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
        supabase.from('activities').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
        supabase.from('meetings').select('*').eq('lead_id', id).order('scheduled_at', { ascending: false }),
        supabase.from('proposals').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
        supabase.from('scheduled_activities').select('*').eq('lead_id', id).order('scheduled_at', { ascending: true }),
        supabase.from('lead_tags').select('tags(id, name, color)').eq('lead_id', id),
        supabase.from('tags').select('*').order('name'),
      ]);

      setLead(leadRes.data);
      setAnswers(answersRes.data || []);
      setActivities(activitiesRes.data || []);
      setMeetings(meetingsRes.data || []);
      setProposals(proposalsRes.data || []);
      setScheduledActivities(scheduledRes.data || []);
      setLeadTags(tagsRes.data?.map(lt => lt.tags as unknown as Tag).filter(Boolean) || []);
      setAvailableTags(allTagsRes.data || []);
    } catch (error) {
      console.error('Error loading lead data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveValidation = async () => {
    if (!id) return;

    try {
      const validationAnswers = [
        { lead_id: id, question_key: 'decisao_real', answer_value: validationForm.decisao_real, source: 'triagem_humana' as const },
        { lead_id: id, question_key: 'urgencia_real', answer_value: validationForm.urgencia_real, source: 'triagem_humana' as const },
        { lead_id: id, question_key: 'patrimonio_real', answer_value: validationForm.patrimonio_real, source: 'triagem_humana' as const },
      ];

      const { error } = await supabase.from('lead_answers').insert(validationAnswers);
      if (error) throw error;

      await supabase.rpc('calculate_lead_score', { p_lead_id: id });

      setValidationForm({ decisao_real: '', urgencia_real: '', patrimonio_real: '' });
      loadLeadData();
      alert('Validação salva com sucesso!');
    } catch (error) {
      console.error('Error saving validation:', error);
      alert('Erro ao salvar validação');
    }
  };

  const addActivity = async () => {
    if (!id || !newActivity) return;

    try {
      const { error } = await supabase.from('activities').insert({
        lead_id: id,
        type: 'note',
        channel: 'internal',
        user_id: profile?.id,
        content: newActivity,
      });

      if (error) throw error;
      setNewActivity('');
      loadLeadData();
    } catch (error) {
      console.error('Error adding activity:', error);
    }
  };

  const createMeeting = async () => {
    if (!id || !newMeeting.scheduled_at) return;

    try {
      const { error } = await supabase.from('meetings').insert({
        lead_id: id,
        scheduled_at: newMeeting.scheduled_at,
        notes: newMeeting.notes,
        responsible_user_id: profile?.id,
        status: 'scheduled',
      });

      if (error) throw error;
      setNewMeeting({ scheduled_at: '', notes: '' });
      loadLeadData();
      alert('Reunião agendada com sucesso!');
    } catch (error) {
      console.error('Error creating meeting:', error);
      alert('Erro ao agendar reunião');
    }
  };

  const updateMeetingStatus = async (meetingId: string, status: 'held' | 'no_show' | 'canceled') => {
    try {
      const updateData: any = { status };
      if (status === 'held') {
        updateData.held_at = new Date().toISOString();
      }

      const { error } = await supabase.from('meetings').update(updateData).eq('id', meetingId);

      if (error) throw error;

      if (id && status === 'held') {
        await supabase.from('leads').update({ status: 'compareceu' }).eq('id', id);
      }

      loadLeadData();
    } catch (error) {
      console.error('Error updating meeting:', error);
    }
  };

  const createProposal = async () => {
    if (!id || !newProposal.presented_at || !newProposal.value) return;

    try {
      const { error } = await supabase.from('proposals').insert({
        lead_id: id,
        presented_at: newProposal.presented_at,
        value: parseFloat(newProposal.value),
        payment_terms: newProposal.payment_terms,
        status: 'open',
      });

      if (error) throw error;
      setNewProposal({ presented_at: '', value: '', payment_terms: '' });
      loadLeadData();
      alert('Proposta criada com sucesso!');
    } catch (error) {
      console.error('Error creating proposal:', error);
      alert('Erro ao criar proposta');
    }
  };

  const createScheduledActivity = async () => {
    if (!id || !newScheduledActivity.title || !newScheduledActivity.scheduled_at || !profile) return;

    try {
      const { error } = await supabase.from('scheduled_activities').insert({
        lead_id: id,
        user_id: profile.id,
        activity_type: newScheduledActivity.activity_type,
        title: newScheduledActivity.title,
        description: newScheduledActivity.description || null,
        scheduled_at: newScheduledActivity.scheduled_at,
        priority: newScheduledActivity.priority,
        duration_minutes: newScheduledActivity.duration_minutes ? parseInt(newScheduledActivity.duration_minutes) : null,
        status: 'scheduled',
      });

      if (error) throw error;
      setNewScheduledActivity({
        activity_type: 'call',
        title: '',
        description: '',
        scheduled_at: '',
        priority: 'medium',
        duration_minutes: '',
      });
      loadLeadData();
      alert('Atividade agendada com sucesso!');
    } catch (error) {
      console.error('Error creating scheduled activity:', error);
      alert('Erro ao agendar atividade');
    }
  };

  const updateScheduledActivityStatus = async (activityId: string, status: 'completed' | 'cancelled') => {
    try {
      const updateData: any = { status };
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase.from('scheduled_activities').update(updateData).eq('id', activityId);

      if (error) throw error;
      loadLeadData();
    } catch (error) {
      console.error('Error updating scheduled activity:', error);
    }
  };

  const updateProposalStatus = async (proposalId: string, status: 'won' | 'lost', lossReason?: string) => {
    try {
      const { error } = await supabase
        .from('proposals')
        .update({ status, loss_reason: lossReason })
        .eq('id', proposalId);

      if (error) throw error;
      loadLeadData();
      alert(status === 'won' ? 'Proposta ganha!' : 'Proposta perdida registrada.');
    } catch (error) {
      console.error('Error updating proposal:', error);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const addTag = async (tagId: string) => {
    if (!id) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('lead_tags')
        .insert({
          lead_id: id,
          tag_id: tagId,
          created_by: user.id
        });

      if (error) throw error;
      setShowTagSelector(false);
      loadLeadData();
    } catch (error) {
      console.error('Error adding tag:', error);
    }
  };

  const removeTag = async (tagId: string) => {
    if (!id) return;
    try {
      const { error } = await supabase
        .from('lead_tags')
        .delete()
        .eq('lead_id', id)
        .eq('tag_id', tagId);

      if (error) throw error;
      loadLeadData();
    } catch (error) {
      console.error('Error removing tag:', error);
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

  const getFamilyIncomeLabel = (range: string) => {
    const labels: Record<string, string> = {
      'ate_10k': 'Até R$ 10 mil',
      '10k_25k': 'R$ 10 mil a R$ 25 mil',
      '25k_50k': 'R$ 25 mil a R$ 50 mil',
      'acima_50k': 'Acima de R$ 50 mil',
      'prefiro_nao_informar': 'Prefiro informar na conversa',
    };
    return labels[range] || range;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando lead...</div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Lead não encontrado</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <a href="/leads" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </a>
        <h1 className="text-3xl font-bold text-gray-900">{lead.full_name}</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <div className="text-sm text-gray-600 mb-1">Score Total</div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">{lead.score_total}</span>
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Classificação</div>
            <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full capitalize ${getClassificationColor(lead.classification)}`}>
              {lead.classification}
            </span>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Status</div>
            <span className="text-lg font-medium text-gray-900 capitalize">{lead.status.replace('_', ' ')}</span>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Origem</div>
            <span className="text-lg font-medium text-gray-900">{lead.source}</span>
            {lead.campaign && <div className="text-xs text-gray-500">{lead.campaign}</div>}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-gray-400" />
            <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank\" rel="noopener noreferrer\" className="text-blue-600 hover:text-blue-800">
              {lead.phone}
            </a>
          </div>
          {lead.email && (
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <a href={`mailto:${lead.email}`} className="text-blue-600 hover:text-blue-800">
                {lead.email}
              </a>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className="text-gray-700">Entrada: {formatDate(lead.created_at)}</span>
          </div>
          {lead.family_income_range && (
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700">Renda: {getFamilyIncomeLabel(lead.family_income_range)}</span>
            </div>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <TagIcon className="w-4 h-4" />
              Etiquetas
            </h3>
            <button
              onClick={() => setShowTagSelector(!showTagSelector)}
              className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {leadTags.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma etiqueta adicionada</p>
            ) : (
              leadTags.map((tag) => (
                <div
                  key={tag.id}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
                  style={{ backgroundColor: tag.color, color: 'white' }}
                >
                  {tag.name}
                  <button
                    onClick={() => removeTag(tag.id)}
                    className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
          {showTagSelector && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-2">Selecione uma etiqueta para adicionar:</p>
              <div className="flex flex-wrap gap-2">
                {availableTags
                  .filter(tag => !leadTags.some(lt => lt.id === tag.id))
                  .map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => addTag(tag.id)}
                      className="px-3 py-1 rounded-full text-sm font-medium hover:ring-2 ring-offset-1 transition-all"
                      style={{ backgroundColor: tag.color, color: 'white', ringColor: tag.color }}
                    >
                      {tag.name}
                    </button>
                  ))}
                {availableTags.filter(tag => !leadTags.some(lt => lt.id === tag.id)).length === 0 && (
                  <p className="text-sm text-gray-500">Todas as etiquetas já foram adicionadas</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-600 mb-3">Marcos do Lead</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Entrada</div>
              <div className="font-medium text-gray-900">{formatDate(lead.created_at)}</div>
            </div>
            {lead.first_meeting_scheduled_at && (
              <div>
                <div className="text-gray-600">Primeira Reunião</div>
                <div className="font-medium text-gray-900">{formatDate(lead.first_meeting_scheduled_at)}</div>
              </div>
            )}
            {lead.proposal_presented_at && (
              <div>
                <div className="text-gray-600">Proposta</div>
                <div className="font-medium text-gray-900">{formatDate(lead.proposal_presented_at)}</div>
              </div>
            )}
            {lead.closed_at && (
              <div>
                <div className="text-gray-600">Fechamento</div>
                <div className="font-medium text-gray-900">{formatDate(lead.closed_at)}</div>
                {lead.deal_value && (
                  <div className="text-green-600 font-bold">R$ {lead.deal_value.toLocaleString('pt-BR')}</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-600 mb-3">Pontuação Detalhada</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-600">Decisão</div>
              <div className="text-lg font-bold text-gray-900">{lead.score_decision}/40</div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Urgência</div>
              <div className="text-lg font-bold text-gray-900">{lead.score_urgency}/30</div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Patrimônio</div>
              <div className="text-lg font-bold text-gray-900">{lead.score_assets}/25</div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Fit Oferta</div>
              <div className="text-lg font-bold text-gray-900">{lead.score_fit}/5</div>
            </div>
          </div>
        </div>

        {/* Dados Técnicos e Sistema */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-600 mb-3">Dados do Sistema</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <div className="text-gray-500 mb-1">ID do Lead</div>
              <div className="font-mono text-gray-700 break-all">{lead.id}</div>
            </div>
            {lead.assigned_to && (
              <div>
                <div className="text-gray-500 mb-1">Atribuído a</div>
                <div className="font-mono text-gray-700 break-all">{lead.assigned_to}</div>
              </div>
            )}
            <div>
              <div className="text-gray-500 mb-1">Criado em</div>
              <div className="text-gray-700">{formatDateTime(lead.created_at)}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Última Atualização</div>
              <div className="text-gray-700">{formatDateTime(lead.updated_at)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-6 py-4 text-sm font-medium ${
                activeTab === 'timeline' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setActiveTab('validation')}
              className={`px-6 py-4 text-sm font-medium ${
                activeTab === 'validation' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Validação Humana
            </button>
            <button
              onClick={() => setActiveTab('meetings')}
              className={`px-6 py-4 text-sm font-medium ${
                activeTab === 'meetings' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Reuniões ({meetings.length})
            </button>
            <button
              onClick={() => setActiveTab('proposals')}
              className={`px-6 py-4 text-sm font-medium ${
                activeTab === 'proposals' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Propostas ({proposals.length})
            </button>
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`px-6 py-4 text-sm font-medium ${
                activeTab === 'scheduled' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Atividades Agendadas ({scheduledActivities.filter(a => a.status === 'scheduled').length})
            </button>
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`px-6 py-4 text-sm font-medium ${
                activeTab === 'whatsapp' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              WhatsApp
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'timeline' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Adicionar Atividade</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newActivity}
                    onChange={(e) => setNewActivity(e.target.value)}
                    placeholder="Descrição da atividade..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={addActivity}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Dados Completos do Lead</h3>

                {/* Dados de Contato */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Contato</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Nome Completo</div>
                      <div className="text-sm font-medium text-gray-900">{lead.full_name}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Telefone</div>
                      <div className="text-sm font-medium text-gray-900">
                        <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank\" rel="noopener noreferrer\" className="text-blue-600 hover:underline">
                          {lead.phone}
                        </a>
                      </div>
                    </div>
                    {lead.email && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Email</div>
                        <div className="text-sm font-medium text-gray-900">
                          <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">
                            {lead.email}
                          </a>
                        </div>
                      </div>
                    )}
                    {(lead.city || lead.state) && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Localização</div>
                        <div className="text-sm font-medium text-gray-900">
                          {lead.city}{lead.city && lead.state ? ', ' : ''}{lead.state}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dados de Origem e Campanha */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Origem & Campanha</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Origem</div>
                      <div className="text-sm font-medium text-gray-900">{lead.source || 'Não informado'}</div>
                    </div>
                    {lead.campaign && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Campanha</div>
                        <div className="text-sm font-medium text-gray-900">{lead.campaign}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Status Atual</div>
                      <div className="text-sm font-medium text-gray-900 capitalize">{lead.status.replace('_', ' ')}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Classificação</div>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${getClassificationColor(lead.classification)}`}>
                        {lead.classification}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Respostas do Formulário */}
                {answers.some(a => !a.question_key.startsWith('utm_') && !a.question_key.includes('_id')) && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Respostas do Formulário</h4>
                    <div className="space-y-3">
                      {answers
                        .filter(a => !a.question_key.startsWith('utm_') && !a.question_key.includes('_id'))
                        .map((answer) => (
                          <div key={answer.id} className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-sm font-medium text-gray-700">{formatQuestionKey(answer.question_key)}</span>
                              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">{answer.source}</span>
                            </div>
                            <div className="text-sm text-gray-900 font-medium">{formatAnswerValue(answer.answer_value)}</div>
                            <div className="text-xs text-gray-400 mt-1">{formatDateTime(answer.created_at)}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* UTM Tracking - Sempre visível com todos os campos */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    UTM Tracking
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="text-xs font-medium text-gray-500 uppercase mb-2">UTM Source</div>
                      <div className="text-sm font-medium text-gray-900">{lead.utm_source || '—'}</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="text-xs font-medium text-gray-500 uppercase mb-2">UTM Medium</div>
                      <div className="text-sm font-medium text-gray-900">{lead.utm_medium || '—'}</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="text-xs font-medium text-gray-500 uppercase mb-2">UTM Campaign</div>
                      <div className="text-sm font-medium text-gray-900">{lead.utm_campaign || '—'}</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="text-xs font-medium text-gray-500 uppercase mb-2">UTM Content</div>
                      <div className="text-sm font-medium text-gray-900">{lead.utm_content || '—'}</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="text-xs font-medium text-gray-500 uppercase mb-2">UTM Term</div>
                      <div className="text-sm font-medium text-gray-900">{lead.utm_term || '—'}</div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="text-xs font-medium text-blue-700 uppercase mb-2">Campaign ID</div>
                      <div className="text-sm font-medium text-blue-900 font-mono break-all">{lead.campaign_id || '—'}</div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="text-xs font-medium text-blue-700 uppercase mb-2">Adset ID</div>
                      <div className="text-sm font-medium text-blue-900 font-mono break-all">{lead.adset_id || '—'}</div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="text-xs font-medium text-blue-700 uppercase mb-2">Ad ID</div>
                      <div className="text-sm font-medium text-blue-900 font-mono break-all">{lead.ad_id || '—'}</div>
                    </div>
                  </div>
                </div>

                {answers.length === 0 && (
                  <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">
                    Nenhum dado adicional registrado
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Histórico de Atividades</h3>
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-4">
                      <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900 capitalize">{activity.type.replace('_', ' ')}</span>
                          {activity.channel && (
                            <span className="text-xs text-gray-500">via {activity.channel}</span>
                          )}
                          <span className="text-xs text-gray-400">{formatDateTime(activity.created_at)}</span>
                        </div>
                        <div className="text-sm text-gray-700">{activity.content}</div>
                      </div>
                    </div>
                  ))}
                  {activities.length === 0 && (
                    <div className="text-sm text-gray-500">Nenhuma atividade registrada</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'validation' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Validação Humana</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Use esta seção para validar as informações do lead e recalcular o score com base em dados reais.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Decisão Real
                    </label>
                    <select
                      value={validationForm.decisao_real}
                      onChange={(e) => setValidationForm({ ...validationForm, decisao_real: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione...</option>
                      <option value="tomada">Decisão tomada</option>
                      <option value="possibilidade_reconciliar">Possibilidade de reconciliar</option>
                      <option value="apenas_avaliando">Apenas avaliando</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Urgência Real
                    </label>
                    <input
                      type="text"
                      value={validationForm.urgencia_real}
                      onChange={(e) => setValidationForm({ ...validationForm, urgencia_real: e.target.value })}
                      placeholder="Descreva a situação atual..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Patrimônio Real
                    </label>
                    <select
                      value={validationForm.patrimonio_real}
                      onChange={(e) => setValidationForm({ ...validationForm, patrimonio_real: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione...</option>
                      <option value="simples">Simples (sem bens complexos)</option>
                      <option value="empresa_imovel">Empresa ou imóvel financiado</option>
                      <option value="muito_complexo">Muito complexo (múltiplos ativos)</option>
                    </select>
                  </div>

                  <button
                    onClick={saveValidation}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Salvar Validação e Recalcular Score
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'meetings' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Agendar Nova Reunião</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data e Hora
                    </label>
                    <input
                      type="datetime-local"
                      value={newMeeting.scheduled_at}
                      onChange={(e) => setNewMeeting({ ...newMeeting, scheduled_at: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Observações
                    </label>
                    <textarea
                      value={newMeeting.notes}
                      onChange={(e) => setNewMeeting({ ...newMeeting, notes: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={createMeeting}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Agendar Reunião
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Reuniões</h3>
                <div className="space-y-4">
                  {meetings.map((meeting) => (
                    <div key={meeting.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-gray-400" />
                          <span className="font-medium text-gray-900">{formatDateTime(meeting.scheduled_at)}</span>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          meeting.status === 'held' ? 'bg-green-100 text-green-800' :
                          meeting.status === 'no_show' ? 'bg-red-100 text-red-800' :
                          meeting.status === 'canceled' ? 'bg-gray-100 text-gray-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {meeting.status}
                        </span>
                      </div>
                      {meeting.notes && (
                        <div className="text-sm text-gray-600 mb-2">{meeting.notes}</div>
                      )}
                      {meeting.status === 'scheduled' && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => updateMeetingStatus(meeting.id, 'held')}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Compareceu
                          </button>
                          <button
                            onClick={() => updateMeetingStatus(meeting.id, 'no_show')}
                            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Não Compareceu
                          </button>
                          <button
                            onClick={() => updateMeetingStatus(meeting.id, 'canceled')}
                            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {meetings.length === 0 && (
                    <div className="text-sm text-gray-500">Nenhuma reunião agendada</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'proposals' && (
            <div className="space-y-6">
              {(profile?.role === 'admin' || profile?.role === 'comercial') && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Criar Nova Proposta</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Data de Apresentação
                      </label>
                      <input
                        type="datetime-local"
                        value={newProposal.presented_at}
                        onChange={(e) => setNewProposal({ ...newProposal, presented_at: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Valor (R$)
                      </label>
                      <input
                        type="number"
                        value={newProposal.value}
                        onChange={(e) => setNewProposal({ ...newProposal, value: e.target.value })}
                        placeholder="0.00"
                        step="0.01"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Condições de Pagamento
                      </label>
                      <textarea
                        value={newProposal.payment_terms}
                        onChange={(e) => setNewProposal({ ...newProposal, payment_terms: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={createProposal}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Criar Proposta
                    </button>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Propostas</h3>
                <div className="space-y-4">
                  {proposals.map((proposal) => (
                    <div key={proposal.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-5 h-5 text-gray-400" />
                          <span className="font-bold text-gray-900">R$ {proposal.value.toLocaleString('pt-BR')}</span>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          proposal.status === 'won' ? 'bg-green-100 text-green-800' :
                          proposal.status === 'lost' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {proposal.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        Apresentada em: {formatDateTime(proposal.presented_at)}
                      </div>
                      {proposal.payment_terms && (
                        <div className="text-sm text-gray-700 mb-2">
                          <span className="font-medium">Condições:</span> {proposal.payment_terms}
                        </div>
                      )}
                      {proposal.loss_reason && (
                        <div className="text-sm text-red-600 mb-2">
                          <span className="font-medium">Motivo da perda:</span> {proposal.loss_reason}
                        </div>
                      )}
                      {proposal.status === 'open' && (profile?.role === 'admin' || profile?.role === 'comercial') && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => updateProposalStatus(proposal.id, 'won')}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Ganhar
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('Motivo da perda:');
                              if (reason) updateProposalStatus(proposal.id, 'lost', reason);
                            }}
                            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Perder
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {proposals.length === 0 && (
                    <div className="text-sm text-gray-500">Nenhuma proposta criada</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'scheduled' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Agendar Nova Atividade</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo de Atividade
                      </label>
                      <select
                        value={newScheduledActivity.activity_type}
                        onChange={(e) => setNewScheduledActivity({ ...newScheduledActivity, activity_type: e.target.value as any })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="call">Ligação</option>
                        <option value="email">E-mail</option>
                        <option value="follow_up">Follow-up (Mensagem)</option>
                        <option value="task">Tarefa</option>
                        <option value="meeting">Reunião</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Prioridade
                      </label>
                      <select
                        value={newScheduledActivity.priority}
                        onChange={(e) => setNewScheduledActivity({ ...newScheduledActivity, priority: e.target.value as any })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="low">Baixa</option>
                        <option value="medium">Média</option>
                        <option value="high">Alta</option>
                        <option value="urgent">Urgente</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Título
                    </label>
                    <input
                      type="text"
                      value={newScheduledActivity.title}
                      onChange={(e) => setNewScheduledActivity({ ...newScheduledActivity, title: e.target.value })}
                      placeholder="Ex: Ligar para discutir proposta"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descrição
                    </label>
                    <textarea
                      value={newScheduledActivity.description}
                      onChange={(e) => setNewScheduledActivity({ ...newScheduledActivity, description: e.target.value })}
                      rows={2}
                      placeholder="Detalhes adicionais..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Data e Hora
                      </label>
                      <input
                        type="datetime-local"
                        value={newScheduledActivity.scheduled_at}
                        onChange={(e) => setNewScheduledActivity({ ...newScheduledActivity, scheduled_at: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Duração (minutos)
                      </label>
                      <input
                        type="number"
                        value={newScheduledActivity.duration_minutes}
                        onChange={(e) => setNewScheduledActivity({ ...newScheduledActivity, duration_minutes: e.target.value })}
                        placeholder="30"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={createScheduledActivity}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Agendar Atividade
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Atividades Agendadas</h3>
                <div className="space-y-4">
                  {scheduledActivities.map((activity) => (
                    <div key={activity.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-5 h-5 text-gray-400" />
                          <span className="font-medium text-gray-900">{activity.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            activity.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                            activity.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                            activity.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {activity.priority === 'urgent' ? 'Urgente' :
                             activity.priority === 'high' ? 'Alta' :
                             activity.priority === 'medium' ? 'Média' : 'Baixa'}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            activity.status === 'completed' ? 'bg-green-100 text-green-800' :
                            activity.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            activity.status === 'overdue' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {activity.status === 'completed' ? 'Concluída' :
                             activity.status === 'cancelled' ? 'Cancelada' :
                             activity.status === 'overdue' ? 'Atrasada' : 'Agendada'}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Tipo:</span> {
                          activity.activity_type === 'call' ? 'Ligação' :
                          activity.activity_type === 'email' ? 'E-mail' :
                          activity.activity_type === 'follow_up' ? 'Follow-up' :
                          activity.activity_type === 'task' ? 'Tarefa' : 'Reunião'
                        }
                        {' • '}
                        <span className="font-medium">Data:</span> {formatDateTime(activity.scheduled_at)}
                        {activity.duration_minutes && ` • ${activity.duration_minutes} min`}
                      </div>
                      {activity.description && (
                        <div className="text-sm text-gray-700 mb-2">
                          {activity.description}
                        </div>
                      )}
                      {activity.completed_at && (
                        <div className="text-sm text-green-600 mb-2">
                          <span className="font-medium">Concluída em:</span> {formatDateTime(activity.completed_at)}
                        </div>
                      )}
                      {activity.status === 'scheduled' && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => updateScheduledActivityStatus(activity.id, 'completed')}
                            className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Concluir
                          </button>
                          <button
                            onClick={() => updateScheduledActivityStatus(activity.id, 'cancelled')}
                            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {scheduledActivities.length === 0 && (
                    <div className="text-sm text-gray-500">Nenhuma atividade agendada</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'whatsapp' && (
            <WhatsAppChat
              leadId={id!}
              leadPhone={lead.phone}
              leadName={lead.full_name}
            />
          )}
        </div>
      </div>
    </div>
  );
}
