import React, { useState, useEffect } from 'react';
import { 
  X, UserCheck, RefreshCw, BarChart3, TrendingUp, 
  CalendarPlus, Tag as TagIcon, Save, Info, User, FileText,
  Search, CheckCircle2, AlertCircle, Clock, Database as DatabaseIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Database } from '../lib/database.types';
import CustomFieldsViewer from './CustomFieldsViewer';

type Lead = Database['public']['Tables']['leads']['Row'];

interface Props {
  leadId: string;
  onClose: () => void;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface PipelineStage {
  id: string;
  name: string;
  stage_key: string;
}

export default function LeadDetailModal({ leadId, onClose }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leadDetails, setLeadDetails] = useState<Lead | any | null>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [stages, setStages] = useState<PipelineStage[] | any[]>([]);
  const [leadTags, setLeadTags] = useState<Tag[] | any[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[] | any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [showStageSelector, setShowStageSelector] = useState(false);
  const [showAssignPopover, setShowAssignPopover] = useState(false);
  const [showActivityPopover, setShowActivityPopover] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [creatingActivity, setCreatingActivity] = useState(false);
  const [savingValidation, setSavingValidation] = useState(false);
  const [users, setUsers] = useState<{ id: string; full_name: string }[] | any[]>([]);
  const [currentAssigned, setCurrentAssigned] = useState<{ id: string; full_name: string } | any | null>(null);

  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    source: '',
    campaign: '',
    notes: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_content: '',
    utm_term: '',
    status: '',
    classification: '',
    valor_bens_real: '',
    tipo_bens_real: '',
    has_minor_children: false
  });

  const [validationForm, setValidationForm] = useState({
    decisao_real: '',
    urgencia_real: '',
    decisor: '',
    proximo_passo: '',
    notas_triagem: '',
    timeline_real: '',
    conflito_real: '',
    especialista_real: '',
    filhos_menores_real: '',
    renda_real: '',
    estagio_real: '',
  });

  const [activityForm, setActivityForm] = useState({
    title: '',
    activity_type: 'call' as const,
    scheduled_at: '',
    priority: 'medium' as const,
    duration_minutes: 30
  });

  useEffect(() => {
    loadAllData();
  }, [leadId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const [leadRes, answersRes, stagesRes, tagsRes, allTagsRes, usersRes] = await Promise.all([
        supabase.from('leads').select('*').eq('id', leadId).single(),
        supabase.from('lead_answers').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
        supabase.from('pipeline_stages').select('*').order('order_index'),
        supabase.from('lead_tags').select('tags(id, name, color)').eq('lead_id', leadId),
        supabase.from('tags').select('*').order('name'),
        supabase.from('user_profiles').select('id, full_name').order('full_name')
      ]);

      if (leadRes.data) {
        const data = leadRes.data as any;
        setLeadDetails(data);
        setEditForm({
          full_name: data.full_name || '',
          phone: data.phone || '',
          email: data.email || '',
          city: data.city || '',
          state: data.state || '',
          source: data.source || '',
          campaign: data.campaign || '',
          notes: data.notes || '',
          utm_source: data.utm_source || '',
          utm_medium: data.utm_medium || '',
          utm_campaign: data.utm_campaign || '',
          utm_content: data.utm_content || '',
          utm_term: data.utm_term || '',
          status: data.status || '',
          classification: data.classification || '',
          valor_bens_real: '',
          tipo_bens_real: '',
          has_minor_children: !!data.has_minor_children
        });

        // Initialize validation form if answers exist
        const vAnswers = (answersRes.data as any[]) || [];
        setValidationForm({
          decisao_real: vAnswers.find(a => a.question_key === 'decisao_real')?.answer_value || '',
          urgencia_real: vAnswers.find(a => a.question_key === 'urgencia_real')?.answer_value || '',
          decisor: vAnswers.find(a => a.question_key === 'decisor')?.answer_value || '',
          proximo_passo: vAnswers.find(a => a.question_key === 'proximo_passo')?.answer_value || '',
          notas_triagem: vAnswers.find(a => a.question_key === 'notas_triagem')?.answer_value || '',
          timeline_real: vAnswers.find(a => a.question_key === 'timeline_real')?.answer_value || '',
          conflito_real: vAnswers.find(a => a.question_key === 'conflito_real')?.answer_value || '',
          especialista_real: vAnswers.find(a => a.question_key === 'especialista_real')?.answer_value || '',
          filhos_menores_real: vAnswers.find(a => a.question_key === 'filhos_menores_real')?.answer_value || '',
          renda_real: vAnswers.find(a => a.question_key === 'renda_real')?.answer_value || '',
          estagio_real: vAnswers.find(a => a.question_key === 'estagio_real')?.answer_value || '',
        });

        const vBens = vAnswers.find(a => a.question_key === 'valor_bens_real')?.answer_value || '';
        const vTipo = vAnswers.find(a => a.question_key === 'tipo_bens_real')?.answer_value || '';
        
        setEditForm(prev => ({
          ...prev,
          valor_bens_real: vBens,
          tipo_bens_real: vTipo
        }));

        // Current assigned
        if (data.assigned_to) {
          const assigned = (usersRes.data as any[])?.find((u: any) => u.id === data.assigned_to);
          if (assigned) setCurrentAssigned(assigned);
        }
      }

      setAnswers(answersRes.data || []);
      setStages(stagesRes.data || []);
      setLeadTags((tagsRes.data as any[])?.map((lt: any) => lt.tags).filter(Boolean) || []);
      setAvailableTags(allTagsRes.data || []);
      setUsers(usersRes.data || []);

    } catch (error) {
      console.error('Error loading modal data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('leads').update(editForm as any).eq('id', leadId);
      if (error) throw error;
      if (leadDetails) {
        setLeadDetails({ ...leadDetails, ...editForm } as any);
      }
      setIsEditing(false);
      alert('Lead atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating lead:', error);
      alert('Erro ao atualizar lead');
    }
  };

  const saveValidation = async () => {
    setSavingValidation(true);
    try {
      const validationAnswers = [
        { question_key: 'decisao_real', answer_value: validationForm.decisao_real },
        { question_key: 'urgencia_real', answer_value: validationForm.urgencia_real },
        { question_key: 'decisor', answer_value: validationForm.decisor },
        { question_key: 'proximo_passo', answer_value: validationForm.proximo_passo },
        { question_key: 'timeline_real', answer_value: validationForm.timeline_real },
        { question_key: 'conflito_real', answer_value: validationForm.conflito_real },
        { question_key: 'especialista_real', answer_value: validationForm.especialista_real },
        { question_key: 'filhos_menores_real', answer_value: validationForm.filhos_menores_real },
        { question_key: 'renda_real', answer_value: validationForm.renda_real },
        { question_key: 'estagio_real', answer_value: validationForm.estagio_real },
        { question_key: 'valor_bens_real', answer_value: editForm.valor_bens_real },
        { question_key: 'tipo_bens_real', answer_value: editForm.tipo_bens_real },
        { question_key: 'notas_triagem', answer_value: validationForm.notas_triagem }
      ].filter(a => a.answer_value);

      for (const ans of (validationAnswers as any[])) {
        // Delete previous answer for the same key to avoid unique constraint violations
        await supabase.from('lead_answers').delete().eq('lead_id', leadId).eq('question_key', ans.question_key);
        
        const { error: upsertError } = await (supabase.from('lead_answers') as any).insert({
          lead_id: leadId,
          question_key: ans.question_key,
          answer_value: ans.answer_value,
          source: 'triagem_humana',
          created_at: new Date().toISOString()
        });

        if (upsertError) {
          console.error(`Error saving ${ans.question_key}:`, upsertError);
          alert(`Erro ao salvar ${ans.question_key}: ${upsertError.message}`);
          throw upsertError;
        }
      }

      // Sync specific fields back to lead table for easy access
      const updatePayload: any = {};
      if (validationForm.notas_triagem) updatePayload.notes = validationForm.notas_triagem;
      
      if (Object.keys(updatePayload).length > 0) {
        await supabase.from('leads').update(updatePayload).eq('id', leadId);
      }

      // Recalculate score
      await (supabase.rpc('calculate_lead_score', { p_lead_id: leadId } as any) as any);
      
      alert('Validação salva e score recalculado!');
      await loadAllData();
      setShowValidation(false);
    } catch (error) {
      console.error('Error saving validation:', error);
      alert('Erro ao salvar validação');
    } finally {
      setSavingValidation(false);
    }
  };

  const updateLeadStatus = async (newStatus: string) => {
    setUpdatingStage(true);
    try {
      const { error } = await supabase.from('leads').update({ status: newStatus as any }).eq('id', leadId);
      if (error) throw error;
      if (leadDetails) setLeadDetails({ ...leadDetails, status: newStatus });
      setShowStageSelector(false);
    } catch (error) {
      console.error('Error updating stage:', error);
    } finally {
      setUpdatingStage(false);
    }
  };

  const addTag = async (tagId: string) => {
    try {
      const { error } = await (supabase.from('lead_tags') as any).insert({ lead_id: leadId, tag_id: tagId } as any);
      if (error) throw error;
      const tag = availableTags.find(t => t.id === tagId);
      if (tag) setLeadTags([...leadTags, tag]);
    } catch (error) {
      console.error('Error adding tag:', error);
    }
  };

  const removeTag = async (tagId: string) => {
    try {
      const { error } = await supabase.from('lead_tags').delete().eq('lead_id', leadId).eq('tag_id', tagId);
      if (error) throw error;
      setLeadTags(leadTags.filter(t => t.id !== tagId));
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  };

  const assignResponsible = async (userId: string, userName: string) => {
    try {
      const { error } = await supabase.from('leads').update({ assigned_to: userId } as any).eq('id', leadId);
      if (error) throw error;
      setCurrentAssigned({ id: userId, full_name: userName });
      setShowAssignPopover(false);
    } catch (error) {
      console.error('Error assigning:', error);
    }
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingActivity(true);
    try {
      const { error } = await supabase.from('scheduled_activities').insert({
        ...activityForm,
        lead_id: leadId,
        created_by: profile?.id
      } as any);
      if (error) throw error;
      setActivityForm({ title: '', activity_type: 'call', scheduled_at: '', priority: 'medium', duration_minutes: 30 });
      setShowActivityPopover(false);
      alert('Atividade agendada!');
    } catch (error) {
      console.error('Error creating activity:', error);
    } finally {
      setCreatingActivity(false);
    }
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'estrategico': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'qualificado': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'morno': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getMetaAnswer = (key: string) => {
    return answers.find(a => a.question_key === key && (a.source === 'meta_form' || a.source === 'form_lead'))?.answer_value;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110]">
        <div className="bg-white rounded-2xl p-8 flex flex-col items-center">
          <RefreshCw className="w-10 h-10 animate-spin text-blue-500 mb-4" />
          <p className="text-gray-600 font-medium tracking-tight">Carregando detalhes do lead...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in" onClick={onClose}>
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-white/20" onClick={(e) => e.stopPropagation()}>
        
        {/* Top Header Row - Branding & Navigation */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-xl font-bold shadow-lg`}>
              {leadDetails?.full_name?.split(' ').map((n:string)=>n[0]).slice(0,2).join('')}
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight leading-none mb-1">{leadDetails?.full_name}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 font-mono tracking-wider">{leadDetails?.phone}</span>
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${getClassificationColor(leadDetails?.classification || '')}`}>
                  {leadDetails?.classification || 'Morno'}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Quick Actions Header */}
            <div className="hidden md:flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-2xl shadow-sm mr-4">
              <button 
                onClick={() => setShowTagSelector(!showTagSelector)} 
                className={`p-2 hover:bg-gray-50 rounded-xl transition-all ${showTagSelector ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}
                title="Etiquetas"
              >
                <TagIcon className="w-4 h-4" />
              </button>
              
              <button 
                onClick={() => setShowStageSelector(!showStageSelector)} 
                className={`p-2 hover:bg-gray-50 rounded-xl transition-all ${showStageSelector ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}
                title="Status"
              >
                <TrendingUp className="w-4 h-4" />
              </button>

              <button 
                onClick={() => setShowAssignPopover(!showAssignPopover)} 
                className={`p-2 hover:bg-gray-50 rounded-xl transition-all ${showAssignPopover ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}
                title="Responsável"
              >
                <User className="w-4 h-4" />
              </button>
            </div>

            <button 
              onClick={() => setShowValidation(!showValidation)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm ${showValidation ? 'bg-indigo-600 text-white shadow-indigo-100' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
            >
              <UserCheck className="w-4 h-4" /> {showValidation ? 'Ver Detalhes' : 'Validar Lead'}
            </button>

            <button 
              onClick={() => setIsEditing(!isEditing)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm ${isEditing ? 'bg-orange-600 text-white shadow-orange-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <FileText className="w-4 h-4" /> {isEditing ? 'Cancelar' : 'Editar'}
            </button>

            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-400">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 styled-scrollbar">
          {showValidation ? (
            <div className="space-y-8 animate-in slide-in-from-right-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                    <Search className="w-5 h-5 text-indigo-600" /> Validação de Qualificação
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">Compare as respostas do formulário com a realidade identificada no chat.</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Score Atual</span>
                  <span className="text-2xl font-black text-blue-600">{leadDetails?.score_total || 0}</span>
                </div>
              </div>

              {/* Respostas do Meta Ads (Read-Only) */}
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 shadow-inner">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Dados Originais (Meta Ads)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { label: 'Decisão', keys: ['decisao', 'stage'] },
                    { label: 'Urgência', keys: ['urgencia', 'urgency_now'] },
                    { label: 'Relacionamento', keys: ['relacionamento'] },
                    { label: 'Patrimônio', keys: ['bens', 'assets_range'] },
                    { label: 'Renda Familiar', keys: ['renda', 'family_income_range'] },
                    { label: 'Filhos Menores', keys: ['filhos'] },
                    { label: 'Estágio Jurídico', keys: ['estagio', 'estagio_juridico'] },
                  ].map(field => {
                    let val = null;
                    if (field.label === 'Filhos Menores') {
                      const ans = answers.find(a => field.keys.includes(a.question_key));
                      val = ans?.answer_value ? ans.answer_value : (leadDetails?.has_minor_children ? 'Sim' : 'Não');
                    } else {
                      for (const key of field.keys) {
                        const ans = answers.find(a => a.question_key === key);
                        if (ans?.answer_value) {
                          val = ans.answer_value;
                          break;
                        }
                      }
                    }
                    
                    return (
                      <div key={field.label} className="bg-white border border-gray-200 rounded-xl p-3">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{field.label}</div>
                        <div className="text-sm text-gray-800 font-medium">{val || 'Não informado'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Formulário de Validação Humana (Interactive) */}
              <div className="rounded-[1.5rem] border border-gray-200 overflow-hidden shadow-sm bg-white">
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
                    {/* Patrimônio - Faixa de Valor */}
                    <tr>
                      <td className="px-6 py-4 text-xs font-bold text-gray-600 uppercase tracking-wide">Faixa de Patrimônio</td>
                      <td className="px-6 py-4 text-sm text-gray-400 italic font-medium">{getMetaAnswer('bens') || 'Não informado'}</td>
                      <td className="px-6 py-4">
                        <select
                          className="w-full px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-200 outline-none"
                          value={editForm.valor_bens_real}
                          onChange={e => setEditForm({...editForm, valor_bens_real: e.target.value})}
                        >
                          <option value="">Selecione...</option>
                          <option value="ate_200k">Até R$ 200k</option>
                          <option value="200k_500k">R$ 200k – R$ 500k</option>
                          <option value="500k_1m">R$ 500k – R$ 1M</option>
                          <option value="acima_1m">Acima de R$ 1M</option>
                        </select>
                      </td>
                    </tr>
                    {/* Patrimônio - Tipo de Bens */}
                    <tr>
                      <td className="px-6 py-4 text-xs font-bold text-gray-600 uppercase tracking-wide">Tipo de Bens</td>
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
                          ].map(opt => {
                            const current = (editForm.tipo_bens_real || '').split(',').filter(Boolean);
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
                                    setEditForm({...editForm, tipo_bens_real: updated.join(',')});
                                  }}
                                  className="w-3.5 h-3.5 text-indigo-600 rounded cursor-pointer"
                                />
                                <span className="text-xs font-medium text-gray-700 flex-1">{opt.label}</span>
                                {opt.bonus && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">{opt.bonus}</span>}
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
                          <option value="Já existe processo em andamento">Já existe processo em andamento</option>
                          <option value="Já conversamos sobre o divórcio">Já conversamos sobre o divórcio</option>
                          <option value="Ainda não iniciamos nada">Ainda não iniciamos nada</option>
                        </select>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Próximo Passo Estratégico</label>
                  <select 
                    className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={validationForm.proximo_passo}
                    onChange={e => setValidationForm({...validationForm, proximo_passo: e.target.value})}
                  >
                    <option value="">Selecione o melhor caminho...</option>
                    <option value="agendar_reuniao">🗓️ Agendar Reunião de Fechamento</option>
                    <option value="enviar_proposta">📨 Enviar Proposta Formal</option>
                    <option value="aguardar_documentos">📂 Aguardar Envio de Documentos</option>
                    <option value="follow_ups_programados">🔄 Follow-ups Programados</option>
                    <option value="descartar">❌ Descartar (Lead Desqualificado)</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Prazos e Expectativa</label>
                  <select 
                    className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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

              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Notas da Triagem (Anotações do Chat)</label>
                <textarea 
                  className="w-full px-5 py-4 border border-gray-200 rounded-3xl text-sm font-medium text-gray-700 bg-gray-50 min-h-[140px] focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                  placeholder="Descreva detalhes importantes capturados na conversa... (ex: receio sobre valores, interesse em bens específicos, etc)"
                  value={validationForm.notas_triagem}
                  onChange={e => setValidationForm({...validationForm, notas_triagem: e.target.value})}
                />
              </div>

              <button 
                onClick={saveValidation}
                disabled={savingValidation}
                className="w-full py-5 bg-gradient-to-r from-indigo-600 to-blue-700 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] hover:scale-[1.01] transition-all shadow-2xl shadow-indigo-200 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
              >
                {savingValidation ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Salvar Validação e Atualizar Score
              </button>

              {/* Campos Personalizados Dinâmicos */}
              <div className="mt-8 border-t border-gray-100 pt-8">
                <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2 mb-6">
                  <DatabaseIcon className="w-5 h-5 text-indigo-600" /> Informações Complementares
                </h3>
                <CustomFieldsViewer leadId={leadId} />
              </div>
            </div>
          ) : isEditing ? (
            <form onSubmit={handleEditLead} className="space-y-10 animate-in slide-in-from-bottom-6">
              <div className="space-y-8">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
                  <User className="w-5 h-5 text-orange-500" />
                  <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Informações Pessoais</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nome Completo</label>
                    <input className="w-full px-5 py-3.5 border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-50/50 outline-none transition-all" value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Telefone Principal</label>
                    <input className="w-full px-5 py-3.5 border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-50/50 outline-none transition-all" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">E-mail</label>
                    <input className="w-full px-5 py-3.5 border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-50/50 outline-none transition-all" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Cidade</label>
                      <input className="w-full px-5 py-3.5 border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-50/50 outline-none transition-all" value={editForm.city} onChange={e => setEditForm({...editForm, city: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Estado (UF)</label>
                      <input className="w-full px-5 py-3.5 border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-50/50 outline-none transition-all" value={editForm.state} onChange={e => setEditForm({...editForm, state: e.target.value})} />
                    </div>
                  </div>
                </div>
              </div>


              <button type="submit" className="w-full py-5 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] hover:scale-[1.01] transition-all shadow-xl shadow-orange-100 active:scale-[0.98]">
                <Save className="w-5 h-5 inline-block mr-2" /> Salvar Alterações
              </button>
            </form>
          ) : (
            <div className="space-y-10 animate-in slide-in-from-left-4">
              {/* Stats Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-600 p-5 rounded-[1.5rem] text-white shadow-xl shadow-blue-100 relative overflow-hidden group">
                  <BarChart3 className="absolute -right-2 -bottom-2 w-16 h-16 text-white/10 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-100 block mb-1">Score Lead</span>
                  <span className="text-3xl font-black">{leadDetails?.score_total || 0}</span>
                </div>
                <div className="bg-white p-5 rounded-[1.5rem] border border-gray-100 shadow-sm relative overflow-hidden group hover:border-indigo-100 transition-all">
                  <TrendingUp className="absolute -right-2 -bottom-2 w-16 h-16 text-indigo-50 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 block mb-1">Status Atual</span>
                  <span className="text-sm font-black text-indigo-700 uppercase tracking-tight truncate block">{leadDetails?.status?.replace(/_/g, ' ')}</span>
                </div>
                <div className="bg-white p-5 rounded-[1.5rem] border border-gray-100 shadow-sm">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 block mb-1">Entrada</span>
                  <span className="text-sm font-black text-gray-700">{formatDate(leadDetails?.created_at || '')}</span>
                </div>
                <div className="bg-emerald-500 p-5 rounded-[1.5rem] text-white shadow-xl shadow-emerald-100">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-100 block mb-1">Origem</span>
                  <span className="text-sm font-black uppercase tracking-wider">{leadDetails?.source || 'Orgânico'}</span>
                </div>
              </div>

              {/* Informações Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <section className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-gray-50 pb-3">
                    <Info className="w-4 h-4 text-blue-500" />
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Canais de Contato</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between group">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Telefone</span>
                      <a href={`tel:${leadDetails?.phone}`} className="text-sm font-black text-gray-900 hover:text-blue-600 transition-colors">{leadDetails?.phone}</a>
                    </div>
                    <div className="flex items-center justify-between group">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">E-mail</span>
                      <span className="text-sm font-black text-gray-900 truncate max-w-[200px]">{leadDetails?.email || 'vazio@nao.ha'}</span>
                    </div>
                    <div className="flex items-center justify-between group text-right">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Localização</span>
                      <span className="text-sm font-black text-gray-900">{leadDetails?.city ? `${leadDetails.city}/${leadDetails.state}` : '-'}</span>
                    </div>
                  </div>
                </section>

                <section className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-gray-50 pb-3">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Painel de Bens</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100/50">
                      <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest block mb-1">Patrimônio Identificado</span>
                      <p className="text-lg font-black text-orange-700 tracking-tight">{leadDetails?.valor_bens_real || 'Não declarado'}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Filhos Menores</span>
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${leadDetails?.has_minor_children ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                        {leadDetails?.has_minor_children ? '✅ Sim, possui' : '❌ Não possui'}
                      </span>
                    </div>
                  </div>
                </section>
              </div>

              {/* Analytics/Marketing */}
              <section className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 space-y-6">
                 <div className="flex items-center gap-2 border-b border-gray-200/50 pb-3">
                    <BarChart3 className="w-4 h-4 text-gray-400" />
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Marketing Analytics</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Campanha</span>
                      <span className="text-xs font-bold text-gray-900 truncate block">{leadDetails?.campaign || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Source</span>
                      <span className="text-xs font-bold text-gray-900 truncate block">{leadDetails?.utm_source || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Medium</span>
                      <span className="text-xs font-bold text-gray-900 truncate block">{leadDetails?.utm_medium || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Ult. Atividade</span>
                      <span className="text-xs font-bold text-gray-900">{formatDate(leadDetails?.last_activity_at || '')}</span>
                    </div>
                  </div>
              </section>

              {/* Footer Actions */}
              <div className="pt-6 flex gap-3">
                 <a href={`/leads/${leadId}`} className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-100 flex items-center justify-center gap-2 text-xs">
                  <FileText className="w-4 h-4" /> Página Completa
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Popovers Extras baseados no CRM anterior */}
      {showTagSelector && <div className="fixed inset-0 z-[120]" onClick={() => setShowTagSelector(false)} />}
      {showStageSelector && <div className="fixed inset-0 z-[120]" onClick={() => setShowStageSelector(false)} />}
      {showAssignPopover && <div className="fixed inset-0 z-[120]" onClick={() => setShowAssignPopover(false)} />}
    </div>
  );
}
