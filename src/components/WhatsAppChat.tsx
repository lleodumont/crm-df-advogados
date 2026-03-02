import React, { useState, useEffect, useRef } from 'react';
import { Send, Phone, RefreshCw, MessageCircle, User, CheckCheck, Check, Folder, CheckCircle, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
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
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const uniqueMessages = data?.reduce((acc, msg) => {
        if (!acc.find(m => m.id === msg.id)) {
          acc.push(msg);
        }
        return acc;
      }, [] as Message[]) || [];

      setMessages(uniqueMessages);
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
    <div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col" style={{ height: '700px' }}>
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-lg font-bold text-blue-700">
              {leadName.split(' ').map(n => n[0]).slice(0, 2).join('')}
            </span>
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-lg">{leadName}</div>
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <Phone className="w-3 h-3" />
              {leadPhone}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-600">
            <CheckCircle className="w-5 h-5" />
          </button>
          <button className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition flex items-center gap-1.5">
            AA
          </button>
          <button className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-600">
            <Folder className="w-5 h-5" />
          </button>
          {instances.length > 1 && (
            <select
              value={selectedInstance}
              onChange={(e) => setSelectedInstance(e.target.value)}
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {instances.map((instance) => (
                <option key={instance.id} value={instance.instance_id}>
                  {instance.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={loadMessages}
            className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-600"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-600">
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white p-6 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : Object.keys(groupedMessages).length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium">Nenhuma mensagem ainda</p>
              <p className="text-sm mt-2">Envie a primeira mensagem para iniciar a conversa</p>
            </div>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              <div className="flex items-center justify-center my-6">
                <div className="bg-gray-100 px-4 py-1 rounded-full text-xs text-gray-600 font-medium">
                  {formatDate(msgs[0].created_at)}
                </div>
              </div>
              {msgs.map((message, index) => {
                const isFromLead = message.direction === 'inbound';
                const showName = isFromLead && (index === 0 || msgs[index - 1].direction !== 'inbound');
                const showAvatar = isFromLead && (index === msgs.length - 1 || msgs[index + 1]?.direction !== 'inbound');

                return (
                  <div
                    key={message.id}
                    className={`flex ${isFromLead ? 'justify-start' : 'justify-end'} mb-1 ${!showAvatar && isFromLead ? 'ml-12' : ''}`}
                  >
                    {isFromLead && showAvatar && (
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0 self-end">
                        <span className="text-sm font-bold text-blue-700">
                          {leadName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </span>
                      </div>
                    )}
                    {isFromLead && !showAvatar && <div className="w-10 mr-2 flex-shrink-0" />}
                    <div className={`flex flex-col ${isFromLead ? 'items-start' : 'items-end'} max-w-lg`}>
                      {showName && (
                        <div className="text-xs font-medium text-gray-700 mb-1 px-1">{leadName}</div>
                      )}
                      <div
                        className={`px-4 py-2 rounded-lg ${
                          isFromLead
                            ? 'bg-gray-100 text-gray-900'
                            : 'bg-blue-500 text-white'
                        } ${!showAvatar && !isFromLead ? 'rounded-br-sm' : ''} ${!showAvatar && isFromLead ? 'rounded-bl-sm' : ''}`}
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
                        <div className="break-words whitespace-pre-wrap">{message.content}</div>
                      </div>
                      <div className={`text-xs text-gray-500 mt-1 px-1 flex items-center gap-1`}>
                        {!isFromLead && profile?.full_name && <span className="font-medium">{profile.full_name.split(' ')[0]}</span>}
                        <span>{formatTime(message.created_at)}</span>
                        {!isFromLead && (
                          <span className="flex items-center">
                            {message.status === 'sent' && <Check className="w-3 h-3" />}
                            {(message.status === 'delivered' || message.status === 'read') && <CheckCheck className="w-3 h-3" />}
                          </span>
                        )}
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

      <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
        <div className="flex items-end gap-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !sending) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Shift + Enter para nova linha. &quot;/&quot; para frase rápida."
            disabled={sending || instances.length === 0}
            rows={1}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-200 resize-none"
            style={{ minHeight: '42px', maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !newMessage.trim() || instances.length === 0}
            className="p-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
            style={{ minWidth: '42px', minHeight: '42px' }}
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
