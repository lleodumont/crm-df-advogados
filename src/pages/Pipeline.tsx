import { useEffect, useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { supabase } from '../lib/supabase';
import { Phone, Mail, TrendingUp, Calendar, Plus, X, FileText, Clock, Filter, BarChart3, MessageCircle, AlertTriangle, CheckSquare } from 'lucide-react';
import type { Database } from '../lib/database.types';
import { useAuth } from '../contexts/AuthContext';
import LeadDetailModal from '../components/LeadDetailModal';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Tables']['leads']['Row']['status'];
type LeadClassification = Database['public']['Tables']['leads']['Row']['classification'];
type LeadAnswer = Database['public']['Tables']['lead_answers']['Row'];
type Proposal = Database['public']['Tables']['proposals']['Row'];

interface PipelineStage {
  id: string;
  name: string;
  stage_key: string;
  color: string;
  order_index: number;
  is_default: boolean | null;
}

const LOSS_REASONS = [
  'Valor muito alto',
  'Não é o perfil / Sem bens',
  'Já fechou com concorrente',
  'Sem interesse no momento',
  'Não atende o telefone / Sem contato',
  'Decidiu não prosseguir no momento',
  'Outro'
];

// Componente interno para renderizar a lista virtualizada de cards do Kanban
function KanbanColumnBody({ columnLeads, stage, allProposals, leadActivities, lastInteractions, draggedLead, showActionMenu, setShowActionMenu, handleDragStart, openWhatsAppChat, openLeadDetail, formatCurrency, formatDate, formatRelativeTime }: {
  columnLeads: any[];
  stage: PipelineStage;
  allProposals: any[];
  leadActivities: Record<string, any[]>;
  lastInteractions: Record<string, string>;
  draggedLead: string | null;
  showActionMenu: string | null;
  setShowActionMenu: (id: string | null) => void;
  handleDragStart: (id: string) => void;
  openWhatsAppChat: (lead: any) => void;
  openLeadDetail: (lead: any) => void;
  formatCurrency: (val: number) => string;
  formatDate: (val: string) => string;
  formatRelativeTime: (val: string) => string;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const useVirtualized = columnLeads.length > 10;

  const rowVirtualizer = useVirtualizer({
    count: columnLeads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 3,
    enabled: useVirtualized,
  });

  if (columnLeads.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        Nenhum lead
      </div>
    );
  }

  const renderCard = (lead: any) => {
    const initials = lead.full_name
      .split(' ')
      .map((n: string) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return (
      <div
        key={lead.id}
        className="relative"
      >
        <div
          draggable
          onDragStart={() => handleDragStart(lead.id)}
          onClick={(e) => {
            e.stopPropagation();
            openLeadDetail(lead);
          }}
          className={`bg-white rounded-lg border p-3.5 cursor-pointer hover:shadow-sm transition-all group ${
            draggedLead === lead.id ? 'opacity-50 border-blue-400' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <div className="flex items-start gap-2.5 mb-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 ${
              lead.classification === 'estrategico' ? 'bg-emerald-600' :
              lead.classification === 'qualificado' ? 'bg-amber-500' :
              'bg-slate-400'
            }`}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <h3 className="font-medium text-gray-900 text-sm truncate">
                  {lead.full_name}
                </h3>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                  (lead.score_total ?? 0) >= 70 ? 'bg-green-50 text-green-700 border-green-100' :
                  (lead.score_total ?? 0) >= 40 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                  'bg-gray-50 text-gray-600 border-gray-100'
                }`}>
                  {lead.score_total ?? 0}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate">{lead.phone}</p>
            </div>
          </div>

          {(() => {
            const leadProposals = allProposals.filter((p: any) => p.lead_id === lead.id);
            const displayValue = stage.stage_key === 'ganho'
              ? leadProposals.filter((p: any) => p.status === 'won').reduce((s: number, p: any) => s + p.value, 0)
              : leadProposals.reduce((s: number, p: any) => s + p.value, 0);

            return displayValue > 0 ? (
              <div className="mb-3">
                <p className="text-base font-semibold text-gray-900">
                  {formatCurrency(displayValue)}
                </p>
              </div>
            ) : null;
          })()}

          {lead.campaign && (
            <div className="mb-3">
              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 truncate max-w-full">
                {lead.campaign}
              </span>
            </div>
          )}

          {(() => {
            const activities = leadActivities[lead.id] || [];
            if (activities.length === 0) return null;

            return (
              <div className="mb-3 space-y-1.5">
                {activities.map((act: any) => (
                  <div
                    key={act.id}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-medium ${
                      act.status === 'overdue'
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-blue-50 border-blue-200 text-blue-700'
                    }`}
                  >
                    {act.status === 'overdue' ? (
                      <AlertTriangle className="w-3 h-3" />
                    ) : (
                      <CheckSquare className="w-3 h-3" />
                    )}
                    <span className="truncate">{act.title}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDate(lead.created_at)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {(() => {
                    const lastInteraction = lastInteractions[lead.id];
                    const baseTime = lead.created_at;
                    const displayTime = lastInteraction && lastInteraction > baseTime ? lastInteraction : baseTime;
                    return formatRelativeTime(displayTime);
                  })()}
                </span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openWhatsAppChat(lead);
              }}
              className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
              title="Abrir WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!useVirtualized) {
    return (
      <div
        ref={parentRef}
        className="space-y-2.5 max-h-[calc(100vh-240px)] overflow-y-auto pr-1 styled-scrollbar"
      >
        {columnLeads.map((lead) => renderCard(lead))}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="max-h-[calc(100vh-240px)] overflow-y-auto pr-1 styled-scrollbar"
    >
      <div
        style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const lead = columnLeads[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
                paddingBottom: '10px',
              }}
            >
              {renderCard(lead)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Pipeline() {
  const { profile } = useAuth();
  const [leads, setLeads] = useState<Lead[] | any[]>([]);
  const [allProposals, setAllProposals] = useState<Proposal[] | any[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | any | null>(null);
  const [lastInteractions, setLastInteractions] = useState<Record<string, string>>({});
  const [leadActivities, setLeadActivities] = useState<Record<string, any[]>>({});
  const [leadAnswers, setLeadAnswers] = useState<LeadAnswer[] | any[]>([]);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [showDealValueModal, setShowDealValueModal] = useState(false);
  const [showLossReasonModal, setShowLossReasonModal] = useState(false);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{ leadId: string; status: LeadStatus } | null>(null);
  const [dealValue, setDealValue] = useState('');
  const [lossReason, setLossReason] = useState('');
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    source: '',
    campaign: '',
    notes: '',
  });
  const [newLead, setNewLead] = useState({
    full_name: '',
    phone: '',
    email: '',
    source: 'manual',
    campaign: '',
    notes: '',
  });

  // Filter state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({
    classification: 'all',
    campaigns: [] as string[],
    utm_sources: [] as string[],
    utm_mediums: [] as string[],
  });

  // Get unique options for filter dropdowns
  const uniqueCampaigns = Array.from(new Set(leads.map(l => l.campaign).filter(Boolean))) as string[];
  const uniqueSources = Array.from(new Set(leads.map(l => l.utm_source).filter(Boolean))) as string[];
  const uniqueMediums = Array.from(new Set(leads.map(l => l.utm_medium).filter(Boolean))) as string[];

  const toggleMultiFilter = (field: 'campaigns' | 'utm_sources' | 'utm_mediums', value: string) => {
    setFilters(prev => {
      const current = prev[field];
      return {
        ...prev,
        [field]: current.includes(value) ? current.filter(v => v !== value) : [...current, value],
      };
    });
  };

  const activeFilterCount =
    (filters.classification !== 'all' ? 1 : 0) +
    filters.campaigns.length +
    filters.utm_sources.length +
    filters.utm_mediums.length;

  useEffect(() => {
    loadStages();
    loadLeads();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => {
      if (showActionMenu) {
        setShowActionMenu(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showActionMenu]);

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

  const loadLeads = async () => {
    setLoading(true);
    try {
      const [{ data: leadsData, error: leadsError }, { data: proposalsData, error: proposalsError }] = await Promise.all([
        supabase.from('leads').select('*').neq('status', 'maturacao').order('score_total', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('proposals').select('*')
      ]);
      
      if (leadsError) throw leadsError;
      if (proposalsError) throw proposalsError;
      
      const leadIds = (leadsData as any[] || []).map((l: any) => l.id);
      
      // Fetch latest messages for these leads
      const { data: interactionsData } = await supabase
        .from('activities')
        .select('lead_id, created_at')
        .in('lead_id', leadIds)
        .order('created_at', { ascending: false });

      // Fetch pending activities
      const { data: pendingActs } = await supabase
        .from('scheduled_activities')
        .select('*')
        .in('lead_id', leadIds)
        .in('status', ['scheduled', 'overdue'])
        .order('scheduled_at', { ascending: true });

      const interactionsMap: Record<string, string> = {};
      (interactionsData as any[])?.forEach(m => {
        if (!interactionsMap[m.lead_id]) {
          interactionsMap[m.lead_id] = m.created_at;
        }
      });

      const actsMap: Record<string, any[]> = {};
      (pendingActs as any[])?.forEach(a => {
        if (!actsMap[a.lead_id]) actsMap[a.lead_id] = [];
        actsMap[a.lead_id].push(a);
      });
      setLastInteractions(interactionsMap);
      setLeadActivities(actsMap);
      setLeads((leadsData as Lead[]) || []);
      setAllProposals((proposalsData as Proposal[]) || []);
    } catch (error) {
      console.error('Error loading leads or proposals:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateLeadStatus = async (leadId: string, newStatus: LeadStatus, dealValueParam?: number, lossReasonParam?: string) => {
    try {
      // Atualização otimista: atualiza o estado local imediatamente
      setLeads(prevLeads =>
        prevLeads.map(lead =>
          lead.id === leadId ? { ...lead, status: newStatus, deal_value: dealValueParam || lead.deal_value } : lead
        )
      );

      const updateData: any = { status: newStatus };
      if (dealValueParam !== undefined) {
        updateData.deal_value = dealValueParam;
        updateData.closed_at = new Date().toISOString();
        updateData.closed_status = 'won';
      }
      if (lossReasonParam !== undefined) {
        updateData.closed_at = new Date().toISOString();
        updateData.closed_status = 'lost';
      }

      const { error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', leadId);

      if (error) throw error;

      await (supabase.from('activities').insert({
        lead_id: leadId,
        type: 'status_change',
        channel: 'internal',
        user_id: profile?.id,
        content: `Status alterado para: ${newStatus}${dealValueParam ? ` - Valor: R$ ${dealValueParam.toLocaleString('pt-BR')}` : ''}${lossReasonParam ? ` - Motivo: ${lossReasonParam}` : ''}`,
      } as any) as any);

      if (newStatus === 'perdido' && lossReasonParam) {
        // Also update the related proposal if one exists
        const leadProposals = allProposals.filter(p => p.lead_id === leadId);
        if (leadProposals.length > 0) {
          const latestProposal = leadProposals[0];
          await (supabase.from('proposals') as any).update({ status: 'lost', loss_reason: lossReasonParam, closed_at: new Date().toISOString() }).eq('id', latestProposal.id);
        }
      } else if (newStatus === 'ganho' && dealValueParam) {
        const leadProposals = allProposals.filter(p => p.lead_id === leadId);
        if (leadProposals.length > 0) {
          const latestProposal = leadProposals[0];
          await (supabase.from('proposals') as any).update({ status: 'won', value: dealValueParam, closed_at: new Date().toISOString() }).eq('id', latestProposal.id);
        }
      }
    } catch (error) {
      console.error('Error updating status:', error);
      // Em caso de erro, recarrega os dados para garantir sincronização
      loadLeads();
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
      const lead = leads.find(l => l.id === draggedLead);
      if (lead && lead.status !== status) {
        if (status === 'ganho') {
          setPendingStatusUpdate({ leadId: draggedLead, status });
          setShowDealValueModal(true);
        } else if (status === 'perdido') {
          setPendingStatusUpdate({ leadId: draggedLead, status });
          setShowLossReasonModal(true);
        } else {
          updateLeadStatus(draggedLead, status);
        }
      }
      setDraggedLead(null);
    }
  };

  const confirmDealValue = () => {
    if (pendingStatusUpdate) {
      const value = parseFloat(dealValue.replace(/\D/g, ''));
      if (value > 0) {
        updateLeadStatus(pendingStatusUpdate.leadId, pendingStatusUpdate.status, value);
        setShowDealValueModal(false);
        setPendingStatusUpdate(null);
        setDealValue('');
      } else {
        alert('Por favor, insira um valor válido');
      }
    }
  };

  const confirmLossReason = () => {
    if (pendingStatusUpdate && lossReason.trim()) {
      updateLeadStatus(pendingStatusUpdate.leadId, pendingStatusUpdate.status, undefined, lossReason);
      setShowLossReasonModal(false);
      setPendingStatusUpdate(null);
      setLossReason('');
    } else {
      alert('Por favor, informe o motivo da perda');
    }
  };

  const cancelLossReason = () => {
    setShowLossReasonModal(false);
    setPendingStatusUpdate(null);
    setLossReason('');
    loadLeads();
  };

  const cancelDealValue = () => {
    setShowDealValueModal(false);
    setPendingStatusUpdate(null);
    setDealValue('');
    loadLeads();
  };

  const openWhatsAppChat = (lead: Lead) => {
    window.location.href = `/whatsapp-conversations?lead=${lead.id}`;
  };

  const getClassificationBadge = (classification: LeadClassification) => {
    const colors = {
      estrategico: 'bg-green-500',
      qualificado: 'bg-yellow-500',
      morno: 'bg-gray-400',
    };
    return colors[classification as keyof typeof colors] || colors.morno;
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
      'cargo': 'Cargo',
      'num_colaboradores': 'Nº de Colaboradores',
      'faturamento_mensal': 'Faturamento Mensal',
      'cargo_real': 'Cargo (Validado)',
      'num_colaboradores_real': 'Colaboradores (Validado)',
      'faturamento_real': 'Faturamento (Validado)',
      'proximo_passo': 'Próximo Passo',
      'timeline_real': 'Prazo Estimado',
      'notas_triagem': 'Notas da Conversa',
    };
    return translations[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatAnswerValue = (value: string) => {
    const translations: Record<string, string> = {
      'sim': 'Sim',
      'nao': 'Não',
      'abaixo_100k': 'Abaixo de R$ 100k',
      '100k_200k': 'R$ 100k – R$ 200k',
      '200k_500k': 'R$ 200k – R$ 500k',
      '500k_1m': 'R$ 500k – R$ 1M',
      'acima_1m': 'Acima de R$ 1M',
      'imediato': 'Imediato (menos de 7 dias)',
      'curto': 'Curto prazo (7–30 dias)',
      'medio': 'Médio prazo (1–3 meses)',
      'longo': 'Longo prazo (+3 meses)',
    };
    return translations[value] || value;
  };

  const openLeadDetail = async (lead: Lead) => {
    setSelectedLead(lead);
    setEditForm({
      full_name: lead.full_name,
      phone: lead.phone,
      email: lead.email || '',
      source: lead.source,
      campaign: lead.campaign || '',
      notes: lead.notes || '',
    });
    setIsEditingLead(false);
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

  const handleEditLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    try {
      const { error } = await (supabase.from('leads') as any)
        .update({
          full_name: editForm.full_name,
          phone: editForm.phone,
          email: editForm.email,
          source: editForm.source,
          campaign: editForm.campaign,
          notes: editForm.notes,
        })
        .eq('id', selectedLead.id);

      if (error) throw error;

      // Update local state to reflect changes immediately
      setLeads(prev => prev.map(l => 
        l.id === selectedLead.id 
          ? { ...l, ...editForm, email: editForm.email, campaign: editForm.campaign, notes: editForm.notes }
          : l
      ));
      
      setSelectedLead({
        ...selectedLead,
        ...editForm,
        email: editForm.email,
        campaign: editForm.campaign,
        notes: editForm.notes,
      });

      setIsEditingLead(false);
      alert('Lead atualizado com sucesso!');
      loadLeads(); // Refresh data
    } catch (error) {
      console.error('Error updating lead:', error);
      alert('Erro ao atualizar lead');
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newLead.full_name || !newLead.phone) {
      alert('Nome e telefone são obrigatórios');
      return;
    }

    try {
      const { data: lead, error: leadError } = await (supabase.from('leads') as any)
        .insert({
          full_name: newLead.full_name,
          phone: newLead.phone,
          email: newLead.email,
          source: newLead.source,
          campaign: newLead.campaign,
          notes: newLead.notes,
          owner_user_id: profile?.id,
          status: 'novo',
        })
        .select()
        .single();

      if (leadError) throw leadError;

      if (lead) {
        const { error: activityError } = await (supabase.from('activities') as any).insert({
          lead_id: lead.id,
          type: 'initial_contact',
          channel: 'internal',
          user_id: profile?.id,
          content: `Lead criado manualmente: ${lead.full_name}`,
        });
        if (activityError) console.error('Error creating activity:', activityError);
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="space-y-4 bg-gray-100 min-h-screen">
      <div className="bg-white border-b border-gray-300 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Negociações</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowFilterModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium relative"
            >
              <Filter className="w-4 h-4" />
              Filtrar
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 bg-blue-600 text-white text-[9px] font-bold rounded-full border-2 border-white flex items-center justify-center px-0.5">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
              <BarChart3 className="w-4 h-4" />
              Fluxo geral
            </button>
            <button
              onClick={() => setShowNewLeadModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Novo Lead
            </button>
          </div>
        </div>
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
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-900">{selectedLead.full_name}</h2>
                {!isEditingLead && (
                  <button
                    onClick={() => setIsEditingLead(true)}
                    className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Editar Lead
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedLead(null);
                  setIsEditingLead(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {isEditingLead ? (
                <form onSubmit={handleEditLead} className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                      <input
                        type="text"
                        required
                        value={editForm.full_name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Telefone *</label>
                      <input
                        type="tel"
                        required
                        value={editForm.phone}
                        onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
                      <select
                        value={editForm.source}
                        onChange={(e) => setEditForm(prev => ({ ...prev, source: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Campanha</label>
                      <input
                        type="text"
                        value={editForm.campaign}
                        onChange={(e) => setEditForm(prev => ({ ...prev, campaign: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                      <textarea
                        value={editForm.notes}
                        onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setIsEditingLead(false)}
                      className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Salvar Alterações
                    </button>
                  </div>
                </form>
              ) : (
                <>
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
                    <div className="text-xs text-gray-600">Perfil</div>
                    <div className="text-lg font-bold text-gray-900">{selectedLead.score_decision}/50</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Faturamento</div>
                    <div className="text-lg font-bold text-gray-900">{selectedLead.score_urgency}/50</div>
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
            </>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Filter className="w-5 h-5" /> Filtros
              </h2>
              <button onClick={() => setShowFilterModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Classificação */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Classificação</label>
                <select
                  value={filters.classification}
                  onChange={(e) => setFilters({ ...filters, classification: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="all">Todas</option>
                  <option value="estrategico">Estratégico</option>
                  <option value="qualificado">Qualificado</option>
                  <option value="morno">Morno</option>
                </select>
              </div>

              {/* Campanha (UTM Campaign) — multi */}
              {uniqueCampaigns.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-gray-700">Campanha (UTM)</label>
                    {filters.campaigns.length > 0 && (
                      <button
                        onClick={() => setFilters(prev => ({ ...prev, campaigns: [] }))}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Limpar ({filters.campaigns.length})
                      </button>
                    )}
                  </div>
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
                    {uniqueCampaigns.map((camp) => (
                      <label key={camp} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={filters.campaigns.includes(camp)}
                          onChange={() => toggleMultiFilter('campaigns', camp)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 truncate">{camp}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* UTM Source — multi */}
              {uniqueSources.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-gray-700">Origem (UTM Source)</label>
                    {filters.utm_sources.length > 0 && (
                      <button
                        onClick={() => setFilters(prev => ({ ...prev, utm_sources: [] }))}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Limpar ({filters.utm_sources.length})
                      </button>
                    )}
                  </div>
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-36 overflow-y-auto">
                    {uniqueSources.map((src) => (
                      <label key={src} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={filters.utm_sources.includes(src)}
                          onChange={() => toggleMultiFilter('utm_sources', src)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{src}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* UTM Medium — multi */}
              {uniqueMediums.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-gray-700">Mídia (UTM Medium)</label>
                    {filters.utm_mediums.length > 0 && (
                      <button
                        onClick={() => setFilters(prev => ({ ...prev, utm_mediums: [] }))}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Limpar ({filters.utm_mediums.length})
                      </button>
                    )}
                  </div>
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-36 overflow-y-auto">
                    {uniqueMediums.map((med) => (
                      <label key={med} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={filters.utm_mediums.includes(med)}
                          onChange={() => toggleMultiFilter('utm_mediums', med)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{med}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={() => setFilters({ classification: 'all', campaigns: [], utm_sources: [], utm_mediums: [] })}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Limpar tudo
              </button>
              <button
                onClick={() => setShowFilterModal(false)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-6 px-6">
        {stages.map((stage) => {
          // Apply filters
          let columnLeads = leads.filter((lead) => lead.status === stage.stage_key);
          
          if (filters.classification !== 'all') {
            columnLeads = columnLeads.filter(l => l.classification === filters.classification);
          }
          if (filters.campaigns.length > 0) {
            columnLeads = columnLeads.filter(l => filters.campaigns.includes(l.campaign));
          }
          if (filters.utm_sources.length > 0) {
            columnLeads = columnLeads.filter(l => filters.utm_sources.includes(l.utm_source));
          }
          if (filters.utm_mediums.length > 0) {
            columnLeads = columnLeads.filter(l => filters.utm_mediums.includes(l.utm_medium));
          }

          const totalValue = columnLeads.reduce((sum, lead) => {
            const leadProposals = allProposals.filter(p => p.lead_id === lead.id);
            if (stage.stage_key === 'ganho') {
              return sum + leadProposals.filter(p => p.status === 'won').reduce((s, p) => s + p.value, 0);
            }
            return sum + leadProposals.reduce((s, p) => s + p.value, 0);
          }, 0);

          return (
            <div
              key={stage.id}
              className={`flex-shrink-0 w-[340px] transition-all ${
                draggedLead && leads.find(l => l.id === draggedLead)?.status !== stage.stage_key
                  ? 'ring-2 ring-blue-400 ring-opacity-50 rounded-lg'
                  : ''
              }`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.stage_key as LeadStatus)}
            >
              <div className={`rounded-lg p-3 mb-3 transition-all ${
                draggedLead && leads.find(l => l.id === draggedLead)?.status !== stage.stage_key
                  ? 'bg-blue-50 border-2 border-blue-300'
                  : 'bg-white border border-gray-300'
              }`}
              style={{ borderLeftColor: stage.color, borderLeftWidth: '4px' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-semibold text-xs uppercase tracking-wider text-gray-700">
                    {stage.name}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{columnLeads.length}</span>
                  </div>
                </div>
                {totalValue > 0 && (
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(totalValue)}</p>
                )}
              </div>

              <KanbanColumnBody
                columnLeads={columnLeads}
                stage={stage}
                allProposals={allProposals}
                leadActivities={leadActivities}
                lastInteractions={lastInteractions}
                draggedLead={draggedLead}
                showActionMenu={showActionMenu}
                setShowActionMenu={setShowActionMenu}
                handleDragStart={handleDragStart}
                openWhatsAppChat={openWhatsAppChat}
                openLeadDetail={openLeadDetail}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                formatRelativeTime={formatRelativeTime}
              />
            </div>
          );
        })}
      </div>

      {selectedLead && (
        <LeadDetailModal 
          leadId={selectedLead.id} 
          onClose={() => {
            setSelectedLead(null);
            loadLeads(); // Refresh pipeline data when modal closes
          }} 
        />
      )}

      <style>{`
        .styled-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .styled-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }
        .styled-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e0;
          border-radius: 3px;
        }
        .styled-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a0aec0;
        }
      `}</style>
    </div>
  );
}
