import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, CheckCheck, Info, Tag as TagIcon, X, TrendingUp, RefreshCw, CalendarPlus, UserCheck, Paperclip, Image, Music, FileText, Download, ZoomIn, Video, AlertCircle, LayoutTemplate } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import LeadDetailModal from './LeadDetailModal';
import ActivityModal from './ActivityModal';
import { notify } from '../lib/toast';

interface Message {
  id: string;
  phone_number: string;
  message_type: string;
  content: string;
  media_url: string | null;
  direction: 'inbound' | 'outbound';
  status: string;
  error?: string | null;
  created_at: string;
  transcription?: string | null;
}

interface Template {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: TemplateComponent[];
}

interface TemplateComponent {
  type: string;
  text?: string;
  buttons?: { type: string; text: string; url?: string; phone_number?: string }[];
  parameters?: { type: string; text?: string }[];
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
  provider: 'meta' | 'uazapi';
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

  // File input refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Quick replies
  const [quickReplies, setQuickReplies] = useState<{ id: string; shortcut: string; message: string }[]>([]);
  const [quickReplySuggestions, setQuickReplySuggestions] = useState<{ id: string; shortcut: string; message: string }[]>([]);
  const [quickReplyIndex, setQuickReplyIndex] = useState(0);
  const quickReplyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('quick_replies').select('id, shortcut, message').order('shortcut').then(({ data }) => {
      if (data) setQuickReplies(data);
    });
  }, []);

  // Reset textarea height when message is cleared (after send)
  useEffect(() => {
    if (!newMessage && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [newMessage]);

  // Transcription states
  const [transcribingIds, setTranscribingIds] = useState<Set<string>>(new Set());

  // Template states
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState(false);

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
        () => {
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

  // Fechar menu de mídia ao clicar fora
  useEffect(() => {
    if (!showMediaMenu) return;
    const handler = (e: MouseEvent) => {
      if (mediaMenuRef.current && !mediaMenuRef.current.contains(e.target as Node)) {
        setShowMediaMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMediaMenu]);

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

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setTemplates((data.templates || []).filter((t: Template) => t.status === 'APPROVED'));
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const sendTemplate = async (template: Template) => {
    if (!selectedInstance) return;
    setSendingTemplate(true);
    setShowTemplateModal(false);

    const tempId = `temp-${Date.now()}`;
    const bodyComponent = template.components.find(c => c.type === 'BODY');
    const optimisticMsg: Message = {
      id: tempId,
      phone_number: leadPhone,
      message_type: 'template',
      content: bodyComponent?.text || template.name,
      media_url: null,
      direction: 'outbound',
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          instanceId: selectedInstance,
          phoneNumber: leadPhone,
          leadId,
          templateName: template.name,
          templateLanguage: template.language,
          message: bodyComponent?.text || template.name,
        }),
      });

      const data = await res.json();
      // Remove optimistic — DB realtime will add the real record
      setMessages(prev => prev.filter(m => m.id !== tempId));
      if (!data.success) {
        notify.error('Erro ao enviar template: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      notify.error('Erro ao enviar template: ' + (error as Error).message);
    } finally {
      setSendingTemplate(false);
    }
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
      // Normaliza o telefone do lead para buscar mensagens em ambos os formatos (com/sem DDI 55)
      const rawPhone = leadPhone.replace(/\D/g, '');
      const phoneWith55 = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
      const phoneWithout55 = rawPhone.startsWith('55') ? rawPhone.slice(2) : rawPhone;
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .or(`lead_id.eq.${leadId},phone_number.eq.${phoneWith55},phone_number.eq.${phoneWithout55}`)
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

  const processFileFromInput = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'audio' | 'video' | 'document') => {
    const file = e.target.files?.[0];
    // Reset input so same file can be selected again
    e.target.value = '';
    if (!file) return;

    // Limit file size to 15MB
    if (file.size > 15 * 1024 * 1024) {
      notify.error('Arquivo muito grande. O limite é 15MB.');
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setMediaPreview({
        file,
        base64,
        type,
        name: file.name,
        mimeType: file.type,
      });
    } catch {
      notify.error('Erro ao processar o arquivo. Tente novamente.');
    }
  };

  const cancelMediaPreview = () => {
    setMediaPreview(null);
  };

  const transcribeAudio = async (messageId: string, audioUrl: string) => {
    setTranscribingIds(prev => new Set(prev).add(messageId));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audioUrl, messageId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro na transcrição');

      // Atualiza a mensagem localmente
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, transcription: json.transcription } : m
      ));
    } catch (err: any) {
      notify.error('Erro ao transcrever: ' + err.message);
    } finally {
      setTranscribingIds(prev => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
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
      notify.error('Erro ao enviar: ' + (error as Error).message);
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

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errMsg = data.error || `HTTP ${response.status}`;
        // Update optimistic message to show failure inline
        setMessages(prev => prev.map(m => m.id === tempId
          ? { ...m, status: 'failed', error: errMsg }
          : m
        ));
        notify.error('Erro ao enviar: ' + errMsg);
        return;
      }

      // If server returned success: false (Meta API failed but saved record)
      if (data.success === false) {
        const errMsg = data.error || 'Falha no envio';
        setMessages(prev => prev.map(m => m.id === tempId
          ? { ...m, status: 'failed', error: errMsg }
          : m
        ));
        notify.error('Mensagem não entregue: ' + errMsg);
        return;
      }

      // Success — remove optimistic, realtime will add real record
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } catch (error) {
      console.error('Error sending message:', error);
      const errMsg = (error as Error).message;
      setMessages(prev => prev.map(m => m.id === tempId
        ? { ...m, status: 'failed', error: errMsg }
        : m
      ));
      notify.error('Erro ao enviar: ' + errMsg);
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
      notify.error('Erro ao adicionar etiqueta: ' + error.message);
    }
  };

  const removeTag = async (tagId: string) => {
    try {
      const { error } = await supabase.from('lead_tags').delete().eq('lead_id', leadId).eq('tag_id', tagId);
      if (error) throw error;
      setLeadTags(prev => prev.filter(t => t.id !== tagId));
    } catch (error: any) {
      console.error('Error removing tag:', error);
      notify.error('Erro ao remover etiqueta: ' + error.message);
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
      notify.error('Erro ao atribuir responsável: ' + error.message);
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
                  {(selectedInstance && instances.find(i=>i.instance_id === selectedInstance)?.status === 'connected') && (
                     <span className="flex items-center gap-1 text-emerald-600 text-[10px] uppercase font-black">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                       Online
                     </span>
                  )}
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
                    const isTranscribing = transcribingIds.has(message.id);
                    return (
                      <div className="mb-2 space-y-2">
                        <audio
                          controls
                          src={mediaUrl}
                          className="w-full max-w-xs h-10 rounded-lg"
                          style={{ minWidth: '220px' }}
                        >
                          Seu navegador não suporta reprodução de áudio.
                        </audio>

                        {message.transcription ? (
                          <div className={`rounded-xl border p-3 text-xs space-y-1 ${isFromLead ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'}`}>
                            <div className="flex items-center gap-1.5 font-bold text-gray-500 mb-1">
                              <FileText className="w-3.5 h-3.5" />
                              <span>Transcrição do áudio</span>
                            </div>
                            <p className={`leading-relaxed ${isFromLead ? 'text-gray-700' : 'text-blue-900'}`}>{message.transcription}</p>
                          </div>
                        ) : (
                          <button
                            onClick={() => transcribeAudio(message.id, mediaUrl)}
                            disabled={isTranscribing}
                            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 ${isFromLead ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100' : 'text-blue-400 hover:text-blue-600 hover:bg-blue-50'}`}
                          >
                            {isTranscribing ? (
                              <><RefreshCw className="w-3 h-3 animate-spin" /> Transcrevendo...</>
                            ) : (
                              <><FileText className="w-3 h-3" /> Transcrever áudio</>
                            )}
                          </button>
                        )}
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

                const isFailed = message.status === 'failed';

                return (
                  <div key={message.id} className={`flex ${isFromLead ? 'justify-start' : 'justify-end'} mb-2`}>
                    <div className={`max-w-[80%] px-4 py-3 rounded-2xl shadow-sm text-sm font-medium leading-relaxed ${
                      isFromLead
                        ? 'bg-gray-100 text-gray-800 rounded-tl-none border border-gray-200/50'
                        : isFailed
                          ? 'bg-red-50 text-red-800 rounded-tr-none border border-red-200'
                          : 'bg-blue-600 text-white rounded-tr-none shadow-blue-100'
                    }`}>
                      {mediaContent}
                      {!isOnlyMedia && message.content}
                      {isFailed && message.error && (
                        <div className="flex items-start gap-1 mt-2 text-[10px] text-red-600 font-semibold">
                          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          <span>Não enviado: {message.error}</span>
                        </div>
                      )}
                      <div className={`text-[9px] mt-1.5 font-bold uppercase tracking-wider flex justify-end gap-1 ${isFromLead ? 'text-gray-400' : isFailed ? 'text-red-400' : 'text-blue-200'}`}>
                        {formatTime(message.created_at)}
                        {!isFromLead && !isFailed && message.status === 'sent' && <CheckCheck className="w-3 h-3" />}
                        {isFailed && <AlertCircle className="w-3 h-3" />}
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

      {/* Footer / Input */}
      <div className="border-t border-gray-100 p-4 bg-gray-50/50 backdrop-blur-md">
        {/* Seletor de instância — só exibe quando há múltiplas */}
        {instances.length > 1 && (
          <div className="flex items-center gap-2 mb-3 overflow-x-auto max-w-4xl mx-auto">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap flex-shrink-0">
              Enviar via:
            </span>
            {instances.map((inst) => {
              const isSelected = selectedInstance === inst.instance_id;
              const isUaz = inst.provider === 'uazapi';
              return (
                <button
                  key={inst.instance_id}
                  onClick={() => setSelectedInstance(inst.instance_id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all border ${
                    isSelected
                      ? isUaz
                        ? 'bg-green-600 text-white border-green-600 shadow-sm'
                        : 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <MessageCircle className="w-3 h-3 flex-shrink-0" />
                  {inst.name}
                  {inst.phone_number && (
                    <span className="opacity-70 text-[10px]">· {inst.phone_number.slice(-4)}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
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
          {/* Template button */}
          <button
            onClick={() => { setShowTemplateModal(true); loadTemplates(); }}
            disabled={sending || sendingMedia || sendingTemplate || instances.length === 0 || instances.find(i => i.instance_id === selectedInstance)?.provider === 'uazapi'}
            className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all flex-shrink-0 bg-white border border-gray-200 text-gray-400 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 shadow-sm disabled:opacity-50"
            title={instances.find(i => i.instance_id === selectedInstance)?.provider === 'uazapi' ? 'Templates não disponíveis via UazAPI' : 'Enviar template'}
          >
            <LayoutTemplate className="w-5 h-5" />
          </button>

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

            {/* Hidden file inputs — style inline para garantir clique programático funcionar */}
            <input ref={imageInputRef} type="file" accept="image/*" style={{ position: 'fixed', top: -9999, left: -9999, opacity: 0, width: 1, height: 1 }} onChange={(e) => processFileFromInput(e, 'image')} />
            <input ref={audioInputRef} type="file" accept="audio/*" style={{ position: 'fixed', top: -9999, left: -9999, opacity: 0, width: 1, height: 1 }} onChange={(e) => processFileFromInput(e, 'audio')} />
            <input ref={videoInputRef} type="file" accept="video/*" style={{ position: 'fixed', top: -9999, left: -9999, opacity: 0, width: 1, height: 1 }} onChange={(e) => processFileFromInput(e, 'video')} />
            <input ref={documentInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar" style={{ position: 'fixed', top: -9999, left: -9999, opacity: 0, width: 1, height: 1 }} onChange={(e) => processFileFromInput(e, 'document')} />

            {showMediaMenu && (
              <div className="absolute bottom-14 left-0 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 w-44 z-[70] animate-in fade-in zoom-in-95">
                <button
                  onClick={() => { imageInputRef.current?.click(); setShowMediaMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center">
                    <Image className="w-4 h-4 text-green-600" />
                  </div>
                  Imagem
                </button>
                <button
                  onClick={() => { audioInputRef.current?.click(); setShowMediaMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center">
                    <Music className="w-4 h-4 text-purple-600" />
                  </div>
                  Áudio
                </button>
                <button
                  onClick={() => { videoInputRef.current?.click(); setShowMediaMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
                    <Video className="w-4 h-4 text-red-600" />
                  </div>
                  Vídeo
                </button>
                <button
                  onClick={() => { documentInputRef.current?.click(); setShowMediaMenu(false); }}
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

          {/* Quick reply suggestions */}
          {quickReplySuggestions.length > 0 && (
            <div
              ref={quickReplyRef}
              className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 max-h-64 overflow-y-auto"
            >
              <div className="px-4 py-2 border-b border-gray-50 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Frases rápidas</span>
                <span className="text-[10px] text-gray-300">↑↓ navegar · Enter selecionar · Esc fechar</span>
              </div>
              {quickReplySuggestions.map((qr, i) => (
                <button
                  key={qr.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setNewMessage(qr.message);
                    setQuickReplySuggestions([]);
                    setQuickReplyIndex(0);
                    setTimeout(() => textareaRef.current?.focus(), 0);
                  }}
                  className={`w-full text-left px-4 py-3 transition-colors border-b border-gray-50 last:border-0 ${
                    i === quickReplyIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded mr-2">/{qr.shortcut}</span>
                  <span className="text-sm text-gray-700 line-clamp-1">{qr.message}</span>
                </button>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => {
              const val = e.target.value;
              setNewMessage(val);
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
              // Detecta /atalho no início ou após espaço/newline
              const match = val.match(/(^|\s)\/(\w*)$/);
              if (match) {
                const term = match[2].toLowerCase();
                const filtered = quickReplies.filter(qr =>
                  qr.shortcut.toLowerCase().startsWith(term)
                );
                setQuickReplySuggestions(filtered);
                setQuickReplyIndex(0);
              } else {
                setQuickReplySuggestions([]);
              }
            }}
            onKeyDown={(e) => {
              if (quickReplySuggestions.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setQuickReplyIndex(i => Math.min(i + 1, quickReplySuggestions.length - 1));
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setQuickReplyIndex(i => Math.max(i - 1, 0));
                  return;
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const selected = quickReplySuggestions[quickReplyIndex];
                  if (selected) {
                    setNewMessage(selected.message);
                    setQuickReplySuggestions([]);
                    setQuickReplyIndex(0);
                  }
                  return;
                }
                if (e.key === 'Escape') {
                  setQuickReplySuggestions([]);
                  return;
                }
              }
              if (e.key === 'Enter' && !e.shiftKey && !sending && !sendingMedia) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={mediaPreview ? 'Adicione uma legenda (opcional)...' : 'Digite / para frases rápidas...'}
            disabled={sending || sendingMedia || instances.length === 0}
            className="flex-1 px-5 py-3.5 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-50/50 resize-none text-sm font-medium transition-all shadow-sm shadow-gray-50 disabled:opacity-50"
            rows={1}
            style={{ maxHeight: '160px', overflowY: 'auto' }}
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

      {/* Template Picker Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4" onClick={() => setShowTemplateModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-black text-gray-900">Templates aprovados</h3>
                <p className="text-xs text-gray-400 mt-0.5">Selecione um template para enviar</p>
              </div>
              <button onClick={() => setShowTemplateModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 styled-scrollbar">
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-300" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <LayoutTemplate className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-bold text-sm">Nenhum template aprovado</p>
                  <p className="text-xs mt-1">Crie templates em <a href="/whatsapp-templates" className="text-blue-500 underline">Config Templates</a></p>
                </div>
              ) : templates.map(template => {
                const body = template.components.find(c => c.type === 'BODY');
                return (
                  <button
                    key={template.id}
                    onClick={() => sendTemplate(template)}
                    disabled={sendingTemplate}
                    className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all group disabled:opacity-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-900 group-hover:text-blue-700">{template.name}</p>
                        {body?.text && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{body.text}</p>
                        )}
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-green-50 text-green-600 rounded-full border border-green-100 flex-shrink-0">
                        {template.language}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
              <span>{templates.length} template{templates.length !== 1 ? 's' : ''} disponível{templates.length !== 1 ? 'is' : ''}</span>
              <a href="/whatsapp-templates" className="text-blue-500 hover:underline font-medium">Gerenciar templates →</a>
            </div>
          </div>
        </div>
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
      {(showTagSelector || showStageSelector || showAssignPopover) && (
        <div className="fixed inset-0 z-[50]" onClick={() => { setShowTagSelector(false); setShowStageSelector(false); setShowAssignPopover(false); }} />
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
