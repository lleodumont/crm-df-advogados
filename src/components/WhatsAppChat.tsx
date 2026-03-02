import React, { useState, useEffect, useRef } from 'react';
import { Send, Phone, RefreshCw, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

interface WhatsAppInstance {
  id: string;
  name: string;
  instance_id: string;
  status: string;
  phone_number: string | null;
}

interface Props {
  leadId: string;
  leadPhone: string;
  leadName: string;
}

export default function WhatsAppChat({ leadId, leadPhone, leadName }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadInstances();
    loadMessages();

    const channel = supabase
      .channel('whatsapp_messages_changes')
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        setSelectedInstance(data[0].instance_id);
      }
    } catch (error) {
      console.error('Error loading instances:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const cleanPhone = leadPhone.replace(/\D/g, '');
      const phoneVariations = [
        cleanPhone,
        cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`,
        cleanPhone.startsWith('55') ? cleanPhone.substring(2) : cleanPhone,
      ];

      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .or(`phone_number.in.(${phoneVariations.join(',')}),lead_id.eq.${leadId}`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedInstance) return;

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-send`;
      console.log('Sending message to:', apiUrl);
      console.log('Payload:', {
        instanceId: selectedInstance,
        phoneNumber: leadPhone,
        message: newMessage,
        leadId: leadId,
      });

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
          message: newMessage,
          leadId: leadId,
        }),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        try {
          const error = JSON.parse(errorText);
          throw new Error(error.error || 'Failed to send message');
        } catch (e) {
          throw new Error(`Failed to send message: ${errorText}`);
        }
      }

      setNewMessage('');
      loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Erro ao enviar mensagem: ' + (error as Error).message);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    } else {
      return date.toLocaleDateString('pt-BR');
    }
  };

  const groupMessagesByDate = () => {
    const grouped: { [key: string]: Message[] } = {};
    messages.forEach((message) => {
      const date = new Date(message.created_at).toDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(message);
    });
    return grouped;
  };

  if (instances.length === 0 && !loading) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <MessageCircle className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Nenhuma instância do WhatsApp conectada
        </h3>
        <p className="text-gray-600 mb-4">
          Configure uma instância do WhatsApp para começar a conversar com leads
        </p>
        <a
          href="/whatsapp-settings"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          Configurar WhatsApp
        </a>
      </div>
    );
  }

  const groupedMessages = groupMessagesByDate();

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col" style={{ height: '600px' }}>
      <div className="bg-green-600 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <Phone className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="font-semibold">{leadName}</div>
            <div className="text-xs text-green-100">{leadPhone}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {instances.length > 1 && (
            <select
              value={selectedInstance}
              onChange={(e) => setSelectedInstance(e.target.value)}
              className="px-3 py-1 text-sm bg-green-700 text-white rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-white"
            >
              {instances.map((instance) => (
                <option key={instance.id} value={instance.instance_id}>
                  {instance.name} ({instance.phone_number})
                </option>
              ))}
            </select>
          )}
          <button
            onClick={loadMessages}
            className="p-2 hover:bg-green-700 rounded-full transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : Object.keys(groupedMessages).length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>Nenhuma mensagem ainda</p>
              <p className="text-sm mt-1">Envie a primeira mensagem para iniciar a conversa</p>
            </div>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              <div className="flex items-center justify-center my-4">
                <div className="bg-white px-3 py-1 rounded-full shadow-sm text-xs text-gray-600">
                  {formatDate(msgs[0].created_at)}
                </div>
              </div>
              {msgs.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'} mb-2`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.direction === 'outbound'
                        ? 'bg-green-500 text-white'
                        : 'bg-white text-gray-900 shadow-sm'
                    }`}
                  >
                    {message.media_url && (
                      <div className="mb-2">
                        {message.message_type === 'image' && (
                          <img src={message.media_url} alt="Image" className="rounded max-w-full" />
                        )}
                        {message.message_type === 'video' && (
                          <video src={message.media_url} controls className="rounded max-w-full" />
                        )}
                        {message.message_type === 'audio' && (
                          <audio src={message.media_url} controls className="w-full" />
                        )}
                        {message.message_type === 'document' && (
                          <a
                            href={message.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            Baixar documento
                          </a>
                        )}
                      </div>
                    )}
                    <div className="break-words">{message.content}</div>
                    <div
                      className={`text-xs mt-1 ${
                        message.direction === 'outbound' ? 'text-green-100' : 'text-gray-500'
                      }`}
                    >
                      {formatTime(message.created_at)}
                      {message.direction === 'outbound' && message.status === 'sent' && ' ✓'}
                      {message.direction === 'outbound' && message.status === 'delivered' && ' ✓✓'}
                      {message.direction === 'outbound' && message.status === 'read' && ' ✓✓'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !sending && sendMessage()}
            placeholder="Digite uma mensagem..."
            disabled={sending || instances.length === 0}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
          />
          <button
            onClick={sendMessage}
            disabled={sending || !newMessage.trim() || instances.length === 0}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sending ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
