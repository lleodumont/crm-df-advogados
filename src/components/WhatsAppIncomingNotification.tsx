import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MessageCircle, X, ChevronRight } from 'lucide-react';

interface IncomingNotification {
  id: string;
  leadId: string;
  leadName: string;
  message: string;
  messageType: string;
  timestamp: number;
}

export default function WhatsAppIncomingNotification() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<IncomingNotification[]>([]);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = (id: string) => {
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const openConversation = (leadId: string, notifId: string) => {
    dismiss(notifId);
    window.location.href = `/whatsapp-conversations?lead=${leadId}`;
  };

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel('global_whatsapp_incoming')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
        },
        async (payload: any) => {
          const msg = payload.new;

          // Só mensagens recebidas
          if (msg.direction !== 'inbound') return;

          // Se já está na conversa deste lead, não notifica
          const currentPath = window.location.pathname + window.location.search;
          if (currentPath.includes(`lead=${msg.lead_id}`)) return;

          if (!msg.lead_id) return;

          // Busca o lead para verificar se está atribuído ao usuário logado
          const { data: lead } = await supabase
            .from('leads')
            .select('full_name, assigned_to')
            .eq('id', msg.lead_id)
            .single();

          if (!lead) return;

          // Só notifica se o lead está atribuído a este usuário
          // Admins recebem sempre
          const isAssigned = (lead as any).assigned_to === profile.id;
          const isAdmin = profile.role === 'admin';
          if (!isAssigned && !isAdmin) return;

          const notifId = msg.id || `${Date.now()}-${Math.random()}`;

          const preview =
            msg.message_type === 'audio' ? '🎵 Áudio'
            : msg.message_type === 'image' ? '📷 Imagem'
            : msg.message_type === 'video' ? '🎥 Vídeo'
            : msg.message_type === 'document' ? '📄 Documento'
            : msg.content?.slice(0, 80) || 'Nova mensagem';

          const notif: IncomingNotification = {
            id: notifId,
            leadId: msg.lead_id,
            leadName: (lead as any).full_name || 'Lead',
            message: preview,
            messageType: msg.message_type || 'text',
            timestamp: Date.now(),
          };

          setNotifications(prev => [notif, ...prev].slice(0, 5));

          // Auto-dismiss após 8 segundos
          timersRef.current[notifId] = setTimeout(() => dismiss(notifId), 8000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, [profile?.id, profile?.role]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-80">
      {notifications.map((notif) => {
        const initials = notif.leadName
          .split(' ')
          .map(n => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();

        return (
          <div
            key={notif.id}
            className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in slide-in-from-right-4 fade-in duration-300"
          >
            {/* Barra verde no topo */}
            <div className="h-1 bg-green-500" />

            <div className="p-3.5 flex items-start gap-3">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {initials}
              </div>

              {/* Conteúdo */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wide">
                      Nova mensagem
                    </span>
                  </div>
                  <button
                    onClick={() => dismiss(notif.id)}
                    className="p-0.5 rounded-full hover:bg-gray-100 text-gray-400 flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-sm font-semibold text-gray-900 truncate">{notif.leadName}</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{notif.message}</p>
              </div>
            </div>

            <button
              onClick={() => openConversation(notif.leadId, notif.id)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 bg-gray-50 hover:bg-green-50 transition-colors border-t border-gray-100 text-xs font-semibold text-gray-600 hover:text-green-700"
            >
              <span>Ver conversa</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
