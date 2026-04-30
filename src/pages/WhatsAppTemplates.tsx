import { useState, useEffect } from 'react';
import { LayoutTemplate, Plus, Trash2, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { notify } from '../lib/toast';

interface TemplateComponent {
  type: string;
  text?: string;
  buttons?: { type: string; text: string; url?: string; phone_number?: string }[];
}

interface Template {
  id: string;
  name: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED';
  category: string;
  language: string;
  components: TemplateComponent[];
  rejected_reason?: string;
  quality_score?: { score: string };
}

const STATUS_CONFIG = {
  APPROVED: { label: 'Aprovado', color: 'text-green-600 bg-green-50 border-green-100', icon: CheckCircle },
  PENDING: { label: 'Pendente', color: 'text-amber-600 bg-amber-50 border-amber-100', icon: Clock },
  REJECTED: { label: 'Rejeitado', color: 'text-red-600 bg-red-50 border-red-100', icon: XCircle },
  PAUSED: { label: 'Pausado', color: 'text-gray-600 bg-gray-50 border-gray-100', icon: AlertCircle },
  DISABLED: { label: 'Desativado', color: 'text-gray-600 bg-gray-50 border-gray-100', icon: AlertCircle },
};

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
const LANGUAGES = [
  { code: 'pt_BR', label: 'Português (BR)' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'es', label: 'Español' },
];

export default function WhatsAppTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    name: '',
    category: 'UTILITY',
    language: 'pt_BR',
    body: '',
    footer: '',
    header: '',
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    };
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates`, { headers });
      let data: any = {};
      try { data = await res.json(); } catch { /* response não é JSON */ }
      if (!res.ok) {
        const msg = data.error || data.message || `Erro HTTP ${res.status}`;
        if (msg.includes('WABA') || msg.includes('não configurado')) {
          setConfigError(msg);
        } else {
          notify.error(msg);
        }
        return;
      }
      setConfigError('');
      setTemplates(data.templates || []);
    } catch (error) {
      notify.error('Erro ao conectar: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async () => {
    if (!form.name.trim() || !form.body.trim()) {
      notify.error('Nome e corpo do template são obrigatórios');
      return;
    }

    const nameClean = form.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!nameClean) {
      notify.error('Nome inválido — use apenas letras, números e underscores');
      return;
    }

    const components: TemplateComponent[] = [];
    if (form.header.trim()) {
      components.push({ type: 'HEADER', text: form.header.trim() } as any);
    }
    components.push({ type: 'BODY', text: form.body.trim() });
    if (form.footer.trim()) {
      components.push({ type: 'FOOTER', text: form.footer.trim() } as any);
    }

    setCreating(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameClean,
          category: form.category,
          language: form.language,
          components,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar template');
      notify.success('Template enviado para aprovação da Meta');
      setShowCreateModal(false);
      setForm({ name: '', category: 'UTILITY', language: 'pt_BR', body: '', footer: '', header: '' });
      loadTemplates();
    } catch (error) {
      notify.error((error as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const deleteTemplate = async (name: string) => {
    if (!confirm(`Excluir o template "${name}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(name);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates`, {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir template');
      notify.success('Template excluído');
      setTemplates(prev => prev.filter(t => t.name !== name));
    } catch (error) {
      notify.error((error as Error).message);
    } finally {
      setDeleting(null);
    }
  };

  const groupedTemplates = {
    APPROVED: templates.filter(t => t.status === 'APPROVED'),
    PENDING: templates.filter(t => t.status === 'PENDING'),
    REJECTED: templates.filter(t => t.status === 'REJECTED'),
    other: templates.filter(t => !['APPROVED', 'PENDING', 'REJECTED'].includes(t.status)),
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Templates WhatsApp</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie os templates de mensagem da Meta Business API</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadTemplates}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
          >
            <Plus className="w-4 h-4" />
            Novo template
          </button>
        </div>
      </div>

      {configError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-700 text-sm">{configError}</p>
              <p className="text-red-600 text-xs mt-1">
                Acesse{' '}
                <a href="/whatsapp-settings" className="underline font-bold">Config WhatsApp</a>
                {' '}e preencha o campo <strong>WABA ID</strong> (WhatsApp Business Account ID) na instância.
              </p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-300" />
        </div>
      ) : configError ? null : templates.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-gray-100">
          <LayoutTemplate className="w-16 h-16 mx-auto text-gray-200 mb-4" />
          <h3 className="text-lg font-black text-gray-400">Nenhum template encontrado</h3>
          <p className="text-sm text-gray-400 mt-1 mb-6">Crie seu primeiro template para enviar mensagens fora da janela de 24h</p>
          <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> Criar template
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {(['APPROVED', 'PENDING', 'REJECTED', 'other'] as const).map(group => {
            const list = groupedTemplates[group];
            if (list.length === 0) return null;
            const groupLabel = group === 'other' ? 'Outros' : STATUS_CONFIG[group]?.label || group;
            return (
              <div key={group}>
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">{groupLabel} ({list.length})</h2>
                <div className="space-y-3">
                  {list.map(template => {
                    const cfg = STATUS_CONFIG[template.status] || STATUS_CONFIG.PAUSED;
                    const StatusIcon = cfg.icon;
                    const body = template.components.find(c => c.type === 'BODY');
                    const header = template.components.find(c => c.type === 'HEADER');
                    const footer = template.components.find(c => c.type === 'FOOTER');

                    return (
                      <div key={template.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span className="font-black text-gray-900 text-sm">{template.name}</span>
                              <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${cfg.color}`}>
                                <StatusIcon className="w-3 h-3" />
                                {cfg.label}
                              </span>
                              <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">{template.category}</span>
                              <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">{template.language}</span>
                            </div>

                            {/* Preview */}
                            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-700 space-y-1 border border-gray-100">
                              {header?.text && (
                                <p className="font-black text-gray-800">{header.text}</p>
                              )}
                              {body?.text && (
                                <p className="whitespace-pre-wrap">{body.text}</p>
                              )}
                              {footer?.text && (
                                <p className="text-gray-400 text-[10px]">{footer.text}</p>
                              )}
                            </div>

                            {template.status === 'REJECTED' && template.rejected_reason && (
                              <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                <span>Motivo: {template.rejected_reason}</span>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => deleteTemplate(template.name)}
                            disabled={deleting === template.name}
                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50 flex-shrink-0"
                            title="Excluir template"
                          >
                            {deleting === template.name ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-black text-gray-900">Criar novo template</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4 styled-scrollbar">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                Templates são revisados pela Meta e podem levar até 24h para aprovação. Use variáveis com {'{{1}}'}, {'{{2}}'}, etc.
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">Nome *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="ex: boas_vindas ou lembrete_consulta"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <p className="text-[10px] text-gray-400 mt-1">Apenas letras minúsculas, números e underscores</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">Categoria *</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">Idioma *</label>
                  <select
                    value={form.language}
                    onChange={e => setForm(p => ({ ...p, language: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">Cabeçalho (opcional)</label>
                <input
                  type="text"
                  value={form.header}
                  onChange={e => setForm(p => ({ ...p, header: e.target.value }))}
                  placeholder="Texto do cabeçalho"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">Corpo *</label>
                <textarea
                  value={form.body}
                  onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                  placeholder={'Olá, {{1}}! Gostaríamos de informar sobre {{2}}.'}
                  rows={5}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
                />
                <p className="text-[10px] text-gray-400 mt-1">Use {'{{1}}'}, {'{{2}}'} para variáveis dinâmicas</p>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">Rodapé (opcional)</label>
                <input
                  type="text"
                  value={form.footer}
                  onChange={e => setForm(p => ({ ...p, footer: e.target.value }))}
                  placeholder="ex: DF Advogados — Não responda este número"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={createTemplate}
                disabled={creating}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Enviar para aprovação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
