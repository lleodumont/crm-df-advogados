import React, { useState, useEffect } from 'react';
import { Smartphone, Plus, Power, PowerOff, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface WhatsAppInstance {
  id: string;
  name: string;
  instance_id: string;
  phone_number: string | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'qrcode';
  qr_code: string | null;
  created_at: string;
}

export default function WhatsAppSettings() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConnectExistingModal, setShowConnectExistingModal] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [newInstanceId, setNewInstanceId] = useState('');
  const [existingInstanceName, setExistingInstanceName] = useState('');
  const [existingInstanceId, setExistingInstanceId] = useState('');
  const [existingApiUrl, setExistingApiUrl] = useState('');
  const [existingApiKey, setExistingApiKey] = useState('');
  const [selectedQR, setSelectedQR] = useState<{ instanceId: string; qrCode: string } | null>(null);

  useEffect(() => {
    loadInstances();

    const channel = supabase
      .channel('whatsapp_instances_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_instances' },
        () => {
          loadInstances();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadInstances = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInstances(data || []);
    } catch (error) {
      console.error('Error loading instances:', error);
    } finally {
      setLoading(false);
    }
  };

  const createInstance = async () => {
    if (!newInstanceName.trim() || !newInstanceId.trim()) {
      alert('Preencha todos os campos');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      console.log('Creating instance with:', {
        name: newInstanceName,
        instanceId: newInstanceId,
        url: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-manager/create`
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-manager/create`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: newInstanceName,
            instanceId: newInstanceId,
          }),
        }
      );

      console.log('Response status:', response.status);

      const responseText = await response.text();
      console.log('Response text:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response:', responseText);
        throw new Error('Invalid response from server: ' + responseText);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create instance');
      }

      alert('Instância criada com sucesso!');
      setShowCreateModal(false);
      setNewInstanceName('');
      setNewInstanceId('');
      loadInstances();
    } catch (error) {
      console.error('Error creating instance:', error);
      alert('Erro ao criar instância: ' + (error as Error).message);
    }
  };

  const connectInstance = async (instanceId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-manager/connect`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ instanceId }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to connect');

      setSelectedQR({ instanceId, qrCode: data.qrCode });

      const checkInterval = setInterval(async () => {
        const statusResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-manager/status?instanceId=${instanceId}`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );

        const statusData = await statusResponse.json();
        if (statusData.status === 'connected') {
          clearInterval(checkInterval);
          setSelectedQR(null);
          loadInstances();
        }
      }, 3000);

      setTimeout(() => clearInterval(checkInterval), 120000);
    } catch (error) {
      console.error('Error connecting instance:', error);
      alert('Erro ao conectar instância');
    }
  };

  const disconnectInstance = async (instanceId: string) => {
    if (!confirm('Deseja desconectar esta instância?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-manager/disconnect`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ instanceId }),
        }
      );

      if (!response.ok) throw new Error('Failed to disconnect');

      loadInstances();
    } catch (error) {
      console.error('Error disconnecting instance:', error);
      alert('Erro ao desconectar instância');
    }
  };

  const connectExistingInstance = async () => {
    if (!existingInstanceName.trim() || !existingInstanceId.trim() || !existingApiUrl.trim() || !existingApiKey.trim()) {
      alert('Preencha todos os campos');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('whatsapp_instances')
        .insert({
          name: existingInstanceName,
          instance_id: existingInstanceId,
          status: 'connected',
          created_by: user.id,
          token: existingApiKey,
          api_url: existingApiUrl,
        })
        .select()
        .single();

      if (error) throw error;

      alert('Instância conectada com sucesso!');
      setShowConnectExistingModal(false);
      setExistingInstanceName('');
      setExistingInstanceId('');
      setExistingApiUrl('');
      setExistingApiKey('');
      loadInstances();
    } catch (error) {
      console.error('Error connecting existing instance:', error);
      alert('Erro ao conectar instância: ' + (error as Error).message);
    }
  };

  const deleteInstance = async (id: string) => {
    if (!confirm('Deseja excluir esta instância?')) return;

    try {
      const { error } = await supabase
        .from('whatsapp_instances')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadInstances();
    } catch (error) {
      console.error('Error deleting instance:', error);
      alert('Erro ao excluir instância');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-800';
      case 'qrcode': return 'bg-yellow-100 text-yellow-800';
      case 'connecting': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'qrcode': return 'Aguardando QR Code';
      case 'connecting': return 'Conectando';
      default: return 'Desconectado';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp - Configurações</h1>
          <p className="text-gray-600 mt-1">Gerencie as conexões do WhatsApp via UazAPI</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowConnectExistingModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <Smartphone className="w-5 h-5" />
            Conectar Existente
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            <Plus className="w-5 h-5" />
            Nova Instância
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {instances.map((instance) => (
          <div key={instance.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{instance.name}</h3>
                  <p className="text-sm text-gray-600">{instance.instance_id}</p>
                  {instance.phone_number && (
                    <p className="text-sm text-gray-500 mt-1">{instance.phone_number}</p>
                  )}
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(instance.status)}`}>
                {getStatusText(instance.status)}
              </span>
            </div>

            <div className="flex gap-2">
              {instance.status === 'disconnected' && (
                <button
                  onClick={() => connectInstance(instance.instance_id)}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg hover:bg-green-100 transition"
                >
                  <Power className="w-4 h-4" />
                  Conectar
                </button>
              )}
              {instance.status === 'connected' && (
                <button
                  onClick={() => disconnectInstance(instance.instance_id)}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-700 px-4 py-2 rounded-lg hover:bg-red-100 transition"
                >
                  <PowerOff className="w-4 h-4" />
                  Desconectar
                </button>
              )}
              <button
                onClick={() => deleteInstance(instance.id)}
                className="flex items-center justify-center gap-2 bg-gray-50 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {instances.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <Smartphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">Nenhuma instância configurada</p>
          <p className="text-gray-500 text-sm mt-1">Clique em "Nova Instância" para começar</p>
        </div>
      )}

      {showConnectExistingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Conectar Instância Existente</h2>
            <p className="text-sm text-gray-600 mb-4">
              Conecte uma instância já configurada no UazAPI
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Instância
                </label>
                <input
                  type="text"
                  value={existingInstanceName}
                  onChange={(e) => setExistingInstanceName(e.target.value)}
                  placeholder="Ex: WhatsApp Principal"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instance ID
                </label>
                <input
                  type="text"
                  value={existingInstanceId}
                  onChange={(e) => setExistingInstanceId(e.target.value)}
                  placeholder="Ex: minha-instancia"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  O ID da instância configurada no UazAPI
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL da API
                </label>
                <input
                  type="text"
                  value={existingApiUrl}
                  onChange={(e) => setExistingApiUrl(e.target.value)}
                  placeholder="Ex: https://api.uazapi.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  URL base da sua instância UazAPI
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={existingApiKey}
                  onChange={(e) => setExistingApiKey(e.target.value)}
                  placeholder="Sua chave de API"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Token de autenticação da instância
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowConnectExistingModal(false);
                  setExistingInstanceName('');
                  setExistingInstanceId('');
                  setExistingApiUrl('');
                  setExistingApiKey('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={connectExistingInstance}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Conectar
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Nova Instância WhatsApp</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Instância
                </label>
                <input
                  type="text"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  placeholder="Ex: Atendimento Principal"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instance ID (UazAPI)
                </label>
                <input
                  type="text"
                  value={newInstanceId}
                  onChange={(e) => setNewInstanceId(e.target.value)}
                  placeholder="Ex: minha-instancia"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use um ID único para identificar esta instância no UazAPI
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={createInstance}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedQR && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Escanear QR Code</h2>
            <p className="text-gray-600 mb-4">
              Abra o WhatsApp no seu celular e escaneie o código abaixo
            </p>

            <div className="flex justify-center mb-4">
              <img src={selectedQR.qrCode} alt="QR Code" className="w-64 h-64" />
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-4">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Aguardando conexão...
            </div>

            <button
              onClick={() => setSelectedQR(null)}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
