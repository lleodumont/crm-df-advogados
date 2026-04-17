import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, CheckCheck, Info, Tag as TagIcon, X, TrendingUp, RefreshCw, CalendarPlus, UserCheck, Paperclip, Image, Music, FileText, Download, ZoomIn, Video } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import LeadDetailModal from './LeadDetailModal';
import ActivityModal from './ActivityModal';
import { playNotificationSound } from '../lib/notificationSound';

interface Message {
  id: string;
  phone_number: string;
  message_type: string;
  content: string;
  media_url: string | null;
  direction: 'inbound' | 'outbound';
  status: string;
  created_at: string;
}

interface MediaPreview {
  file: File;
  base64: string;
  type: 'image' | 'audio' | 'video' | 'document';
  name: string;
  mimeType: string;
}

interface WhatsAppInstance {
  id: string;
  name: string;
  instance_id: string;
  status: string;
  phone_number: string | null;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Props {
  leadId: string;
  leadPhone: string;
  leadName: string;
}

export default function WhatsAppChat({ leadId, leadPhone, leadName }: Props) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  // Header States (Kept for quick actions)
  const [leadTags, setLeadTags] = useState<Tag[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [leadBasicData, setLeadBasicData] = useState<any>(null);
  
  // UI Popovers
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [showStageSelector, setShowStageSelector] = useState(false);
  const [showAssignPopover, setShowAssignPopover] = useState(false);
  const [showActivityPopover, setShowActivityPopover] = useState(false);
  
  // Action States
  const [updatingStage, setUpdatingStage] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Assign responsible
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [currentAssigned, setCurrentAssigned] = useState<{ id: string; full_name: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Media states
  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const mediaMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFileType, setPendingFileType] = useState<'image' | 'audio' | 'video' | 'document' | null>(null);

  useEffect(() => {
    loadInstances();
    loadMessages();
    loadHeaderData();
    fetchUsers();

    const channel = supabase
      .channel(`whatsapp_messages_${leadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `lead_id=eq.${leadId}`
        },
        (payload) => {
          if (payload.new?.direction === 'inbound') {
            playNotificationSound('message');
          }
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadHeaderData = async () => {
    try {
      const [leadRes, tagsRes, allTagsRes, stagesRes] = await Promise.all([
        supabase.from('leads').select('score_total, status, owner_user_id').eq('id', leadId).single(),
        supabase.from('lead_tags').select('tags(id, name, color)').eq('lead_id', leadId),
        supabase.from('tags').select('*').order('name'),
        supabase.from('pipeline_stages').select('*').order('order_index')
      ]);

      if (leadRes.data) setLeadBasicData(leadRes.data);
      if (tagsRes.data) setLeadTags((tagsRes.data as any[]).map(t => t.tags).filter(Boolean));
      if (allTagsRes.data) setAvailableTags(allTagsRes.data);
      if (stagesRes.data) setStages(stagesRes.data);
    } catch (error) {
      console.error('Error loading header data:', error);
    }
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('user_profiles').select('id, full_name').order('full_name');
    setUsers(data?.map(u => ({ id: u.id, full_name: u.full_name || 'Usuário Sem Nome' })) || []);
  };

  const loadInstances = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('status', 'connected')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInstances(data || []);
      if (data && data.length > 0) {
        setSelectedInstance((data[0] as any).instance_id);
      }
    } catch (error) {
      console.error('Error loading instances:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Basic deduplication logic
      const deduped: Message[] = [];
      (data as Message[] || []).forEach((msg: Message) => {
        const isDup = deduped.some(
          (m) =>
            m.content === msg.content &&
            m.direction === msg.direction &&
            Math.abs(new Date(m.created_at).getTime() - new Date(msg.created_at).getTime()) < 3000
        );
        if (!isDup) deduped.push(msg);
      });

      setMessages(deduped);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const uploadToStorage = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `outbound/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;

    const { error } = await supabase.storage
      .from('whatsapp-media')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) throw new Error('Falha ao fazer upload: ' + error.message);

    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(path);

    return publicUrl;
  };

  const handleFileSelect = (type: 'image' | 'audio' | 'video' | 'document') => {
    setShowMediaMenu(false);
    if (!fileInputRef.current) return;
    if (type === 'image') fileInputRef.current.accept = 'image/*';
    else if (type === 'audio') fileInputRef.current.accept = 'audio/*';
    else if (type === 'video') fileInputRef.current.accept = 'video/*';
    else fileInputRef.current.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,application/*';
    setPendingFileType(type);
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const type = pendingFileType;
    if (!type) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('Arquivo muito grande. O limite é 15MB.');
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setMediaPreview({ file, base64, type, name: file.name, mimeType: file.type });
    } catch {
      alert('Erro ao processar o arquivo. Tente novamente.');
    }
  };

  const cancelMediaPreview = () => {
    setMediaPreview(null);
  };

  const sendMedia = async () => {
    if (!mediaPreview || !selectedInstance) return;

    setSendingMedia(true);
    const preview = mediaPreview;
    setMediaPreview(null);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      phone_number: leadPhone,
      message_type: preview.type,
      content: preview.name,
      media_url: preview.type === 'image' ? `data:${preview.mimeType};base64,${preview.base64}` : null,
      direction: 'outbound',
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // 1. Upload direto para o Storage (sem passar pela Edge Function)
      const publicUrl = await uploadToStorage(preview.file);

      // 2. Envia só a URL para a Edge Function — sem base64 no body
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-send`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          instanceId: selectedInstance,
          phoneNumber: leadPhone,
          leadId: leadId,
          mediaType: preview.type,
          mediaUrl: publicUrl,
          mediaMimeType: preview.mimeType,
          mediaFilename: preview.name,
          mediaCaption: preview.name,
          message: preview.name,
        }),
      });

      if (!response.ok) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao enviar mídia');
      }
    } catch (error) {
      console.error('Error sending media:', error);
      alert('Erro ao enviar: ' + (error as Error).message);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSendingMedia(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedInstance) return;

    setSending(true);
    const messageText = newMessage;
    setNewMessage('');

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      phone_number: leadPhone,
      message_type: 'text',
      content: messageText,
      media_url: null,
      direction: 'outbound',
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-send`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          instanceId: selectedInstance,
          phoneNumber: leadPhone,
          message: messageText,
          leadId: leadId,
        }),
      });

      if (!response.ok) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setNewMessage(messageText);
        const rawText = await response.text().catch(() => '');
        let errMsg = `HTTP ${response.status}`;
        try {
          const errData = JSON.parse(rawText);
          errMsg = errData.error || errData.message || errMsg;
        } catch {
          if (rawText) errMsg += ': ' + rawText.slice(0, 200);
        }
        throw new Error(errMsg);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Erro ao enviar: ' + (error as Error).message);
    } finally {
      setSending(false);
    }
  };

  const updateLeadStatus = async (newStatus: string) => {
    setUpdatingStage(true);
    try {
      const { error } = await supabase.from('leads').update({ status: newStatus as any }).eq('id', leadId);
      if (error) throw error;
      setLeadBasicData((prev: any) => ({ ...prev, status: newStatus }));
      setShowStageSelector(false);
    } catch (error) {
      console.error('Error updating stage:', error);
    } finally {
      setUpdatingStage(false);
    }
  };

  const addTag = async (tagId: string) => {
    try {
      const { error } = await supabase.from('lead_tags').insert({ lead_id: leadId, tag_id: tagId, created_by: profile?.id } as any);
      if (error) throw error;
      loadHeaderData();
    } catch (error: any) {
      console.error('Error adding tag:', error);
      alert('Erro ao adicionar etiqueta: ' + error.message);
    }
  };

  const removeTag = async (tagId: string) => {
    try {
      const { error } = await supabase.from('lead_tags').delete().eq('lead_id', leadId).eq('tag_id', tagId);
      if (error) throw error;
      setLeadTags(prev => prev.filter(t => t.id !== tagId));
    } catch (error: any) {
      console.error('Error removing tag:', error);
      alert('Erro ao remover etiqueta: ' + error.message);
    }
  };

  const assignResponsible = async (userId: string, userName: string) => {
    try {
      const { error } = await supabase.from('leads').update({ owner_user_id: userId } as any).eq('id', leadId);
      if (error) throw error;
      setCurrentAssigned({ id: userId, full_name: userName });
      setShowAssignPopover(false);
    } catch (error: any) {
      console.error('Error assigning:', error);
      alert('Erro ao atribuir responsável: ' + error.message);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateLabel = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hoje';
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
    return date.toLocaleDateString('pt-BR');
  };

  const groupedMessages = (() => {
    const grouped: { [key: string]: Message[] } = {};
    messages.forEach((message) => {
      const date = new Date(message.created_at).toDateString();
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(message);
    });
    return grouped;
  })();

  if (instances.length === 0 && !loading) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center h-full flex flex-col items-center justify-center">
        <MessageCircle className="w-12 h-12 text-yellow-600 mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Sem conexão WhatsApp</h3>
        <p className="text-gray-600 mb-4">Configure uma instância conectada para ver as conversas.</p>
        <a href="/whatsapp-settings" className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-bold">
          Configurar Instância
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col h-full min-h-0 relative border border-gray-100">
      
      {/* Header Info */}
      <div className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-[40]">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => window.history.back()} className="text-gray-400 hover:text-gray-600 transition-colors">
              &larr;
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black shadow-lg shadow-blue-200">
                {leadName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
              </div>
              <div>
                <h2 className="font-bold text-gray-900 leading-tight flex items-center gap-2">
                  {leadName}
                  {leadBasicData?.score_total !== undefined && (
                    <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-full text-[10px] font-black border ${
                      leadBasicData.score_total >= 70 ? 'bg-green-50 text-green-700 border-green-200' :
                      leadBasicData.score_total >= 40 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {leadBasicData.score_total}
                    </span>
                  )}
                  {leadTags.map(tag => (
                    <span
                      key={tag.id}
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap"
                      style={{ 
                        backgroundColor: `${tag.color}10`, 
                        color: tag.color,
                        borderColor: `${tag.color}30`
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                  <button onClick={() => setIsModalOpen(true)} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full hover:bg-blue-100 transition">
                    <Info className="w-3 h-3" /> Detalhes
                  </button>
                </h2>
                <div className="text-xs font-medium text-gray-500 mt-0.5 flex items-center gap-2">
                  {leadPhone}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowTagSelector(!showTagSelector); setShowStageSelector(false); setShowActivityPopover(false); setShowAssignPopover(false); }}
              className={`p-2 rounded-xl transition-all ${showTagSelector ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
              title="Etiquetas"
            >
              <TagIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => { setShowStageSelector(!showStageSelector); setShowTagSelector(false); setShowActivityPopover(false); setShowAssignPopover(false); }}
              className={`p-2 rounded-xl transition-all ${showStageSelector ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
              title="Funil"
            >
              <TrendingUp className="w-5 h-5" />
            </button>
            <button
              onClick={() => { setShowActivityPopover(true); setShowTagSelector(false); setShowStageSelector(false); setShowAssignPopover(false); }}
              className={`p-2 rounded-xl transition-all text-gray-400 hover:bg-gray-50 hover:text-gray-600`}
              title="Nova Atividade"
            >
              <CalendarPlus className="w-5 h-5" />
            </button>
            <button
              onClick={() => { setShowAssignPopover(!showAssignPopover); setShowTagSelector(false); setShowStageSelector(false); setShowActivityPopover(false); }}
              className={`p-2 rounded-xl flex items-center justify-center transition-all ${showAssignPopover ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
              title="Responsável"
            >
              {leadBasicData?.owner_user_id && users.some((u: any) => u.id === leadBasicData.owner_user_id) ? (
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[9px] font-black text-blue-700 shadow-sm border border-white">
                  {users.find((u: any) => u.id === leadBasicData.owner_user_id)?.full_name.split(' ').map((n:string)=>n[0]).slice(0,2).join('')}
                </div>
              ) : (
                <UserCheck className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Connection Status Banner if needed */}
        {!loading && instances.length === 0 && (
           <div className="bg-red-50 text-red-600 p-2 text-center text-[10px] uppercase font-black tracking-widest animate-pulse">
             Sem WhatsApp Conectado
           </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-white p-6 space-y-2 styled-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full"><RefreshCw className="w-8 h-8 animate-spin text-blue-200 mb-2" /><p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Carregando Chat...</p></div>
        ) : Object.keys(groupedMessages).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400"><MessageCircle className="w-16 h-16 opacity-10 mb-4" /><p className="font-black text-[10px] uppercase tracking-[0.2em]">Inicie uma conversa agora</p></div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              <div className="flex items-center justify-center my-8"><div className="bg-gray-50 px-4 py-1.5 rounded-full text-[10px] text-gray-400 font-black border border-gray-100 uppercase tracking-widest">{formatDateLabel(date)}</div></div>
              {msgs.map((message) => {
                const isFromLead = message.direction === 'inbound';
                const msgType = message.message_type;
                const mediaUrl = message.media_url;

                const renderMediaContent = () => {
                  if (msgType === 'image' && mediaUrl) {
                    return (
                      <div className="mb-2">
                        <div className="relative group cursor-pointer" onClick={() => setLightboxUrl(mediaUrl)}>
                          <img
                            src={mediaUrl}
                            alt={message.content || 'Imagem'}
                            className="max-w-full rounded-xl max-h-60 object-cover w-full"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl transition-all flex items-center justify-center">
                            <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-all drop-shadow-lg" />
                          </div>
                        </div>
                        {message.content && message.content !== 'Image' && (
                          <p className="text-xs mt-1.5 opacity-80">{message.content}</p>
                        )}
                      </div>
                    );
                  }
                  if (msgType === 'audio' && mediaUrl) {
                    return (
                      <div className="mb-2">
                        <audio
                          controls
                          src={mediaUrl}
                          className="w-full max-w-xs h-10 rounded-lg"
                          style={{ minWidth: '220px' }}
                        >
                          Seu navegador não suporta reprodução de áudio.
                        </audio>
                      </div>
                    );
                  }
                  if (msgType === 'video') {
                    if (mediaUrl) {
                      return (
                        <div className="mb-2">
                          <video
                            controls
                            src={mediaUrl}
                            className="max-w-full rounded-xl max-h-60 w-full"
                          >
                            <a href={mediaUrl} target="_blank" rel="noopener noreferrer">Baixar vídeo</a>
                          </video>
                          {message.content && message.content !== 'Video' && (
                            <p className="text-xs mt-1.5 opacity-80">{message.content}</p>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div className="mb-2">
                        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold ${isFromLead ? 'bg-white border-gray-200 text-gray-700' : 'bg-blue-500 border-blue-400 text-white'}`}>
                          <FileText className="w-5 h-5 flex-shrink-0" />
                          <span>🎥 {message.content || 'Vídeo recebido'}</span>
                        </div>
                      </div>
                    );
                  }
                  if (msgType === 'document') {
                    return (
                      <div className="mb-2">
                        <a
                          href={mediaUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all hover:opacity-80 ${isFromLead ? 'bg-white border-gray-200 text-gray-700' : 'bg-blue-500 border-blue-400 text-white'}`}
                        >
                          <FileText className="w-5 h-5 flex-shrink-0" />
                          <span className="truncate max-w-[180px]">{message.content || 'Documento'}</span>
                          {mediaUrl && <Download className="w-4 h-4 flex-shrink-0 ml-auto" />}
                        </a>
                      </div>
                    );
                  }
                  return null;
                };

                const mediaContent = renderMediaContent();
                const hasMedia = !!mediaContent;
                const isOnlyMedia = (hasMedia || msgType === 'video') && (!message.content || ['Image', 'Audio message', 'Document', 'Video'].includes(message.content));

                return (
                  <div key={message.id} className={`flex ${isFromLead ? 'justify-start' : 'justify-end'} mb-2`}>
                    <div className={`max-w-[80%] px-4 py-3 rounded-2xl shadow-sm text-sm font-medium leading-relaxed ${isFromLead ? 'bg-gray-100 text-gray-800 rounded-tl-none border border-gray-200/50' : 'bg-blue-600 text-white rounded-tr-none shadow-blue-100'}`}>
                      {mediaContent}
                      {!isOnlyMedia && message.content}
                      <div className={`text-[9px] mt-1.5 font-bold uppercase tracking-wider flex justify-end gap-1 ${isFromLead ? 'text-gray-400' : 'text-blue-200'}`}>
                        {formatTime(message.created_at)}
                        {!isFromLead && message.status === 'sent' && <CheckCheck className="w-3 h-3" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Hidden file input — always in DOM so .click() works in all browsers */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Footer / Input */}
      <div className="border-t border-gray-100 p-4 bg-gray-50/50 backdrop-blur-md relative z-[60]">
        {/* Media Preview */}
        {mediaPreview && (
          <div className="mb-3 flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm max-w-4xl mx-auto">
            {mediaPreview.type === 'image' && (
              <img
                src={`data:${mediaPreview.mimeType};base64,${mediaPreview.base64}`}
                alt="Preview"
                className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-gray-100"
              />
            )}
            {mediaPreview.type === 'audio' && (
              <div className="w-14 h-14 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0 border border-purple-100">
                <Music className="w-7 h-7 text-purple-500" />
              </div>
            )}
            {mediaPreview.type === 'video' && (
              <div className="w-14 h-14 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 border border-red-100">
                <Video className="w-7 h-7 text-red-500" />
              </div>
            )}
            {mediaPreview.type === 'document' && (
              <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 border border-blue-100">
                <FileText className="w-7 h-7 text-blue-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-gray-800 truncate">{mediaPreview.name}</p>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-0.5">
                {mediaPreview.type === 'image' ? 'Imagem' : mediaPreview.type === 'audio' ? 'Áudio' : mediaPreview.type === 'video' ? 'Vídeo' : 'Documento'}
                {' · '}{(mediaPreview.file.size / 1024).toFixed(0)} KB
              </p>
            </div>
            <button
              onClick={cancelMediaPreview}
              className="w-7 h-7 rounded-full bg-gray-100 hover:bg-red-100 hover:text-red-500 flex items-center justify-center transition-colors flex-shrink-0"
              title="Cancelar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-3 max-w-4xl mx-auto relative">
          {/* Paperclip button with media menu */}
          <div className="relative" ref={mediaMenuRef}>
            <button
              onClick={() => setShowMediaMenu(prev => !prev)}
              disabled={sending || sendingMedia || instances.length === 0}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all flex-shrink-0 ${showMediaMenu ? 'bg-blue-100 text-blue-600' : 'bg-white border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 shadow-sm'} disabled:opacity-50`}
              title="Enviar mídia"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {showMediaMenu && (
              <div className="absolute bottom-14 left-0 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 w-44 z-[70] animate-in fade-in zoom-in-95">
                <button
                  onClick={() => handleFileSelect('image')}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center">
                    <Image className="w-4 h-4 text-green-600" />
                  </div>
                  Imagem
                </button>
                <button
                  onClick={() => handleFileSelect('audio')}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center">
                    <Music className="w-4 h-4 text-purple-600" />
                  </div>
                  Áudio
                </button>
                <button
                  onClick={() => handleFileSelect('video')}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
                    <Video className="w-4 h-4 text-red-600" />
                  </div>
                  Vídeo
                </button>
                <button
                  onClick={() => handleFileSelect('document')}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  Documento
                </button>
              </div>
            )}
          </div>

          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !sending && !sendingMedia) { e.preventDefault(); sendMessage(); } }}
            placeholder={mediaPreview ? 'Adicione uma legenda (opcional)...' : 'Digite uma mensagem...'}
            disabled={sending || sendingMedia || instances.length === 0}
            className="flex-1 px-5 py-3.5 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-50/50 resize-none max-h-32 text-sm font-medium transition-all shadow-sm shadow-gray-50 disabled:opacity-50"
            rows={1}
          />

          {/* Send button — sends media if preview exists, else text */}
          {mediaPreview ? (
            <button
              onClick={sendMedia}
              disabled={sendingMedia || instances.length === 0}
              className="w-12 h-12 bg-green-500 text-white rounded-2xl hover:bg-green-600 transition flex items-center justify-center shadow-xl shadow-green-100 disabled:opacity-50 active:scale-95"
              title="Enviar mídia"
            >
              {sendingMedia ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={sending || !newMessage.trim() || instances.length === 0}
              className="w-12 h-12 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition flex items-center justify-center shadow-xl shadow-blue-100 disabled:opacity-50 active:scale-95"
            >
              {sending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Modal Integration */}
      {isModalOpen && (
        <LeadDetailModal leadId={leadId} onClose={() => { setIsModalOpen(false); loadHeaderData(); }} />
      )}

      {/* Popovers for quick actions */}
      {showTagSelector && (
        <div className="absolute right-6 top-20 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[60] p-4 text-left animate-in fade-in zoom-in-95">
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Gerenciar Etiquetas</h4>
          <div className="flex flex-wrap gap-1.5 mb-4 px-1">
            {leadTags.map(tag => (
              <span key={tag.id} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black border" style={{ backgroundColor: `${tag.color}10`, color: tag.color, borderColor: `${tag.color}30` }}>
                {tag.name}
                <button onClick={() => removeTag(tag.id)} className="hover:bg-black/10 rounded-full p-0.5"><X className="w-2.5 h-2.5" /></button>
              </span>
            ))}
          </div>
          <div className="pt-3 border-t border-gray-50 max-h-48 overflow-y-auto styled-scrollbar">
            {availableTags.filter(t => !leadTags.some(lt => lt.id === t.id)).map(tag => (
              <button key={tag.id} onClick={() => addTag(tag.id)} className="w-full text-left px-2 py-2 rounded-xl text-[10px] font-black hover:bg-gray-50 flex items-center gap-2 transition-colors" style={{ color: tag.color }}>
                <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showStageSelector && (
        <div className="absolute right-6 top-20 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[60] overflow-hidden text-left animate-in fade-in zoom-in-95">
          <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">Mudar Funil</div>
          <div className="py-2 max-h-80 overflow-y-auto styled-scrollbar">
            {stages.map(stage => (
              <button key={stage.id} onClick={() => updateLeadStatus(stage.stage_key)} className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition ${leadBasicData?.status === stage.stage_key ? 'bg-blue-50/50 text-blue-700 font-black' : 'text-gray-600 font-bold'}`}>
                <div className={`w-2 h-2 rounded-full ${leadBasicData?.status === stage.stage_key ? 'bg-blue-600' : 'bg-gray-200'}`} />
                <span className="text-xs uppercase tracking-tight">{stage.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Activity Modal */}
      <ActivityModal
        isOpen={showActivityPopover}
        onClose={() => setShowActivityPopover(false)}
        onSuccess={() => {
          // Trigger some reload if needed, but the list of activities is managed elsewhere
          setShowActivityPopover(false);
        }}
        defaultLeadId={leadId}
      />

      {/* Assign Popover */}
      {showAssignPopover && (
        <div className="absolute right-6 top-20 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[60] overflow-hidden text-left animate-in fade-in zoom-in-95">
          <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">Responsáveis</div>
          <div className="max-h-60 overflow-y-auto styled-scrollbar">
            {users.map(u => (
              <button key={u.id} onClick={() => assignResponsible(u.id, u.full_name)} className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition border-b border-gray-50 last:border-0 ${leadBasicData?.owner_user_id === u.id ? 'bg-blue-50/50 font-black text-blue-700' : 'text-gray-600 font-bold'}`}>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-black text-blue-700 shadow-sm border border-white">
                  {u.full_name ? u.full_name.split(' ').map((n:string)=>n[0]).slice(0,2).join('') : '?'}
                </div>
                <span className="text-xs uppercase tracking-tight">{u.full_name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Backdrop for popovers */}
      {(showTagSelector || showStageSelector || showAssignPopover || showMediaMenu) && (
        <div className="fixed inset-0 z-[50]" onClick={() => { setShowTagSelector(false); setShowStageSelector(false); setShowAssignPopover(false); setShowMediaMenu(false); }} />
      )}

      {/* Lightbox for image zoom */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Imagem ampliada"
            className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
