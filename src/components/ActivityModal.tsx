import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X } from 'lucide-react';
import { notify } from '../lib/toast';

interface ExistingActivity {
  id: string;
  lead_id: string;
  user_id: string;
  activity_type: string;
  priority: string;
  title: string;
  description?: string | null;
  scheduled_at: string;
  duration_minutes?: number | null;
  location?: string | null;
}

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultLeadId?: string;
  activity?: ExistingActivity | null; // quando fornecido, entra em modo de edição
}

// Converte ISO string (UTC) para valor de input datetime-local (horário local)
function toDatetimeLocalValue(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Converte valor de datetime-local (horário local) para ISO string (UTC)
function toISOString(localDateTime: string): string {
  if (!localDateTime) return localDateTime;
  return new Date(localDateTime).toISOString();
}

export default function ActivityModal({ isOpen, onClose, onSuccess, defaultLeadId, activity }: ActivityModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Array<{ id: string; full_name: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; full_name: string }>>([]);

  const isEditing = !!activity?.id;

  const [form, setForm] = useState({
    lead_id: defaultLeadId || '',
    user_id: user?.id || '',
    activity_type: 'meeting',
    priority: 'medium',
    title: '',
    description: '',
    scheduled_at: '',
    duration_minutes: '30',
    location: '',
  });

  useEffect(() => {
    if (isOpen) {
      if (activity) {
        setForm({
          lead_id: activity.lead_id,
          user_id: activity.user_id,
          activity_type: activity.activity_type,
          priority: activity.priority,
          title: activity.title,
          description: activity.description || '',
          scheduled_at: toDatetimeLocalValue(activity.scheduled_at),
          duration_minutes: activity.duration_minutes ? String(activity.duration_minutes) : '30',
          location: activity.location || '',
        });
      } else {
        setForm({
          lead_id: defaultLeadId || '',
          user_id: user?.id || '',
          activity_type: 'meeting',
          priority: 'medium',
          title: '',
          description: '',
          scheduled_at: '',
          duration_minutes: '30',
          location: '',
        });
      }
      fetchData();
    }
  }, [isOpen, activity, defaultLeadId]);

  const fetchData = async () => {
    const [leadsRes, usersRes] = await Promise.all([
      supabase.from('leads').select('id, full_name').order('full_name'),
      supabase.from('user_profiles').select('id, full_name').order('full_name')
    ]);

    if (leadsRes.data) setLeads(leadsRes.data.map(l => ({ id: l.id, full_name: l.full_name || '' })));
    if (usersRes.data) setUsers(usersRes.data.map(u => ({ id: u.id, full_name: u.full_name || '' })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lead_id || !form.user_id || !form.title || !form.scheduled_at) return;

    setLoading(true);
    const activityData = {
      lead_id: form.lead_id,
      user_id: form.user_id,
      activity_type: form.activity_type,
      priority: form.priority,
      title: form.title,
      description: form.description || null,
      scheduled_at: toISOString(form.scheduled_at),
      duration_minutes: parseInt(form.duration_minutes) || null,
      location: form.location || null,
    };

    let error;
    if (isEditing) {
      ({ error } = await supabase
        .from('scheduled_activities')
        .update(activityData)
        .eq('id', activity!.id));
    } else {
      ({ error } = await supabase
        .from('scheduled_activities')
        .insert([{ ...activityData, status: 'scheduled' }]));
    }

    setLoading(false);
    if (error) {
      console.error('Error saving activity:', error);
      notify.error('Erro ao salvar atividade: ' + error.message);
    } else {
      notify.success(isEditing ? 'Atividade atualizada!' : 'Atividade criada!');
      onSuccess();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center z-[100] md:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white md:rounded-2xl shadow-xl w-full md:max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col h-[95vh] md:h-auto md:max-h-[90vh] rounded-t-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white sticky top-0 z-10">
          <h2 className="text-xl font-bold text-gray-900">{isEditing ? 'Editar Atividade' : 'Nova Atividade'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto styled-scrollbar space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5 flex gap-1">
              Lead <span className="text-blue-500">*</span>
            </label>
            <select
              required
              disabled={!!defaultLeadId || isEditing}
              value={form.lead_id}
              onChange={(e) => setForm({ ...form, lead_id: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:opacity-60"
            >
              <option value="">Selecione um lead</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>{lead.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5 flex gap-1">
              Responsável <span className="text-blue-500">*</span>
            </label>
            <select
              required
              value={form.user_id}
              onChange={(e) => setForm({ ...form, user_id: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            >
              <option value="">Selecione um responsável</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5 flex gap-1">
                Tipo <span className="text-blue-500">*</span>
              </label>
              <select
                required
                value={form.activity_type}
                onChange={(e) => setForm({ ...form, activity_type: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              >
                <option value="meeting">Reunião</option>
                <option value="call">Ligação</option>
                <option value="task">Tarefa</option>
                <option value="email">E-mail</option>
                <option value="follow_up">Follow-up</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5 flex gap-1">
                Prioridade <span className="text-blue-500">*</span>
              </label>
              <select
                required
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5 flex gap-1">
              Título <span className="text-blue-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              placeholder="Ex: Reunião de apresentação"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5">
              Descrição
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
              rows={3}
              placeholder="Detalhes da atividade..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5 flex gap-1">
                Data e Hora <span className="text-blue-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={form.scheduled_at}
                onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5">
                Duração (minutos)
              </label>
              <input
                type="number"
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                placeholder="30"
                min="1"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5">
              Local / Link
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              placeholder="Ex: Escritório ou https://meet.google.com/..."
            />
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-gray-100 bg-white sticky bottom-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-blue-600 font-bold text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-50 disabled:opacity-50"
            >
              {loading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Atividade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
