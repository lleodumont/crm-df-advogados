import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { MessageCircle, Search, User, Clock, Phone } from 'lucide-react';

interface Conversation {
  lead_id: string;
  lead_name: string;
  lead_phone: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  last_message_direction: 'inbound' | 'outbound';
}

export default function WhatsAppConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadConversations();

    const channel = supabase
      .channel('conversations_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase.rpc('get_whatsapp_conversations');

      if (error) {
        console.error('RPC error:', error);
        await loadConversationsFallback();
        return;
      }

      setConversations(data || []);
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
            phone
          )
        `)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      const conversationsMap = new Map<string, Conversation>();

      messages?.forEach((msg: any) => {
        const leadId = msg.lead_id;
        if (!leadId || conversationsMap.has(leadId)) return;

        conversationsMap.set(leadId, {
          lead_id: leadId,
          lead_name: msg.leads?.full_name || 'Desconhecido',
          lead_phone: msg.leads?.phone || msg.phone_number,
          last_message: msg.content || '',
          last_message_time: msg.created_at,
          unread_count: 0,
          last_message_direction: msg.direction,
        });
      });

      setConversations(Array.from(conversationsMap.values()));
    } catch (error) {
      console.error('Error in fallback:', error);
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
    (conv) =>
      conv.lead_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.lead_phone.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando conversas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <MessageCircle className="w-8 h-8 text-green-600" />
          Conversas WhatsApp
        </h1>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-lg font-medium">Nenhuma conversa encontrada</p>
              <p className="text-sm mt-1">
                As conversas do WhatsApp aparecerão aqui quando houver mensagens
              </p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <a
                key={conversation.lead_id}
                href={`/leads/${conversation.lead_id}`}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-green-600" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {conversation.lead_name}
                    </h3>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(conversation.last_message_time)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                    <Phone className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500">
                      {conversation.lead_phone}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600 truncate">
                      {conversation.last_message_direction === 'outbound' && (
                        <span className="text-green-600 mr-1">Você: </span>
                      )}
                      {conversation.last_message}
                    </p>
                    {conversation.unread_count > 0 && (
                      <span className="ml-2 bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                        {conversation.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
