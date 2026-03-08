import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Layers, Plus, X, CreditCard as Edit2, Check, ArrowUp, ArrowDown, AlertCircle } from 'lucide-react';

interface Stage {
  id: string;
  name: string;
  stage_key: string;
  color: string;
  order_index: number;
  is_default: boolean;
  created_at: string;
}

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#64748B', '#475569', '#1E293B'
];

export default function Stages() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState(PRESET_COLORS[0]);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    checkAdminStatus();
    loadStages();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      setIsAdmin(data?.role === 'admin');
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const loadStages = async () => {
    try {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;
      setStages(data || []);
    } catch (error) {
      console.error('Error loading stages:', error);
    } finally {
      setLoading(false);
    }
  };

  const createStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageName.trim() || !isAdmin) return;

    try {
      const maxOrder = stages.length > 0 ? Math.max(...stages.map(s => s.order_index)) : 0;
      const stageKey = newStageName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

      const { error } = await supabase
        .from('pipeline_stages')
        .insert({
          name: newStageName.trim(),
          stage_key: `custom_${stageKey}_${Date.now()}`,
          color: newStageColor,
          order_index: maxOrder + 1,
          is_default: false
        });

      if (error) throw error;

      setNewStageName('');
      setNewStageColor(PRESET_COLORS[0]);
      setShowColorPicker(false);
      loadStages();
    } catch (error) {
      console.error('Error creating stage:', error);
    }
  };

  const startEdit = (stage: Stage) => {
    if (!isAdmin) return;
    setEditingStage(stage.id);
    setEditName(stage.name);
    setEditColor(stage.color);
  };

  const cancelEdit = () => {
    setEditingStage(null);
    setEditName('');
    setEditColor('');
  };

  const saveEdit = async (stageId: string) => {
    if (!editName.trim() || !isAdmin) return;

    try {
      const { error } = await supabase
        .from('pipeline_stages')
        .update({
          name: editName.trim(),
          color: editColor
        })
        .eq('id', stageId);

      if (error) throw error;

      setEditingStage(null);
      loadStages();
    } catch (error) {
      console.error('Error updating stage:', error);
    }
  };

  const deleteStage = async (stageId: string, isDefault: boolean) => {
    if (!isAdmin) return;

    const message = isDefault
      ? 'ATENÇÃO: Esta é uma etapa padrão do sistema. Tem certeza que deseja excluí-la? Esta ação não pode ser desfeita e pode afetar leads existentes.'
      : 'Tem certeza que deseja excluir esta etapa? Esta ação não pode ser desfeita.';

    if (!confirm(message)) return;

    try {
      const { error } = await supabase
        .from('pipeline_stages')
        .delete()
        .eq('id', stageId);

      if (error) throw error;
      loadStages();
    } catch (error) {
      console.error('Error deleting stage:', error);
      alert('Erro ao excluir etapa. Verifique se não há leads associados a ela.');
    }
  };

  const moveStage = async (stageId: string, direction: 'up' | 'down') => {
    if (!isAdmin) return;

    const currentIndex = stages.findIndex(s => s.id === stageId);
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === stages.length - 1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newStages = [...stages];
    [newStages[currentIndex], newStages[newIndex]] = [newStages[newIndex], newStages[currentIndex]];

    try {
      const updates = newStages.map((stage, index) => ({
        id: stage.id,
        order_index: index + 1
      }));

      for (const update of updates) {
        await supabase
          .from('pipeline_stages')
          .update({ order_index: update.order_index })
          .eq('id', update.id);
      }

      loadStages();
    } catch (error) {
      console.error('Error reordering stages:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Etapas do Pipeline</h1>
          <p className="text-gray-600 mt-1">Visualize as etapas do funil de vendas</p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900">Acesso Restrito</h3>
            <p className="text-yellow-800 text-sm mt-1">
              Apenas administradores podem gerenciar as etapas do pipeline.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-300 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Etapas Atuais</h2>
          <div className="space-y-2">
            {stages.map((stage) => (
              <div
                key={stage.id}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg"
              >
                <div
                  className="w-8 h-8 rounded flex-shrink-0"
                  style={{ backgroundColor: stage.color }}
                />
                <span className="flex-1 font-medium text-gray-900">{stage.name}</span>
                {stage.is_default && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Padrão</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Etapas do Pipeline</h1>
          <p className="text-gray-600 mt-1">Gerencie as etapas do funil de vendas</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-300 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Criar Nova Etapa</h2>
        <form onSubmit={createStage} className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder="Nome da etapa"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <div
                  className="w-6 h-6 rounded"
                  style={{ backgroundColor: newStageColor }}
                />
                Cor
              </button>
              {showColorPicker && (
                <div className="absolute top-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-10 right-0">
                  <div className="grid grid-cols-5 gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          setNewStageColor(color);
                          setShowColorPicker(false);
                        }}
                        className="w-8 h-8 rounded hover:scale-110 transition-transform border-2 border-transparent hover:border-gray-400"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Criar
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg border border-gray-300 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Etapas do Pipeline</h2>
        {stages.length === 0 ? (
          <div className="text-center py-12">
            <Layers className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">Nenhuma etapa criada ainda</p>
          </div>
        ) : (
          <div className="space-y-2">
            {stages.map((stage, index) => (
              <div
                key={stage.id}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {editingStage === stage.id ? (
                  <>
                    <div
                      className="w-8 h-8 rounded flex-shrink-0 cursor-pointer"
                      style={{ backgroundColor: editColor }}
                      onClick={() => {
                        const colorIndex = PRESET_COLORS.indexOf(editColor);
                        const nextIndex = (colorIndex + 1) % PRESET_COLORS.length;
                        setEditColor(PRESET_COLORS[nextIndex]);
                      }}
                    />
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={() => saveEdit(stage.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                      title="Salvar"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                      title="Cancelar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveStage(stage.id, 'up')}
                        disabled={index === 0}
                        className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Mover para cima"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => moveStage(stage.id, 'down')}
                        disabled={index === stages.length - 1}
                        className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Mover para baixo"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                    <div
                      className="w-8 h-8 rounded flex-shrink-0"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="flex-1 font-medium text-gray-900">{stage.name}</span>
                    {stage.is_default && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Padrão</span>
                    )}
                    <button
                      onClick={() => startEdit(stage)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteStage(stage.id, stage.is_default)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title={stage.is_default ? "Excluir etapa padrão (use com cuidado)" : "Excluir"}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
