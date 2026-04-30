import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Phone, Mail, TrendingUp, Calendar, FileText, DollarSign, Clock, MessageSquare, BarChart3, CheckCircle, Tag as TagIcon, Plus, X, CreditCard as Edit, Save, Scale, Pencil, Trash2 } from 'lucide-react';
import type { Database } from '../lib/database.types';
import { useAuth } from '../contexts/AuthContext';
import { notify } from '../lib/toast';
import WhatsAppChat from '../components/WhatsAppChat';
import Breadcrumbs from '../components/Breadcrumbs';
import CustomFieldsViewer from '../components/CustomFieldsViewer';
import ActivityModal from '../components/ActivityModal';

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

interface PipelineStage {
  id: string;
  name: string;
  stage_key: string;
  color: string;
  order_index: number;
}

export default function LeadDetail() {
  const id = window.location.pathname.split('/')[2];
  const { profile } = useAuth();
  const isJuridico = profile?.role === 'juridico';
  const [lead, setLead] = useState<Lead | null>(null);
  const [answers, setAnswers] = useState<LeadAnswer[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [scheduledActivities, setScheduledActivities] = useState<ScheduledActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'validation' | 'meetings' | 'proposals' | 'scheduled' | 'whatsapp'>('timeline');
  const [leadTags, setLeadTags] = useState<Tag[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    source: '',
    campaign: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_content: '',
    utm_term: '',
    family_income_range: '',
    status: '',
    classification: '',
  });

  const [validationForm, setValidationForm] = useState({
    decisao_real: '',
    urgencia_real: '',
    conflito_real: '',
    renda_real: '',
    filhos_menores_real: '',
    especialista_real: '',
    estagio_real: '',
    valor_bens_real: '',
    tipo_bens_real: '',
    decisor: '',
    notas_triagem: '',
    timeline_real: '',
  });

  const getMetaAnswer = (key: string) => {
    const metaAnswers = answers.filter(a => a.source === 'meta_form');
    const keyMap: Record<string, string> = {
      decisao: 'decisao_real',
      urgencia: 'urgencia_real',
      relacionamento: 'conflito_real',
      bens: 'valor_bens_real',
      filhos: 'filhos_menores_real',
      renda: 'renda_real',
      estagio: 'estagio',
    };
    const resolvedKey = keyMap[key] ?? key;
    const ans = metaAnswers.find(a => a.question_key === resolvedKey);
    return ans?.answer_value || undefined;
  };

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
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const [editProposalForm, setEditProposalForm] = useState({
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
  const [editingActivity, setEditingActivity] = useState<ScheduledActivity | null>(null);

  useEffect(() => {
    if (id) {
      loadLeadData();
    }
  }, [id]);

  const loadLeadData = async () => {
    setLoading(true);
    try {
      const [leadRes, answersRes, activitiesRes, meetingsRes, proposalsRes, scheduledRes, tagsRes, allTagsRes, stagesRes] = await Promise.all([
        supabase.from('leads').select('*').eq('id', id).maybeSingle(),
        supabase.from('lead_answers').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
        supabase.from('activities').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
        supabase.from('meetings').select('*').eq('lead_id', id).order('scheduled_at', { ascending: false }),
        supabase.from('proposals').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
        supabase.from('scheduled_activities').select('*').eq('lead_id', id).order('scheduled_at', { ascending: true }),
        supabase.from('lead_tags').select('tags(id, name, color)').eq('lead_id', id),
        supabase.from('tags').select('*').order('name'),
        supabase.from('pipeline_stages').select('*').order('order_index', { ascending: true })
      ]);

      setLead(leadRes.data);
      setAnswers(answersRes.data || []);
      setActivities(activitiesRes.data || []);
      setMeetings(meetingsRes.data || []);
      setProposals(proposalsRes.data || []);
      setScheduledActivities(scheduledRes.data || []);
      setStages(stagesRes.data || []);
      setLeadTags(tagsRes.data?.map(lt => lt.tags as unknown as Tag).filter(Boolean) || []);
      setAvailableTags(allTagsRes.data || []);

      if (leadRes.data) {
        setEditForm({
          full_name: leadRes.data.full_name || '',
          email: leadRes.data.email || '',
          phone: leadRes.data.phone || '',
          source: leadRes.data.source || '',
          campaign: leadRes.data.campaign || '',
          utm_source: leadRes.data.utm_source || '',
          utm_medium: leadRes.data.utm_medium || '',
          utm_campaign: leadRes.data.utm_campaign || '',
          utm_content: leadRes.data.utm_content || '',
          utm_term: leadRes.data.utm_term || '',
          family_income_range: leadRes.data.family_income_range || '',
          status: leadRes.data.status || '',
          classification: leadRes.data.classification || '',
        });
      }
    } catch (error) {
      console.error('Error loading lead data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditLead = async () => {
    if (!id) return;

    try {
      const { error } = await supabase
        .from('leads')
        .update({
          full_name: editForm.full_name,
          email: editForm.email || null,
          phone: editForm.phone,
          source: editForm.source,
          campaign: editForm.campaign || null,
          utm_source: editForm.utm_source || null,
          utm_medium: editForm.utm_medium || null,
          utm_campaign: editForm.utm_campaign || null,
          utm_content: editForm.utm_content || null,
          utm_term: editForm.utm_term || null,
          family_income_range: editForm.family_income_range || null,
          status: editForm.status,
          classification: editForm.classification,
        })
        .eq('id', id);

      if (error) throw error;

      await loadLeadData();
      setIsEditing(false);
      notify.success('Lead atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating lead:', error);
      notify.error('Erro ao atualizar lead');
    }
  };

  const saveValidation = async () => {
    if (!id) return;

    try {
      const validationAnswers = [
        { lead_id: id, question_key: 'decisao_real', answer_value: validationForm.decisao_real, source: 'triagem_humana' as const },
        { lead_id: id, question_key: 'urgencia_real', answer_value: validationForm.urgencia_real, source: 'triagem_humana' as const },
        { lead_id: id, question_key: 'conflito_real', answer_value: validationForm.conflito_real, source: 'triagem_humana' as const },
        { lead_id: id, question_key: 'valor_bens_real', answer_value: validationForm.valor_bens_real, source: 'triagem_humana' as const },
        { lead_id: id, question_key: 'tipo_bens_real', answer_value: validationForm.tipo_bens_real, source: 'triagem_humana' as const },
        { lead_id: id, question_key: 'renda_real', answer_value: validationForm.renda_real, source: 'triagem_humana' as const },
        { lead_id: id, question_key: 'filhos_menores_real', answer_value: validationForm.filhos_menores_real, source: 'triagem_humana' as const },
        { lead_id: id, question_key: 'especialista_real', answer_value: validationForm.especialista_real, source: 'triagem_humana' as const },
        { lead_id: id, question_key: 'estagio_real', answer_value: validationForm.estagio_real, source: 'triagem_humana' as const },
        { lead_id: id, question_key: 'timeline_real', answer_value: validationForm.timeline_real, source: 'triagem_humana' as const },
      ].filter(a => a.answer_value);

      if (validationAnswers.length === 0 && !validationForm.notas_triagem) {
        notify.error('Preencha pelo menos um campo antes de salvar.');
        return;
      }

      if (validationAnswers.length > 0) {
        const { error } = await supabase.from('lead_answers')
          .upsert(validationAnswers, { onConflict: 'lead_id,question_key' });
        if (error) throw error;
      }

      // Log activity with validator's name, timestamp, and notes
      const validatorName = profile?.full_name || profile?.email || 'Vendedor';
      const timestamp = new Date().toLocaleString('pt-BR');
      const notesText = validationForm.notas_triagem ? `\n\nNotas: ${validationForm.notas_triagem}` : '';
      await supabase.from('activities').insert({
        lead_id: id,
        type: 'note',
        channel: 'internal',
        user_id: profile?.id,
        content: `✅ Validação Humana registrada por ${validatorName} em ${timestamp}.${notesText}`,
      });

      await supabase.rpc('calculate_lead_score', { p_lead_id: id });

      setValidationForm({ 
        decisao_real: '', urgencia_real: '', conflito_real: '', renda_real: '',
        filhos_menores_real: '', especialista_real: '', estagio_real: '', valor_bens_real: '',
        tipo_bens_real: '', decisor: '', notas_triagem: '', timeline_real: ''
      });
      loadLeadData();
      notify.success('Validação salva com sucesso!');
    } catch (error) {
      console.error('Error saving validation:', error);
      notify.error('Erro ao salvar validação');
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
        scheduled_at: new Date(newMeeting.scheduled_at).toISOString(),
        notes: newMeeting.notes,
        responsible_user_id: profile?.id,
        status: 'scheduled',
      });

      if (error) throw error;
      setNewMeeting({ scheduled_at: '', notes: '' });
      loadLeadData();
      notify.success('Reunião agendada com sucesso!');
    } catch (error) {
      console.error('Error creating meeting:', error);
      notify.error('Erro ao agendar reunião');
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
      } else if (id && status === 'no_show') {
        await supabase.from('leads').update({ status: 'no_show' }).eq('id', id);
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
      notify.success('Proposta criada com sucesso!');
    } catch (error) {
      console.error('Error creating proposal:', error);
      notify.error('Erro ao criar proposta');
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
        scheduled_at: new Date(newScheduledActivity.scheduled_at).toISOString(),
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
      notify.success('Atividade agendada com sucesso!');
    } catch (error) {
      console.error('Error creating scheduled activity:', error);
      notify.error('Erro ao agendar atividade');
    }
  };

  const updateScheduledActivityStatus = async (activityId: string, status: 'completed' | 'cancelled') => {
    try {
      const updateData: { status: 'completed' | 'cancelled'; completed_at?: string } = { status };
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

  const updateProposalStatus = async (proposalId: string, status: 'won' | 'lost', lossReason?: string, lossCategory?: string) => {
    try {
      const updateData: { status: 'won' | 'lost'; loss_reason?: string; loss_reason_category?: string; closed_at?: string } = { 
        status, 
        loss_reason: lossReason,
        loss_reason_category: lossCategory 
      };
      if (status === 'won') {
        updateData.closed_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('proposals')
        .update(updateData)
        .eq('id', proposalId);

      if (updateError) throw updateError;
      
      if (status === 'won' && id) {
        // Fetch all won proposals to calculate total deal_value and earliest closed_at
        const { data: wonProposals, error: fetchError } = await supabase
          .from('proposals')
          .select('*')
          .eq('lead_id', id)
          .eq('status', 'won');
          
        if (!fetchError && wonProposals && wonProposals.length > 0) {
          const totalWonValue = wonProposals.reduce((sum, p) => sum + (p.value || 0), 0);
          const earliestClosure = wonProposals
            .map(p => p.closed_at)
            .filter(Boolean)
            .sort()[0] || new Date().toISOString();
            
          await supabase
            .from('leads')
            .update({ 
               deal_value: totalWonValue,
               closed_at: earliestClosure
             })
            .eq('id', id);
        }
      }

      loadLeadData();
      notify.success(status === 'won' ? 'Proposta ganha!' : 'Proposta perdida registrada.');
    } catch (error) {
      console.error('Error updating proposal:', error);
    }
  };

  const saveEditProposal = async () => {
    if (!editingProposalId || !editProposalForm.presented_at || !editProposalForm.value) return;
    try {
      const { error } = await supabase
        .from('proposals')
        .update({
          presented_at: editProposalForm.presented_at,
          value: parseFloat(editProposalForm.value),
          payment_terms: editProposalForm.payment_terms || null,
        })
        .eq('id', editingProposalId);
      if (error) throw error;
      setEditingProposalId(null);
      loadLeadData();
      notify.success('Proposta atualizada!');
    } catch (error) {
      console.error('Error updating proposal:', error);
      notify.error('Erro ao atualizar proposta');
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

  const getStageDisplay = (statusKey: string) => {
    const stage = stages.find(s => s.stage_key === statusKey);
    return stage ? { name: stage.name, color: stage.color } : { name: statusKey.replace('_', ' '), color: '#6B7280' };
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

  const handleDelete = async () => {
    if (!confirm(`Excluir o lead "${lead?.full_name}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) { notify.error('Erro ao excluir lead'); return; }
    notify.success('Lead excluído');
    window.location.href = '/leads';
  };

  // Calcular valor total das propostas ganhas
  const totalWonProposalsValue = proposals
    .filter(p => p.status === 'won')
    .reduce((sum, p) => sum + (p.value || 0), 0);

  return (
    <>
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Leads', href: '/leads' },
          { label: lead?.full_name || 'Lead' },
        ]}
      />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h1 className="text-xl md:text-3xl font-bold text-gray-900">{lead.full_name}</h1>
        {!isJuridico && (
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Editar Lead
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </button>
          </div>
        )}
      </div>

      {isJuridico && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center gap-2 text-sm text-purple-800">
          <Scale className="w-4 h-4 flex-shrink-0" />
          Modo visualização — Jurídico pode registrar apenas notas neste cliente.
        </div>
      )}

      {/* Modal de Edição */}
      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Editar Lead</h2>
              <button
                onClick={() => setIsEditing(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Informações Básicas */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Informações Básicas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      value={editForm.full_name}
                      onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Telefone *
                    </label>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Faixa de Renda Familiar
                    </label>
                    <select
                      value={editForm.family_income_range}
                      onChange={(e) => setEditForm({ ...editForm, family_income_range: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione...</option>
                      <option value="ate_10k">Até R$ 10.000</option>
                      <option value="10k_25k">R$ 10.000 - R$ 25.000</option>
                      <option value="25k_50k">R$ 25.000 - R$ 50.000</option>
                      <option value="acima_50k">Acima de R$ 50.000</option>
                      <option value="prefiro_nao_informar">Prefiro não informar</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Status e Classificação */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Status e Classificação</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status *
                    </label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione o status</option>
                      {stages.map(stage => (
                        <option key={stage.id} value={stage.stage_key}>{stage.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Classificação *
                    </label>
                    <select
                      value={editForm.classification}
                      onChange={(e) => setEditForm({ ...editForm, classification: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="morno">Morno</option>
                      <option value="qualificado">Qualificado</option>
                      <option value="estrategico">Estratégico</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Origem e Campanha */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Origem e Campanha</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Origem *
                    </label>
                    <input
                      type="text"
                      value={editForm.source}
                      onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: Facebook, Google, Site"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Campanha
                    </label>
                    <input
                      type="text"
                      value={editForm.campaign}
                      onChange={(e) => setEditForm({ ...editForm, campaign: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Parâmetros UTM */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Parâmetros UTM</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      UTM Source
                    </label>
                    <input
                      type="text"
                      value={editForm.utm_source}
                      onChange={(e) => setEditForm({ ...editForm, utm_source: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      UTM Medium
                    </label>
                    <input
                      type="text"
                      value={editForm.utm_medium}
                      onChange={(e) => setEditForm({ ...editForm, utm_medium: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      UTM Campaign
                    </label>
                    <input
                      type="text"
                      value={editForm.utm_campaign}
                      onChange={(e) => setEditForm({ ...editForm, utm_campaign: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      UTM Content
                    </label>
                    <input
                      type="text"
                      value={editForm.utm_content}
                      onChange={(e) => setEditForm({ ...editForm, utm_content: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      UTM Term
                    </label>
                    <input
                      type="text"
                      value={editForm.utm_term}
                      onChange={(e) => setEditForm({ ...editForm, utm_term: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditLead}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

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
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getStageDisplay(lead.status).color }}></span>
              <span className="text-lg font-medium text-gray-900 capitalize" style={{ color: getStageDisplay(lead.status).color }}>
                {getStageDisplay(lead.status).name}
              </span>
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Origem</div>
            <span className="text-lg font-medium text-gray-900">{lead.source}</span>
            {lead.campaign && <div className="text-xs text-gray-500">{lead.campaign}</div>}
          </div>
          <div className="flex flex-col items-end">
            <div className="text-sm text-gray-600 mb-1">Lead Score</div>
            <div className={`text-2xl font-bold px-4 py-1 rounded-xl shadow-sm border ${
              lead.score_total >= 70 ? 'bg-green-50 text-green-700 border-green-200' :
              lead.score_total >= 40 ? 'bg-amber-50 text-amber-700 border-amber-200' :
              'bg-gray-50 text-gray-700 border-gray-200'
            }`}>
              {lead.score_total}
            </div>
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
                      className="px-3 py-1 rounded-full text-sm font-medium hover:opacity-80 transition-all"
                      style={{ backgroundColor: tag.color, color: 'white' }}
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
                <div className="flex items-center gap-2 mt-1">
                  {totalWonProposalsValue > 0 && (
                    <div className="text-green-600 font-bold">
                      R$ {totalWonProposalsValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
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
            {lead.owner_user_id && (
              <div>
                <div className="text-gray-500 mb-1">Responsável (ID)</div>
                <div className="font-mono text-gray-700 break-all">{lead.owner_user_id}</div>
              </div>
            )}
            <div>
              <div className="text-gray-500 mb-1">Criado em</div>
              <div className="text-gray-700">{formatDateTime(lead.created_at)}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Criado em</div>
              <div className="text-gray-700">{formatDateTime(lead.created_at)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto whitespace-nowrap scrollbar-none">
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
              onClick={() => { window.location.href = `/whatsapp-conversations?lead=${id}`; }}
              className="px-6 py-4 text-sm font-medium text-gray-600 hover:text-green-600 hover:border-b-2 hover:border-green-500 transition-colors"
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
                <div className="flex flex-col gap-2">
                  <textarea
                    value={newActivity}
                    onChange={(e) => setNewActivity(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addActivity();
                    }}
                    placeholder="Descrição da atividade... (Ctrl+Enter para salvar)"
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  />
                  <button
                    onClick={addActivity}
                    className="self-end px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Respostas do Formulário</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                    {[
                      { label: 'Decisão', key: 'decisao_real' },
                      { label: 'Urgência', key: 'urgencia_real' },
                      { label: 'Relacionamento', key: 'conflito_real' },
                      { label: 'Patrimônio', key: 'valor_bens_real' },
                      { label: 'Filhos Menores', key: 'filhos_menores_real' },
                      { label: 'Estágio', key: 'estagio' },
                    ].map(field => {
                      const formAnswers = answers.filter(a => a.source === 'meta_form');
                      const ans = formAnswers.find(a => a.question_key === field.key);
                      const val = ans?.answer_value || null;
                      return (
                        <div key={field.label} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{field.label}</span>
                            <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">formulário</span>
                          </div>
                          <div className="text-sm text-gray-900 font-medium mt-1">{val || 'Não informado'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Validação Humana */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Validação Humana</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-indigo-50/50 rounded-lg p-4 border border-indigo-100/50">
                    {[
                      { label: 'Decisão', key: 'decisao_real' },
                      { label: 'Urgência', key: 'urgencia_real' },
                      { label: 'Relacionamento', key: 'conflito_real' },
                      { label: 'Patrimônio', key: 'valor_bens_real' },
                      { label: 'Renda Familiar', key: 'renda_real' },
                      { label: 'Filhos Menores', key: 'filhos_menores_real' },
                      { label: 'Estágio Jurídico', key: 'estagio_real' },
                    ].map(field => {
                      const humanAnswers = answers.filter(a => a.source === 'triagem_humana');
                      const ans = [...humanAnswers].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).find(a => a.question_key === field.key);
                      const val = ans?.answer_value || null;
                      return (
                        <div key={field.label} className="bg-white border border-indigo-100 rounded-lg p-3 shadow-sm">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{field.label}</span>
                            <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded font-medium">triagem SDR</span>
                          </div>
                          <div className="text-sm text-gray-900 font-medium mt-1">{val || 'Ainda não validado'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Campos Personalizados Dinâmicos */}
                <div className="mb-6">
                  <CustomFieldsViewer leadId={lead.id} />
                </div>


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
                  {activities
                    .filter(a => !['msg_sent', 'msg_received'].includes(a.type))
                    .map((activity) => (
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
                        <div className="text-sm text-gray-700 whitespace-pre-wrap">{activity.content}</div>
                      </div>
                    </div>
                  ))}
                  {activities.filter(a => !['msg_sent', 'msg_received'].includes(a.type)).length === 0 && (
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

                {/* Formulário de Validação Humana (Interactive) */}
                <div className="rounded-[1.5rem] border border-gray-200 overflow-hidden shadow-sm bg-white mb-6">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-200">
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest w-1/4">Campo</th>
                        <th className="px-6 py-4 text-[10px] font-black text-amber-600/70 uppercase tracking-widest w-1/3">Declaração (Lead)</th>
                        <th className="px-6 py-4 text-[10px] font-black text-indigo-600 uppercase tracking-widest w-1/3">Validação (Você)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {/* Decisão */}
                      <tr>
                        <td className="px-6 py-4 text-xs font-bold text-gray-600 uppercase tracking-wide">Decisão</td>
                        <td className="px-6 py-4 text-sm text-gray-400 italic font-medium">{getMetaAnswer('decisao') || 'Não informado'}</td>
                        <td className="px-6 py-4">
                          <select 
                            className="w-full px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-200 outline-none"
                            value={validationForm.decisao_real}
                            onChange={e => setValidationForm({...validationForm, decisao_real: e.target.value})}
                          >
                            <option value="">Selecione...</option>
                            <option value="decidi_estruturar">Sim, já estou decidido(a)</option>
                            <option value="quase_decidido">Estou muito inclinado(a), mas ainda avaliando</option>
                            <option value="avaliando">Ainda estou pensando</option>
                          </select>
                        </td>
                      </tr>
                      {/* Urgência */}
                      <tr>
                        <td className="px-6 py-4 text-xs font-bold text-gray-600 uppercase tracking-wide">Urgência</td>
                        <td className="px-6 py-4 text-sm text-gray-400 italic font-medium">{getMetaAnswer('urgencia') || 'Não informado'}</td>
                        <td className="px-6 py-4">
                          <select 
                            className="w-full px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-200 outline-none"
                            value={validationForm.urgencia_real}
                            onChange={e => setValidationForm({...validationForm, urgencia_real: e.target.value})}
                          >
                            <option value="">Selecione...</option>
                            <option value="alta">Preciso resolver isso imediatamente</option>
                            <option value="media">Quero resolver nos próximos meses</option>
                            <option value="baixa">Ainda estou apenas buscando informações</option>
                          </select>
                        </td>
                      </tr>
                      {/* Relacionamento (Conflito) */}
                      <tr>
                        <td className="px-6 py-4 text-xs font-bold text-gray-600 uppercase tracking-wide">Relacionamento</td>
                        <td className="px-6 py-4 text-sm text-gray-400 italic font-medium">{getMetaAnswer('relacionamento') || 'Não informado'}</td>
                        <td className="px-6 py-4">
                          <select 
                            className="w-full px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-200 outline-none"
                            value={validationForm.conflito_real}
                            onChange={e => setValidationForm({...validationForm, conflito_real: e.target.value})}
                          >
                            <option value="">Selecione...</option>
                            <option value="Concordamos em tudo (Amigável)">Concordamos em tudo (Amigável)</option>
                            <option value="Temos algumas divergências">Temos algumas divergências</option>
                            <option value="Há muito conflito/brigas (Litigioso)">Há muito conflito/brigas (Litigioso)</option>
                          </select>
                        </td>
                      </tr>
                      {/* Patrimônio */}
                      <tr>
                        <td className="px-6 py-4 text-xs font-bold text-gray-600 uppercase tracking-wide">Patrimônio</td>
                        <td className="px-6 py-4 text-sm text-gray-400 italic font-medium">{getMetaAnswer('bens') || 'Não informado'}</td>
                        <td className="px-6 py-4">
                          <select 
                            className="w-full px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-200 outline-none"
                            value={validationForm.valor_bens_real}
                            onChange={e => setValidationForm({...validationForm, valor_bens_real: e.target.value})}
                          >
                            <option value="">Selecione...</option>
                            <option value="Sim, bens acima de R$1 milhão">Sim, bens acima de R$1 milhão</option>
                            <option value="Sim, bens entre R$500 mil e R$1 milhão">Sim, bens entre R$500 mil e R$1 milhão</option>
                            <option value="Sim, bens entre R$100 mil e R$500 mil">Sim, bens entre R$100 mil e R$500 mil</option>
                            <option value="Sim, bens de até R$100 mil">Sim, bens de até R$100 mil</option>
                            <option value="Não há bens">Não há bens</option>
                          </select>
                        </td>
                      </tr>
                      {/* Tipo de Bens */}
                      <tr>
                        <td className="px-6 py-4"></td>
                        <td className="px-6 py-4 text-sm text-gray-400 italic font-medium">{getMetaAnswer('assets_types') || 'Não informado'}</td>
                        <td className="px-6 py-4">
                          <div className="space-y-1.5">
                            {[
                              { value: 'imovel_proprio', label: 'Imóvel próprio (quitado)' },
                              { value: 'imovel_financiado', label: 'Imóvel financiado' },
                              { value: 'empresa_cotas', label: 'Empresa / cotas societárias' },
                              { value: 'veiculo', label: 'Veículos' },
                              { value: 'investimentos', label: 'Investimentos / ações' },
                              { value: 'previdencia', label: 'Previdência privada' },
                              { value: 'dividas', label: 'Dívidas' },
                            ].map(opt => {
                              const current = (validationForm.tipo_bens_real || '').split(',').filter(Boolean);
                              const checked = current.includes(opt.value);
                              return (
                                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={e => {
                                      const updated = e.target.checked
                                        ? [...current, opt.value]
                                        : current.filter(v => v !== opt.value);
                                      setValidationForm({...validationForm, tipo_bens_real: updated.join(',')});
                                    }}
                                    className="w-3.5 h-3.5 text-indigo-600 rounded cursor-pointer"
                                  />
                                  <span className="text-xs font-medium text-gray-700">{opt.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                      {/* Renda Familiar */}
                      <tr>
                        <td className="px-6 py-4 text-xs font-bold text-gray-600 uppercase tracking-wide">Renda Familiar</td>
                        <td className="px-6 py-4 text-sm text-gray-400 italic font-medium">{getMetaAnswer('renda') || 'Não informado'}</td>
                        <td className="px-6 py-4">
                          <select 
                            className="w-full px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-200 outline-none"
                            value={validationForm.renda_real}
                            onChange={e => setValidationForm({...validationForm, renda_real: e.target.value})}
                          >
                            <option value="">Selecione...</option>
                            <option value="Acima de R$40 mil">Acima de R$40 mil</option>
                            <option value="Entre R$20 mil e R$40 mil">Entre R$20 mil e R$40 mil</option>
                            <option value="Entre R$10 mil e R$20 mil">Entre R$10 mil e R$20 mil</option>
                            <option value="Entre R$5 mil e R$10 mil">Entre R$5 mil e R$10 mil</option>
                            <option value="Até R$5 mil">Até R$5 mil</option>
                          </select>
                        </td>
                      </tr>
                      {/* Filhos Menores */}
                      <tr>
                        <td className="px-6 py-4 text-xs font-bold text-gray-600 uppercase tracking-wide">Filhos Menores</td>
                        <td className="px-6 py-4 text-sm text-gray-400 italic font-medium">{getMetaAnswer('filhos') || 'Não informado'}</td>
                        <td className="px-6 py-4">
                          <select 
                            className="w-full px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-200 outline-none"
                            value={validationForm.filhos_menores_real}
                            onChange={e => setValidationForm({...validationForm, filhos_menores_real: e.target.value})}
                          >
                            <option value="">Selecione...</option>
                            <option value="Sim">Sim</option>
                            <option value="Não">Não</option>
                          </select>
                        </td>
                      </tr>
                      {/* Estágio Jurídico */}
                      <tr>
                        <td className="px-6 py-4 text-xs font-bold text-gray-600 uppercase tracking-wide">Estágio Jurídico</td>
                        <td className="px-6 py-4 text-sm text-gray-400 italic font-medium">{getMetaAnswer('estagio') || 'Não informado'}</td>
                        <td className="px-6 py-4">
                          <select 
                            className="w-full px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-200 outline-none"
                            value={validationForm.estagio_real}
                            onChange={e => setValidationForm({...validationForm, estagio_real: e.target.value})}
                          >
                            <option value="">Selecione...</option>
                            <option value="Não há processo ainda">Não há processo ainda</option>
                            <option value="Já foi citado(a) - Prazo correndo">Já foi citado(a) - Prazo correndo</option>
                            <option value="Já existe processo em andamento">Já existe processo em andamento</option>
                            <option value="Apenas quer trocar de advogado">Apenas quer trocar de advogado</option>
                          </select>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Prazos e Expectativa</label>
                    <select 
                      className="w-full px-5 py-4 border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                      value={validationForm.timeline_real}
                      onChange={e => setValidationForm({...validationForm, timeline_real: e.target.value})}
                    >
                      <option value="">Prazo real para fechar...</option>
                      <option value="imediato">🔥 Imediato (menos de 7 dias)</option>
                      <option value="curto">📅 Curto Prazo (7-30 dias)</option>
                      <option value="medio">🗓️ Médio Prazo (1-3 meses)</option>
                      <option value="longo">⏳ Longo Prazo (+3 meses)</option>
                    </select>
                  </div>
                </div>

                {/* Notas livres da triagem */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    📝 Notas da Triagem
                    <span className="text-xs font-normal text-gray-500 ml-2">Capture o que os dropdowns não capturam</span>
                  </label>
                  <textarea
                    value={validationForm.notas_triagem}
                    onChange={(e) => setValidationForm({ ...validationForm, notas_triagem: e.target.value })}
                    placeholder="Ex: Marido está escondendo empresa no nome do filho. Lead tem pressa mas não sabe o valor dos bens..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                  />
                </div>

                <button
                  onClick={saveValidation}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Salvar Validação e Recalcular Score
                </button>
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
                      {editingProposalId === proposal.id ? (
                        /* ── Modo edição inline ── */
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Data de Apresentação</label>
                            <input
                              type="datetime-local"
                              value={editProposalForm.presented_at}
                              onChange={(e) => setEditProposalForm({ ...editProposalForm, presented_at: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Valor (R$)</label>
                            <input
                              type="number"
                              value={editProposalForm.value}
                              onChange={(e) => setEditProposalForm({ ...editProposalForm, value: e.target.value })}
                              step="0.01"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Condições de Pagamento</label>
                            <textarea
                              value={editProposalForm.payment_terms}
                              onChange={(e) => setEditProposalForm({ ...editProposalForm, payment_terms: e.target.value })}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={saveEditProposal}
                              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => setEditingProposalId(null)}
                              className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ── Modo visualização ── */
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-5 h-5 text-gray-400" />
                              <span className="font-bold text-gray-900">R$ {proposal.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                proposal.status === 'won' ? 'bg-green-100 text-green-800' :
                                proposal.status === 'lost' ? 'bg-red-100 text-red-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {proposal.status === 'won' ? 'Ganha' : proposal.status === 'lost' ? 'Perdida' : 'Aberta'}
                              </span>
                              {(profile?.role === 'admin' || profile?.role === 'comercial') && (
                                <button
                                  onClick={() => {
                                    const dt = proposal.presented_at
                                      ? proposal.presented_at.slice(0, 16)
                                      : '';
                                    setEditProposalForm({
                                      presented_at: dt,
                                      value: String(proposal.value),
                                      payment_terms: proposal.payment_terms || '',
                                    });
                                    setEditingProposalId(proposal.id);
                                  }}
                                  className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
                                >
                                  Editar
                                </button>
                              )}
                            </div>
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
                                  const reason = prompt('Explique o motivo da perda (opcional):');
                                  const categories = ['preco', 'concorrente', 'reconciliacao', 'timing', 'outro'];
                                  const category = prompt(`Escolha a categoria:\n${categories.join(', ')}`);
                                  if (category && categories.includes(category.toLowerCase())) {
                                    updateProposalStatus(proposal.id, 'lost', reason || undefined, category.toLowerCase());
                                  } else {
                                    notify.error('Categoria inválida. Use: preco, concorrente, reconciliacao, timing ou outro');
                                  }
                                }}
                                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                Perder
                              </button>
                            </div>
                          )}
                        </>
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
                        onChange={(e) => setNewScheduledActivity({ ...newScheduledActivity, activity_type: e.target.value as 'call' | 'email' | 'follow_up' | 'task' | 'meeting' })}
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
                        onChange={(e) => setNewScheduledActivity({ ...newScheduledActivity, priority: e.target.value as 'low' | 'medium' | 'high' | 'urgent' })}
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
                            onClick={() => setEditingActivity(activity)}
                            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            <Pencil className="w-4 h-4" />
                            Editar
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

    <ActivityModal
      isOpen={!!editingActivity}
      onClose={() => setEditingActivity(null)}
      onSuccess={() => { setEditingActivity(null); loadLeadData(); }}
      activity={editingActivity}
    />
    </>
  );
}
