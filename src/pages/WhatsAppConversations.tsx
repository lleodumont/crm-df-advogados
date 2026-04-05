import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MessageCircle, Search, User, X, Filter, ChevronDown, Send, Inbox, Hash, CheckCheck, MailOpen } from 'lucide-react';
import WhatsAppChat from '../components/WhatsAppChat';

interface Conversation {
  lead_id: string;
  lead_name: string;
  lead_phone: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  last_message_direction: 'inbound' | 'outbound';
  score_total: number;
  tags: Tag[];
  owner_name: string | null;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface StatsModalLead {
  lead_id: string;
  lead_name: string;
  lead_phone: string;
  count: number;
}

interface StatsModal {
  title: string;
  leads: StatsModalLead[];
}

interface MessageStats {
  totalConversations: number;
  totalSent: number;
  totalReceived: number;
  totalMessages: number;
  leadsSent: StatsModalLead[];
  leadsReceived: StatsModalLead[];
  leadsAll: StatsModalLead[];
}

export default function WhatsAppConversations() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageStats, setMessageStats] = useState<MessageStats | null>(null);
  const [statsModal, setStatsModal] = useState<StatsModal | null>(null);
  // Ref para acessar a conversa selecionada dentro de callbacks de subscription (evita stale closure)
  const selectedConversationRef = useRef<Conversation | null>(null);
  const tagFilterRef = useRef<HTMLDivElement>(null);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [closedLeadIds, setClosedLeadIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('closed_conversations') || '[]')); }
    catch { return new Set(); }
  });
  const [showClosed, setShowClosed] = useState(false);

  const closeConversation = (leadId: string) => {
    setClosedLeadIds(prev => {
      const next = new Set(prev);
      next.add(leadId);
      localStorage.setItem('closed_conversations', JSON.stringify(Array.from(next)));
      return next;
    });
    if (selectedConversation?.lead_id === leadId) setSelectedConversation(null);
  };

  const reopenConversation = (leadId: string) => {
    setClosedLeadIds(prev => {
      const next = new Set(prev);
      next.delete(leadId);
      localStorage.setItem('closed_conversations', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  // Mantém o ref sempre sincronizado com o estado
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // Fecha o dropdown de etiquetas ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tagFilterRef.current && !tagFilterRef.current.contains(e.target as Node)) {
        setShowTagFilter(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const initAndOpenConversation = async () => {
      await loadTags();
      await loadConversations();

      const params = new URLSearchParams(window.location.search);
      const leadIdFromUrl = params.get('lead');

      if (leadIdFromUrl) {
        openConversationByLeadId(leadIdFromUrl);
      }
    };

    initAndOpenConversation();

    const conversationsChannel = supabase
      .channel('conversations_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
        },
        (payload: any) => {
          loadConversations();
          // Se a mensagem chegou na conversa que está aberta, marca como lida imediatamente
          const openConv = selectedConversationRef.current;
          if (openConv && payload.new?.lead_id === openConv.lead_id && payload.new?.direction === 'inbound') {
            markMessagesAsRead(openConv.lead_id);
          }
        }
      )
      .subscribe();

    // Subscribe to lead_tags changes for real-time updates
    const leadTagsChannel = supabase
      .channel('realtime_lead_tags')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_tags'
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
      supabase.removeChannel(leadTagsChannel);
    };
  }, []);

  const loadTags = async () => {
    try {
      const { data } = await supabase
        .from('tags')
        .select('*')
        .order('name');
      setAvailableTags(data || []);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase.rpc('get_whatsapp_conversations', {});

      if (error) {
        console.error('RPC error:', error);
        await loadConversationsFallback();
        return;
      }

      const convs = data as Conversation[];

      // Fetch tags for these leads
      const leadIds = convs?.map(c => c.lead_id) || [];
      const { data: leadTags } = await supabase
        .from('lead_tags')
        .select(`
          lead_id,
          tags (
            id,
            name,
            color
          )
        `)
        .in('lead_id', leadIds);

      // Fetch fresh score_total + owner for all leads
      const { data: leadScores } = await supabase
        .from('leads')
        .select('id, score_total, owner_user_id')
        .in('id', leadIds);
      const scoreMap: Record<string, number> = {};
      const ownerIdMap: Record<string, string | null> = {};
      (leadScores || []).forEach((l: any) => {
        scoreMap[l.id] = l.score_total || 0;
        ownerIdMap[l.id] = l.owner_user_id || null;
      });

      // Fetch owner names
      const ownerIds = [...new Set(Object.values(ownerIdMap).filter(Boolean))] as string[];
      const ownerMap: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const { data: owners } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .in('id', ownerIds);
        (owners || []).forEach((u: any) => { ownerMap[u.id] = u.full_name || ''; });
      }

      const convsWithTags = convs?.map(conv => ({
        ...conv,
        unread_count: Number(conv.unread_count) || 0,
        score_total: scoreMap[conv.lead_id] ?? conv.score_total ?? 0,
        tags: (leadTags as any[])
          ?.filter(lt => lt.lead_id === conv.lead_id)
          .map(lt => (lt as any).tags)
          .filter(Boolean) as Tag[] || [],
        owner_name: ownerIdMap[conv.lead_id] ? (ownerMap[ownerIdMap[conv.lead_id]!] || null) : null,
      })) || [];

      setConversations(convsWithTags);
      loadMessageStats(convsWithTags);
    } catch (error) {
      console.error('Error loading conversations:', error);
      await loadConversationsFallback();
    } finally {
      setLoading(false);
    }
  };

  const loadConversationsFallback = async () => {
    try {
      const { data: messages, error: messagesError } = await supabase
        .from('whatsapp_messages')
        .select(`
          id,
          lead_id,
          phone_number,
          content,
          direction,
          created_at,
          leads (
            id,
            full_name,
            phone,
            score_total
          )
        `)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      const conversationsMap = new Map<string, Conversation>();

      (messages as any[])?.forEach((msg: any) => {
        const leadId = msg.lead_id;
        if (!leadId || conversationsMap.has(leadId)) return;

        conversationsMap.set(leadId, {
          lead_id: leadId,
          lead_name: msg.leads?.full_name || 'Desconhecido',
          lead_phone: msg.leads?.phone || msg.phone_number,
          last_message: msg.content || '',
          last_message_time: msg.created_at,
          unread_count: 0,
          score_total: msg.leads?.score_total || 0,
          last_message_direction: msg.direction,
          tags: []
        });
      });

      const fallbackLeadIds = Array.from(conversationsMap.keys());

      const [{ data: freshScores }, { data: unreadMsgs }] = await Promise.all([
        supabase.from('leads').select('id, score_total').in('id', fallbackLeadIds),
        supabase
          .from('whatsapp_messages')
          .select('lead_id')
          .in('lead_id', fallbackLeadIds)
          .eq('direction', 'inbound')
          .neq('status', 'read'),
      ]);

      (freshScores || []).forEach((l: any) => {
        const conv = conversationsMap.get(l.id);
        if (conv) conv.score_total = l.score_total || 0;
      });

      // Count unread per lead
      const unreadMap: Record<string, number> = {};
      (unreadMsgs || []).forEach((m: any) => {
        unreadMap[m.lead_id] = (unreadMap[m.lead_id] || 0) + 1;
      });
      conversationsMap.forEach((conv, leadId) => {
        conv.unread_count = unreadMap[leadId] || 0;
      });

      setConversations(Array.from(conversationsMap.values()));
    } catch (error) {
      console.error('Error in fallback:', error);
    }
  };

  const loadMessageStats = async (convs: Conversation[]) => {
    try {
      const { data: msgs } = await supabase
        .from('whatsapp_messages')
        .select('lead_id, direction');

      if (!msgs) return;

      const nameMap: Record<string, { name: string; phone: string }> = {};
      convs.forEach(c => { nameMap[c.lead_id] = { name: c.lead_name, phone: c.lead_phone }; });

      const sentMap = new Map<string, number>();
      const recvMap = new Map<string, number>();

      msgs.forEach((m: any) => {
        if (m.direction === 'outbound') sentMap.set(m.lead_id, (sentMap.get(m.lead_id) || 0) + 1);
        else recvMap.set(m.lead_id, (recvMap.get(m.lead_id) || 0) + 1);
      });

      const toList = (map: Map<string, number>): StatsModalLead[] =>
        Array.from(map.entries())
          .map(([lead_id, count]) => ({
            lead_id,
            lead_name: nameMap[lead_id]?.name || 'Desconhecido',
            lead_phone: nameMap[lead_id]?.phone || '',
            count,
          }))
          .sort((a, b) => b.count - a.count);

      const allMap = new Map<string, number>();
      msgs.forEach((m: any) => allMap.set(m.lead_id, (allMap.get(m.lead_id) || 0) + 1));

      setMessageStats({
        totalConversations: convs.length,
        totalSent: msgs.filter((m: any) => m.direction === 'outbound').length,
        totalReceived: msgs.filter((m: any) => m.direction === 'inbound').length,
        totalMessages: msgs.length,
        leadsSent: toList(sentMap),
        leadsReceived: toList(recvMap),
        leadsAll: toList(allMap),
      });
    } catch (e) {
      console.error('Error loading message stats:', e);
    }
  };

  const markAsUnread = async (leadId: string) => {
    try {
      // Busca a última mensagem inbound e marca como não lida
      const { data: lastMsg } = await supabase
        .from('whatsapp_messages')
        .select('id')
        .eq('lead_id', leadId)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastMsg) {
        await supabase
          .from('whatsapp_messages')
          .update({ status: 'received' })
          .eq('id', lastMsg.id);
      }

      // Atualiza o badge localmente
      setConversations(prev =>
        prev.map(c => c.lead_id === leadId ? { ...c, unread_count: 1 } : c)
      );

      // Se a conversa está aberta, fecha para refletir o estado não lido
      if (selectedConversation?.lead_id === leadId) {
        setSelectedConversation(null);
      }
    } catch (error) {
      console.error('Error marking as unread:', error);
    }
  };

  const markMessagesAsRead = async (leadId: string) => {
    try {
      await supabase
        .from('whatsapp_messages')
        .update({ status: 'read' })
        .eq('lead_id', leadId)
        .eq('direction', 'inbound')
        .neq('status', 'read');

      // Optimistically clear the badge in local state
      setConversations(prev =>
        prev.map(c => c.lead_id === leadId ? { ...c, unread_count: 0 } : c)
      );
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const openConversationByLeadId = async (leadId: string) => {
    try {
      const { data: lead, error } = await (supabase.from('leads') as any)
        .select('id, full_name, phone, score_total')
        .eq('id', leadId)
        .single();

      if (error || !lead) {
        console.error('Lead not found:', error);
        return;
      }

      const existingConv = conversations.find(c => c.lead_id === leadId);

      if (existingConv) {
        setSelectedConversation(existingConv);
      } else {
        setSelectedConversation({
          lead_id: (lead as any).id,
          lead_name: (lead as any).full_name,
          lead_phone: (lead as any).phone,
          last_message: '',
          last_message_time: new Date().toISOString(),
          unread_count: 0,
          score_total: (lead as any).score_total || 0,
          last_message_direction: 'outbound',
          tags: []
        });
      }
    } catch (error) {
      console.error('Error opening conversation:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (diffInHours < 48) {
      return 'Ontem';
    } else if (diffInHours < 168) {
      return date.toLocaleDateString('pt-BR', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      });
    }
  };

  const filteredConversations = conversations.filter(
    (conv) => {
      // Jurídico só vê conversas de leads com a etiqueta "Cliente ativo"
      if (profile?.role === 'juridico') {
        const hasClienteAtivo = conv.tags.some(tag => tag.name.toLowerCase() === 'cliente ativo');
        if (!hasClienteAtivo) return false;
      }

      const matchesSearch =
        conv.lead_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.lead_phone.includes(searchTerm) ||
        conv.tags.some(tag => tag.name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesTags =
        selectedTagIds.length === 0 ||
        selectedTagIds.every(tagId => conv.tags.some(tag => tag.id === tagId));

      return matchesSearch && matchesTags;
    }
  );

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  return (
    <>
    {/* Modal de leads por estatística */}
    {statsModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setStatsModal(null)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">{statsModal.title}</h2>
            <button onClick={() => setStatsModal(null)} className="p-1 hover:bg-gray-100 rounded-lg transition">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
            {statsModal.leads.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">Nenhum lead encontrado</p>
            ) : (
              statsModal.leads.map(lead => (
                <button
                  key={lead.lead_id}
                  onClick={() => {
                    const conv = conversations.find(c => c.lead_id === lead.lead_id);
                    if (conv) {
                      setSelectedConversation(conv);
                      markMessagesAsRead(conv.lead_id);
                    }
                    setStatsModal(null);
                  }}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700 flex-shrink-0">
                    {lead.lead_name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{lead.lead_name}</p>
                    <p className="text-xs text-gray-400 truncate">{lead.lead_phone}</p>
                  </div>
                  <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
                    {lead.count} msg
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    )}

    <div className="flex bg-white rounded-xl shadow-sm border border-gray-100" style={{ height: 'calc(100vh - 112px)' }}>

      {/* ── COLUNA ESQUERDA: lista de conversas ── */}
      <div className={`flex-shrink-0 border-r border-gray-100 flex flex-col w-full md:w-80 ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>

        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="w-5 h-5 text-green-600" />
            <h1 className="text-base font-bold text-gray-900">Conversas</h1>
          </div>

          {/* Stats clicáveis */}
          {messageStats && (
            <div className="grid grid-cols-4 gap-1 mb-3">
              <button
                onClick={() => setStatsModal({ title: `Conversas (${messageStats.totalConversations})`, leads: messageStats.leadsAll })}
                className="flex flex-col items-center py-1.5 px-1 bg-green-50 rounded-lg hover:bg-green-100 transition border border-green-100"
              >
                <MessageCircle className="w-3 h-3 text-green-600 mb-0.5" />
                <span className="text-xs font-bold text-green-700">{messageStats.totalConversations}</span>
                <span className="text-[9px] text-green-500 leading-none">Convs</span>
              </button>
              <button
                onClick={() => setStatsModal({ title: `Mensagens Enviadas (${messageStats.totalSent})`, leads: messageStats.leadsSent })}
                className="flex flex-col items-center py-1.5 px-1 bg-blue-50 rounded-lg hover:bg-blue-100 transition border border-blue-100"
              >
                <Send className="w-3 h-3 text-blue-600 mb-0.5" />
                <span className="text-xs font-bold text-blue-700">{messageStats.totalSent}</span>
                <span className="text-[9px] text-blue-500 leading-none">Enviadas</span>
              </button>
              <button
                onClick={() => setStatsModal({ title: `Mensagens Recebidas (${messageStats.totalReceived})`, leads: messageStats.leadsReceived })}
                className="flex flex-col items-center py-1.5 px-1 bg-purple-50 rounded-lg hover:bg-purple-100 transition border border-purple-100"
              >
                <Inbox className="w-3 h-3 text-purple-600 mb-0.5" />
                <span className="text-xs font-bold text-purple-700">{messageStats.totalReceived}</span>
                <span className="text-[9px] text-purple-500 leading-none">Recebidas</span>
              </button>
              <button
                onClick={() => setStatsModal({ title: `Total de Mensagens (${messageStats.totalMessages})`, leads: messageStats.leadsAll })}
                className="flex flex-col items-center py-1.5 px-1 bg-gray-50 rounded-lg hover:bg-gray-100 transition border border-gray-200"
              >
                <Hash className="w-3 h-3 text-gray-500 mb-0.5" />
                <span className="text-xs font-bold text-gray-700">{messageStats.totalMessages}</span>
                <span className="text-[9px] text-gray-400 leading-none">Total</span>
              </button>
            </div>
          )}

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition"
            />
          </div>

          {/* Filtro de etiquetas */}
          <div className="mt-2 relative" ref={tagFilterRef}>
            <button
              onClick={() => setShowTagFilter(!showTagFilter)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                selectedTagIds.length > 0
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Etiquetas</span>
              {selectedTagIds.length > 0 && (
                <span className="flex items-center justify-center w-4 h-4 bg-green-600 text-white text-[9px] font-bold rounded-full">
                  {selectedTagIds.length}
                </span>
              )}
              <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${showTagFilter ? 'rotate-180' : ''}`} />
            </button>

            {showTagFilter && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-2">
                <div className="px-3 py-1 border-b border-gray-100 flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase">Etiquetas</span>
                  {selectedTagIds.length > 0 && (
                    <button onClick={() => setSelectedTagIds([])} className="text-[10px] text-blue-600 hover:underline">Limpar</button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto px-1">
                  {availableTags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTagFilter(tag.id)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                        selectedTagIds.includes(tag.id) ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                      <span className="flex-1 text-left">{tag.name}</span>
                      {selectedTagIds.includes(tag.id) && <span className="text-blue-600">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tags ativas */}
          {selectedTagIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {availableTags.filter(t => selectedTagIds.includes(t.id)).map(tag => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
                  style={{ backgroundColor: `${tag.color}15`, color: tag.color, borderColor: `${tag.color}30` }}
                >
                  {tag.name}
                  <button onClick={() => toggleTagFilter(tag.id)} className="hover:bg-black/10 rounded-full">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Toggle abertos/fechados */}
        <div className="px-4 pb-2 flex gap-1 flex-shrink-0">
          <button
            onClick={() => setShowClosed(false)}
            className={`flex-1 py-1 text-xs font-medium rounded-lg transition-colors ${!showClosed ? 'bg-green-100 text-green-700' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            Abertos
          </button>
          <button
            onClick={() => setShowClosed(true)}
            className={`flex-1 py-1 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${showClosed ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            <CheckCheck className="w-3 h-3" />
            Fechados {closedLeadIds.size > 0 && `(${closedLeadIds.size})`}
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Carregando...</div>
          ) : filteredConversations.filter(c => showClosed ? closedLeadIds.has(c.lead_id) : !closedLeadIds.has(c.lead_id)).length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{showClosed ? 'Nenhum atendimento fechado' : 'Nenhuma conversa'}</p>
            </div>
          ) : (
            filteredConversations.filter(c => showClosed ? closedLeadIds.has(c.lead_id) : !closedLeadIds.has(c.lead_id)).map((conversation) => {
              const isActive = selectedConversation?.lead_id === conversation.lead_id;
              const initials = conversation.lead_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
              return (
                <div
                  key={conversation.lead_id}
                  className={`relative flex items-center gap-3 px-4 py-3 transition-colors border-b border-gray-50 group ${
                    isActive ? 'bg-green-50 border-l-2 border-l-green-500' : 'hover:bg-gray-50'
                  }`}
                >
                <button
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  onClick={() => {
                    setSelectedConversation(conversation);
                    markMessagesAsRead(conversation.lead_id);
                  }}
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                    isActive ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {initials || <User className="w-5 h-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Nome + hora */}
                    <div className="flex items-center justify-between">
                      <span className={`text-sm truncate ${isActive ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                        {conversation.lead_name}
                      </span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">
                        {formatTime(conversation.last_message_time)}
                      </span>
                    </div>

                    {/* Última mensagem + badge */}
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-gray-500 truncate flex-1">
                        {conversation.last_message_direction === 'outbound' && (
                          <span className="text-green-600">Você: </span>
                        )}
                        {conversation.last_message || <span className="italic opacity-60">Sem mensagens</span>}
                      </p>
                      {conversation.unread_count > 0 && (
                        <span className="ml-2 bg-green-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>

                    {/* Score + tags */}
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                        (conversation.score_total ?? 0) >= 70 ? 'bg-green-50 text-green-700 border-green-100' :
                        (conversation.score_total ?? 0) >= 40 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-gray-50 text-gray-500 border-gray-100'
                      }`}>
                        {conversation.score_total ?? 0}pts
                      </span>
                      {conversation.tags.slice(0, 2).map(tag => (
                        <span
                          key={tag.id}
                          className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold border"
                          style={{ backgroundColor: `${tag.color}10`, color: tag.color, borderColor: `${tag.color}30` }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>

                    {/* Responsável */}
                    {conversation.owner_name && (
                      <div className="flex items-center gap-1 mt-1">
                        <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="text-[10px] text-gray-400 truncate">{conversation.owner_name}</span>
                      </div>
                    )}
                  </div>
                </button>

                {/* Botões de ação */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 flex-shrink-0">
                  {!showClosed && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markAsUnread(conversation.lead_id); }}
                      title="Marcar como não lida"
                      className="p-1 rounded-full hover:bg-blue-100 text-gray-400 hover:text-blue-500"
                    >
                      <MailOpen className="w-4 h-4" />
                    </button>
                  )}
                  {showClosed ? (
                    <button
                      onClick={() => reopenConversation(conversation.lead_id)}
                      title="Reabrir atendimento"
                      className="p-1 rounded-full hover:bg-green-100 text-green-500"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => closeConversation(conversation.lead_id)}
                      title="Fechar atendimento"
                      className="p-1 rounded-full hover:bg-gray-200 text-gray-400"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── COLUNA DIREITA: chat ── */}
      <div className={`flex-1 min-w-0 flex flex-col ${!selectedConversation ? 'hidden md:flex' : 'flex'}`}>
        {/* Mobile back button */}
        <div className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
          <button
            onClick={() => setSelectedConversation(null)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Conversas
          </button>
          {selectedConversation && (
            <span className="font-semibold text-gray-900 ml-1 truncate">{selectedConversation.lead_name}</span>
          )}
        </div>
        <div className="flex-1 min-h-0">
          {selectedConversation ? (
            <WhatsAppChat
              leadId={selectedConversation.lead_id}
              leadPhone={selectedConversation.lead_phone}
              leadName={selectedConversation.lead_name}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
              <MessageCircle className="w-16 h-16 opacity-10" />
              <p className="text-sm font-medium">Selecione uma conversa para começar</p>
            </div>
          )}
        </div>
      </div>

    </div>
    </>
  );
}
