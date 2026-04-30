import { useState, useEffect } from 'react';
import { Smartphone, Plus, RefreshCw, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { notify } from '../lib/toast';

interface WhatsAppInstance {
  id: string;
  name: string;
  instance_id: string;
  phone_number: string | null;
  phone_number_id: string | null;
  access_token: string | null;
  waba_id: string | null;
  api_url: string | null;
  uazapi_token: string | null;
  provider: 'meta' | 'uazapi';
  status: 'disconnected' | 'connecting' | 'connected' | 'qrcode';
  created_at: string;
}

interface UazapiInstance {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  sdr_group_id: string;
  is_active: boolean;
}

export default function WhatsAppSettings() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [providerType, setProviderType] = useState<'meta' | 'uazapi'>('meta');

  // Form Meta
  const [form, setForm] = useState({
    name: '',
    instance_id: '',
    phone_number_id: '',
    access_token: '',
    waba_id: '',
  });

  // Form UazAPI (whatsapp_instances)
  const [uazForm, setUazForm] = useState({
    name: '',
    instance_id: '',
    api_url: '',
    uazapi_token: '',
    phone_number: '',
  });

  // Seção SDR legacy (uazapi_instances separada)
  const [uazapiInstances, setUazapiInstances] = useState<UazapiInstance[]>([]);
  const [showUazapiModal, setShowUazapiModal] = useState(false);
  const [testingUazapi, setTestingUazapi] = useState(false);
  const [uazapiForm, setUazapiForm] = useState({
    name: 'Grupo SDR',
    base_url: '',
    api_key: '',
    sdr_group_id: '',
  });

  useEffect(() => {
    loadInstances();
    loadUazapiInstances();

    const channel = supabase
      .channel('whatsapp_instances_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_instances' }, () => {
        loadInstances();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadInstances = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setInstances((data || []) as unknown as WhatsAppInstance[]);
    } catch (error) {
      console.error('Error loading instances:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveMetaInstance = async () => {
    if (!form.name.trim() || !form.phone_number_id.trim() || !form.access_token.trim()) {
      notify.error('Preencha Nome, Phone Number ID e Access Token');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('whatsapp_instances')
        .insert({
          name: form.name,
          instance_id: form.instance_id || form.phone_number_id,
          phone_number_id: form.phone_number_id,
          access_token: form.access_token,
          waba_id: form.waba_id || null,
          provider: 'meta',
          status: 'connected',
          created_by: user.id,
        });

      if (error) throw error;

      notify.success('Instância Meta salva! Clique em "Verificar" para confirmar a conexão.');
      closeModal();
      loadInstances();
    } catch (error) {
      console.error('Error saving instance:', error);
      notify.error('Erro ao salvar: ' + (error as Error).message);
    }
  };

  const saveUazapiToMainTable = async () => {
    if (!uazForm.name.trim() || !uazForm.instance_id.trim() || !uazForm.api_url.trim() || !uazForm.uazapi_token.trim()) {
      notify.error('Preencha Nome, Instance ID, URL da instância e Token');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('whatsapp_instances')
        .insert({
          name: uazForm.name,
          instance_id: uazForm.instance_id,
          api_url: uazForm.api_url,
          uazapi_token: uazForm.uazapi_token,
          phone_number: uazForm.phone_number || null,
          provider: 'uazapi',
          status: 'connected',
          created_by: user.id,
        });

      if (error) throw error;

      notify.success('Instância UazAPI salva!');
      closeModal();
      loadInstances();
    } catch (error) {
      console.error('Error saving UazAPI instance:', error);
      notify.error('Erro ao salvar: ' + (error as Error).message);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setProviderType('meta');
    setForm({ name: '', instance_id: '', phone_number_id: '', access_token: '', waba_id: '' });
    setUazForm({ name: '', instance_id: '', api_url: '', uazapi_token: '', phone_number: '' });
  };

  const verifyInstance = async (instance: WhatsAppInstance) => {
    if (instance.provider === 'uazapi') {
      notify.info('Instâncias UazAPI não possuem verificação automática. Teste enviando uma mensagem.');
      return;
    }

    setVerifying(instance.id);
    try {
      const params = new URLSearchParams({
        phone_number_id: instance.phone_number_id || '',
        access_token: instance.access_token || '',
      });

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-manager?${params}`,
        { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } }
      );

      const data = await res.json();

      if (data.status === 'connected') {
        await supabase
          .from('whatsapp_instances')
          .update({ phone_number: data.phone, status: 'connected' })
          .eq('id', instance.id);
        notify.success(`✅ Conectado!\nNúmero: ${data.phone}\nNome: ${data.name}`);
      } else {
        notify.error('❌ Falha na verificação. Verifique o Phone Number ID e Access Token.');
      }

      loadInstances();
    } catch (error) {
      console.error('Error verifying:', error);
      notify.error('Erro ao verificar: ' + (error as Error).message);
    } finally {
      setVerifying(null);
    }
  };

  const deleteInstance = async (id: string) => {
    if (!confirm('Deseja excluir esta instância?')) return;
    try {
      const { error } = await supabase.from('whatsapp_instances').delete().eq('id', id);
      if (error) throw error;
      loadInstances();
    } catch (error) {
      console.error('Error deleting instance:', error);
      notify.error('Erro ao excluir instância');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const loadUazapiInstances = async () => {
    const { data, error } = await db
      .from('uazapi_instances')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setUazapiInstances((data || []) as UazapiInstance[]);
  };

  const saveUazapiInstance = async () => {
    if (!uazapiForm.base_url.trim() || !uazapiForm.api_key.trim() || !uazapiForm.sdr_group_id.trim()) {
      notify.error('Preencha URL, API Key e ID do grupo');
      return;
    }
    await db.from('uazapi_instances').update({ is_active: false }).eq('is_active', true);
    const { error } = await db.from('uazapi_instances').insert({ ...uazapiForm, is_active: true });
    if (error) { notify.error('Erro ao salvar'); return; }
    notify.success('UAZAPI configurado com sucesso');
    setShowUazapiModal(false);
    setUazapiForm({ name: 'Grupo SDR', base_url: '', api_key: '', sdr_group_id: '' });
    loadUazapiInstances();
  };

  const testUazapiConnection = async (instance: UazapiInstance) => {
    setTestingUazapi(true);
    try {
      const res = await fetch(`${instance.base_url}/instance/connectionState/${instance.sdr_group_id}`, {
        headers: { apikey: instance.api_key },
      });
      if (res.ok) {
        notify.success('UAZAPI conectado com sucesso');
      } else {
        notify.error('Falha na conexão UAZAPI');
      }
    } catch {
      notify.error('Erro ao testar conexão UAZAPI');
    } finally {
      setTestingUazapi(false);
    }
  };

  const deleteUazapiInstance = async (id: string) => {
    await db.from('uazapi_instances').delete().eq('id', id);
    loadUazapiInstances();
  };

  const getStatusIcon = (status: string) => {
    if (status === 'connected') return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (status === 'connecting') return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    return <XCircle className="w-5 h-5 text-gray-400" />;
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'connecting': return 'Verificando';
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
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp</h1>
          <p className="text-gray-600 mt-1">Gerencie os números conectados ao CRM</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
        >
          <Plus className="w-5 h-5" />
          Adicionar Conta
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {instances.map((instance) => {
          const isUazapi = instance.provider === 'uazapi';
          return (
            <div key={instance.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isUazapi ? 'bg-green-100' : 'bg-blue-100'}`}>
                    <Smartphone className={`w-6 h-6 ${isUazapi ? 'text-green-600' : 'text-blue-600'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{instance.name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isUazapi ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {isUazapi ? 'UazAPI' : 'Meta'}
                      </span>
                    </div>
                    {instance.phone_number && (
                      <p className="text-sm text-gray-600">{instance.phone_number}</p>
                    )}
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      ID: {isUazapi ? instance.instance_id : (instance.phone_number_id || instance.instance_id)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {getStatusIcon(instance.status)}
                  <span className="text-sm text-gray-600">{getStatusText(instance.status)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => verifyInstance(instance)}
                  disabled={verifying === instance.id}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-100 transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${verifying === instance.id ? 'animate-spin' : ''}`} />
                  Verificar
                </button>
                <button
                  onClick={() => deleteInstance(instance.id)}
                  className="flex items-center justify-center gap-2 bg-gray-50 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {instances.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <Smartphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">Nenhuma conta configurada</p>
          <p className="text-gray-500 text-sm mt-1">Clique em "Adicionar Conta" para começar</p>
        </div>
      )}

      {/* ── Seção SDR legacy (uazapi_instances) ─────────────────── */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">UAZAPI — Grupo SDR</h2>
            <p className="text-sm text-gray-500">Usado para notificações no grupo do SDR</p>
          </div>
          <button
            onClick={() => setShowUazapiModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
          >
            <Plus size={16} />
            Configurar UAZAPI
          </button>
        </div>

        {uazapiInstances.length === 0 ? (
          <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-lg">
            <p className="text-sm">Nenhuma instância UAZAPI configurada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {uazapiInstances.map((inst) => (
              <div key={inst.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between bg-white">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{inst.name}</span>
                    {inst.is_active && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Ativo</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{inst.base_url}</p>
                  <p className="text-xs text-gray-400">Grupo: {inst.sdr_group_id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => testUazapiConnection(inst)}
                    disabled={testingUazapi}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={testingUazapi ? 'animate-spin' : ''} />
                    Testar
                  </button>
                  <button
                    onClick={() => deleteUazapiInstance(inst.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal SDR UAZAPI ─────────────────────────────────────── */}
      {showUazapiModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Configurar UAZAPI SDR</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={uazapiForm.name}
                  onChange={(e) => setUazapiForm({ ...uazapiForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Ex: Grupo SDR"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL da Instância</label>
                <input
                  type="text"
                  value={uazapiForm.base_url}
                  onChange={(e) => setUazapiForm({ ...uazapiForm, base_url: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="https://api.uazapi.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  type="password"
                  value={uazapiForm.api_key}
                  onChange={(e) => setUazapiForm({ ...uazapiForm, api_key: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="sua-api-key"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID do Grupo SDR</label>
                <input
                  type="text"
                  value={uazapiForm.sdr_group_id}
                  onChange={(e) => setUazapiForm({ ...uazapiForm, sdr_group_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="5511999999999-1234567890@g.us"
                />
                <p className="text-xs text-gray-400 mt-1">Formato: número@g.us ou ID do grupo UAZAPI</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowUazapiModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveUazapiInstance}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Adicionar Conta (Meta ou UazAPI) ───────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Adicionar Conta WhatsApp</h2>

            {/* Toggle provedor */}
            <div className="flex rounded-lg border border-gray-200 p-1 mb-5">
              <button
                onClick={() => setProviderType('meta')}
                className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition ${
                  providerType === 'meta'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Meta Cloud API
              </button>
              <button
                onClick={() => setProviderType('uazapi')}
                className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition ${
                  providerType === 'uazapi'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                UazAPI (Não oficial)
              </button>
            </div>

            {providerType === 'meta' ? (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                  <strong>Credenciais:</strong> Meta Business Manager → WhatsApp → Configurações da API
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Atendimento DF Advogados"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number ID <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.phone_number_id}
                    onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
                    placeholder="Ex: 935170166348614"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Access Token <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    value={form.access_token}
                    onChange={(e) => setForm({ ...form, access_token: e.target.value })}
                    placeholder="EAAxxxxxxxx..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Token permanente (System User Token)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WABA ID <span className="text-gray-400 text-xs">(opcional — para templates)</span></label>
                  <input
                    type="text"
                    value={form.waba_id}
                    onChange={(e) => setForm({ ...form, waba_id: e.target.value })}
                    placeholder="Ex: 1604246810601685"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800">
                  <strong>Instance ID</strong> deve coincidir com o <strong>instanceName</strong> configurado no servidor UazAPI para que o webhook funcione.
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={uazForm.name}
                    onChange={(e) => setUazForm({ ...uazForm, name: e.target.value })}
                    placeholder="Ex: Comercial 2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instance ID <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={uazForm.instance_id}
                    onChange={(e) => setUazForm({ ...uazForm, instance_id: e.target.value })}
                    placeholder="Ex: minha-instancia"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Deve ser o mesmo instanceName do servidor UazAPI</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL da instância <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={uazForm.api_url}
                    onChange={(e) => setUazForm({ ...uazForm, api_url: e.target.value })}
                    placeholder="https://api.uazapi.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Token <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    value={uazForm.uazapi_token}
                    onChange={(e) => setUazForm({ ...uazForm, uazapi_token: e.target.value })}
                    placeholder="seu-token-uazapi"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número <span className="text-gray-400 text-xs">(opcional — apenas para exibição)</span></label>
                  <input
                    type="text"
                    value={uazForm.phone_number}
                    onChange={(e) => setUazForm({ ...uazForm, phone_number: e.target.value })}
                    placeholder="Ex: 5561999999999"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={providerType === 'meta' ? saveMetaInstance : saveUazapiToMainTable}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition ${
                  providerType === 'meta' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
