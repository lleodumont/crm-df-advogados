import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Zap, Plus, Trash2, ChevronDown, ChevronUp, Play, ToggleLeft, ToggleRight, X, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AutomationStep {
  id?: string;
  step_order: number;
  template_name: string;
  template_language: string;
  message_body: string;
  delay_minutes: number;
}

interface AutomationFlow {
  id: string;
  name: string;
  trigger_type: string;
  is_active: boolean;
  instance_id: string | null;
  created_at: string;
  automation_steps: AutomationStep[];
}

interface WhatsAppInstance {
  id: string;
  name: string;
  phone_number: string | null;
}

interface ExecutionRow {
  id: string;
  status: string;
  scheduled_at: string;
  executed_at: string | null;
  error: string | null;
  leads: { full_name: string; phone: string } | null;
  automation_steps: { template_name: string; step_order: number } | null;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AutomationFlows() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';

  const [flows, setFlows] = useState<AutomationFlow[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFlow, setEditingFlow] = useState<AutomationFlow | null>(null);
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null);
  const [executions, setExecutions] = useState<ExecutionRow[]>([]);
  const [loadingExecutions, setLoadingExecutions] = useState(false);
  const [runnerLoading, setRunnerLoading] = useState(false);

  useEffect(() => {
    fetchFlows();
    fetchInstances();
  }, []);

  async function fetchFlows() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('automation_flows')
        .select(`
          id, name, trigger_type, is_active, instance_id, created_at,
          automation_steps (id, step_order, template_name, template_language, message_body, delay_minutes)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Sort steps by order
      const sorted = (data || []).map((f: AutomationFlow) => ({
        ...f,
        automation_steps: [...(f.automation_steps || [])].sort((a, b) => a.step_order - b.step_order),
      }));
      setFlows(sorted);
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar fluxos');
    } finally {
      setLoading(false);
    }
  }

  async function fetchInstances() {
    const { data } = await supabase
      .from('whatsapp_instances')
      .select('id, name, phone_number')
      .order('name');
    setInstances(data || []);
  }

  async function fetchExecutions(flowId: string) {
    setLoadingExecutions(true);
    try {
      const { data, error } = await supabase
        .from('automation_executions')
        .select(`
          id, status, scheduled_at, executed_at, error,
          leads (full_name, phone),
          automation_steps (template_name, step_order)
        `)
        .eq('flow_id', flowId)
        .order('scheduled_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setExecutions((data || []) as ExecutionRow[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingExecutions(false);
    }
  }

  function toggleExpand(flowId: string) {
    if (expandedFlow === flowId) {
      setExpandedFlow(null);
      setExecutions([]);
    } else {
      setExpandedFlow(flowId);
      fetchExecutions(flowId);
    }
  }

  async function toggleActive(flow: AutomationFlow) {
    const { error } = await supabase
      .from('automation_flows')
      .update({ is_active: !flow.is_active })
      .eq('id', flow.id);
    if (error) { alert('Erro ao atualizar fluxo'); return; }
    setFlows((prev) => prev.map((f) => f.id === flow.id ? { ...f, is_active: !f.is_active } : f));
  }

  async function deleteFlow(flow: AutomationFlow) {
    if (!confirm(`Excluir o fluxo "${flow.name}"? Todas as execuções pendentes serão canceladas.`)) return;
    const { error } = await supabase.from('automation_flows').delete().eq('id', flow.id);
    if (error) { alert('Erro ao excluir fluxo'); return; }
    setFlows((prev) => prev.filter((f) => f.id !== flow.id));
    if (expandedFlow === flow.id) setExpandedFlow(null);
  }

  async function runNow() {
    setRunnerLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/automation-runner`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao executar runner');
      alert(`Runner executado: ${json.sent} enviados, ${json.failed} falhou(aram)`);
      // Refresh executions if one is open
      if (expandedFlow) fetchExecutions(expandedFlow);
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunnerLoading(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Zap className="w-6 h-6 text-amber-500" />
              Automações WhatsApp
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Configure sequências automáticas de templates enviadas quando um novo lead chega.
            </p>
          </div>
          <div className="flex gap-3">
            {isAdmin && (
              <button
                onClick={runNow}
                disabled={runnerLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {runnerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Executar agora
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => { setEditingFlow(null); setShowForm(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Novo fluxo
              </button>
            )}
          </div>
        </div>

        {/* Info box */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
          <strong>Como funciona:</strong> Quando um novo lead chega pelo formulário do Meta, o CRM agenda
          automaticamente o envio dos templates configurados em cada fluxo ativo, respeitando os atrasos definidos.
          O runner verifica e envia mensagens pendentes — configure o pg_cron ou use "Executar agora" para testes.
        </div>

        {/* Flow list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : flows.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Zap className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhum fluxo configurado</p>
            <p className="text-sm mt-1">Crie seu primeiro fluxo de automação.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {flows.map((flow) => (
              <div key={flow.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                {/* Flow header */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 truncate">{flow.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${flow.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {flow.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Gatilho: <span className="font-medium">Novo lead do formulário Meta</span>
                      {' · '}
                      {flow.automation_steps.length} passo{flow.automation_steps.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => toggleActive(flow)}
                          className="text-gray-400 hover:text-gray-700 transition-colors"
                          title={flow.is_active ? 'Desativar' : 'Ativar'}
                        >
                          {flow.is_active
                            ? <ToggleRight className="w-6 h-6 text-green-500" />
                            : <ToggleLeft className="w-6 h-6" />}
                        </button>
                        <button
                          onClick={() => { setEditingFlow(flow); setShowForm(true); }}
                          className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => deleteFlow(flow)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => toggleExpand(flow.id)}
                      className="text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      {expandedFlow === flow.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Steps preview */}
                <div className="px-5 pb-4 flex flex-wrap gap-2">
                  {flow.automation_steps.map((step, idx) => (
                    <div key={step.id ?? idx} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">
                        {step.step_order}
                      </span>
                      <span className="font-mono text-gray-700">{step.template_name}</span>
                      {step.delay_minutes > 0 && (
                        <span className="text-gray-400 flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {step.delay_minutes >= 60
                            ? `${Math.round(step.delay_minutes / 60)}h`
                            : `${step.delay_minutes}min`}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Expanded executions */}
                {expandedFlow === flow.id && (
                  <div className="border-t border-gray-100 px-5 py-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Execuções recentes</h3>
                    {loadingExecutions ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      </div>
                    ) : executions.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">Nenhuma execução registrada ainda.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500 border-b border-gray-100">
                              <th className="pb-2 font-medium">Lead</th>
                              <th className="pb-2 font-medium">Template</th>
                              <th className="pb-2 font-medium">Agendado</th>
                              <th className="pb-2 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {executions.map((ex) => (
                              <tr key={ex.id} className="hover:bg-gray-50">
                                <td className="py-2 pr-4">
                                  <div className="font-medium text-gray-800">{ex.leads?.full_name ?? '—'}</div>
                                  <div className="text-gray-400 text-xs">{ex.leads?.phone ?? ''}</div>
                                </td>
                                <td className="py-2 pr-4 font-mono text-gray-600">
                                  {ex.automation_steps?.template_name ?? '—'}
                                </td>
                                <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">
                                  {new Date(ex.scheduled_at).toLocaleString('pt-BR')}
                                </td>
                                <td className="py-2">
                                  <ExecutionStatus status={ex.status} error={ex.error} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <FlowFormModal
          flow={editingFlow}
          instances={instances}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchFlows(); }}
        />
      )}
    </Layout>
  );
}

// ─── ExecutionStatus badge ────────────────────────────────────────────────────

function ExecutionStatus({ status, error }: { status: string; error: string | null }) {
  if (status === 'sent') return (
    <span className="flex items-center gap-1 text-green-600">
      <CheckCircle className="w-3.5 h-3.5" /> Enviado
    </span>
  );
  if (status === 'failed') return (
    <span className="flex items-center gap-1 text-red-500" title={error ?? ''}>
      <XCircle className="w-3.5 h-3.5" /> Falhou
    </span>
  );
  if (status === 'cancelled') return (
    <span className="flex items-center gap-1 text-gray-400">
      <X className="w-3.5 h-3.5" /> Cancelado
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-amber-500">
      <Clock className="w-3.5 h-3.5" /> Pendente
    </span>
  );
}

// ─── Flow Form Modal ──────────────────────────────────────────────────────────

interface FlowFormModalProps {
  flow: AutomationFlow | null;
  instances: WhatsAppInstance[];
  onClose: () => void;
  onSaved: () => void;
}

function FlowFormModal({ flow, instances, onClose, onSaved }: FlowFormModalProps) {
  const [name, setName] = useState(flow?.name ?? '');
  const [instanceId, setInstanceId] = useState(flow?.instance_id ?? (instances[0]?.id ?? ''));
  const [steps, setSteps] = useState<AutomationStep[]>(
    flow?.automation_steps.length
      ? flow.automation_steps.map((s) => ({ ...s }))
      : [{ step_order: 1, template_name: '', template_language: 'pt_BR', message_body: '', delay_minutes: 1 }]
  );
  const [saving, setSaving] = useState(false);

  function addStep() {
    setSteps((prev) => [
      ...prev,
      {
        step_order: prev.length + 1,
        template_name: '',
        template_language: 'pt_BR',
        message_body: '',
        delay_minutes: 1,
      },
    ]);
  }

  function removeStep(idx: number) {
    setSteps((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, step_order: i + 1 }))
    );
  }

  function updateStep(idx: number, field: keyof AutomationStep, value: string | number) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  }

  async function save() {
    if (!name.trim()) { alert('Nome do fluxo é obrigatório'); return; }
    if (steps.some((s) => !s.template_name.trim())) { alert('Todos os passos precisam de um nome de template'); return; }

    setSaving(true);
    try {
      if (flow) {
        // Update flow
        const { error: flowError } = await supabase
          .from('automation_flows')
          .update({ name: name.trim(), instance_id: instanceId || null })
          .eq('id', flow.id);
        if (flowError) throw flowError;

        // Delete existing steps and re-insert
        await supabase.from('automation_steps').delete().eq('flow_id', flow.id);
        const { error: stepsError } = await supabase.from('automation_steps').insert(
          steps.map((s) => ({
            flow_id: flow.id,
            step_order: s.step_order,
            template_name: s.template_name.trim(),
            template_language: s.template_language || 'pt_BR',
            message_body: s.message_body.trim(),
            delay_minutes: Number(s.delay_minutes),
          }))
        );
        if (stepsError) throw stepsError;
      } else {
        // Create new flow
        const { data: newFlow, error: flowError } = await supabase
          .from('automation_flows')
          .insert({
            name: name.trim(),
            trigger_type: 'new_lead',
            is_active: true,
            instance_id: instanceId || null,
          })
          .select()
          .single();
        if (flowError) throw flowError;

        const { error: stepsError } = await supabase.from('automation_steps').insert(
          steps.map((s) => ({
            flow_id: newFlow.id,
            step_order: s.step_order,
            template_name: s.template_name.trim(),
            template_language: s.template_language || 'pt_BR',
            message_body: s.message_body.trim(),
            delay_minutes: Number(s.delay_minutes),
          }))
        );
        if (stepsError) throw stepsError;
      }

      onSaved();
    } catch (err) {
      console.error(err);
      alert(`Erro ao salvar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {flow ? 'Editar fluxo' : 'Novo fluxo de automação'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do fluxo</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Boas-vindas novo lead"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Trigger (fixed for now) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gatilho</label>
            <div className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-600">
              Novo lead recebido pelo formulário do Meta
            </div>
          </div>

          {/* WhatsApp instance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instância WhatsApp</label>
            <select
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}{inst.phone_number ? ` (${inst.phone_number})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">Passos da sequência</label>
              <button
                onClick={addStep}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
              >
                <Plus className="w-4 h-4" /> Adicionar passo
              </button>
            </div>

            <div className="space-y-4">
              {steps.map((step, idx) => (
                <div key={idx} className="border border-gray-200 rounded-xl p-4 space-y-3 relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-600">Passo {step.step_order}</span>
                    {steps.length > 1 && (
                      <button
                        onClick={() => removeStep(idx)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Delay */}
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-600">Aguardar</span>
                    <input
                      type="number"
                      min={0}
                      value={step.delay_minutes}
                      onChange={(e) => updateStep(idx, 'delay_minutes', Number(e.target.value))}
                      className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">minutos antes de enviar</span>
                  </div>
                  {idx === 0 && (
                    <p className="text-xs text-gray-400 pl-6">
                      Tempo após o lead ser criado. Use 0 para enviar imediatamente.
                    </p>
                  )}
                  {idx > 0 && (
                    <p className="text-xs text-gray-400 pl-6">
                      Tempo após o passo anterior.
                    </p>
                  )}

                  {/* Template name */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nome do template (Meta)</label>
                    <input
                      value={step.template_name}
                      onChange={(e) => updateStep(idx, 'template_name', e.target.value)}
                      placeholder="Ex: df_abertura_01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Deve ser exatamente igual ao nome aprovado no Meta Business Manager.
                    </p>
                  </div>

                  {/* Message body */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Texto do template <span className="text-gray-400">(exibido no chat)</span>
                    </label>
                    <textarea
                      value={step.message_body}
                      onChange={(e) => updateStep(idx, 'message_body', e.target.value)}
                      placeholder="Cole aqui o texto do template para que apareça corretamente no histórico de conversa..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {flow ? 'Salvar alterações' : 'Criar fluxo'}
          </button>
        </div>
      </div>
    </div>
  );
}
