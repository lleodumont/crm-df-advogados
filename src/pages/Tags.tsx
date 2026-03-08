import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Tag, Plus, X, Edit2, Check } from 'lucide-react';

interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#64748B', '#475569', '#1E293B'
];

export default function Tags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error('Error loading tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('tags')
        .insert({
          name: newTagName.trim(),
          color: newTagColor,
          created_by: user.id
        });

      if (error) throw error;

      setNewTagName('');
      setNewTagColor(PRESET_COLORS[0]);
      setShowColorPicker(false);
      loadTags();
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  };

  const startEdit = (tag: Tag) => {
    setEditingTag(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const cancelEdit = () => {
    setEditingTag(null);
    setEditName('');
    setEditColor('');
  };

  const saveEdit = async (tagId: string) => {
    if (!editName.trim()) return;

    try {
      const { error } = await supabase
        .from('tags')
        .update({
          name: editName.trim(),
          color: editColor
        })
        .eq('id', tagId);

      if (error) throw error;

      setEditingTag(null);
      loadTags();
    } catch (error) {
      console.error('Error updating tag:', error);
    }
  };

  const deleteTag = async (tagId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta etiqueta? Ela será removida de todos os leads.')) return;

    try {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', tagId);

      if (error) throw error;
      loadTags();
    } catch (error) {
      console.error('Error deleting tag:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Etiquetas</h1>
          <p className="text-gray-600 mt-1">Gerencie as etiquetas para organizar seus leads</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-300 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Criar Nova Etiqueta</h2>
        <form onSubmit={createTag} className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Nome da etiqueta"
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
                  style={{ backgroundColor: newTagColor }}
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
                          setNewTagColor(color);
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Etiquetas Existentes</h2>
        {tags.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">Nenhuma etiqueta criada ainda</p>
            <p className="text-gray-400 text-sm mt-1">Crie sua primeira etiqueta acima</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {editingTag === tag.id ? (
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
                      onClick={() => saveEdit(tag.id)}
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
                    <div
                      className="w-8 h-8 rounded flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 font-medium text-gray-900">{tag.name}</span>
                    <button
                      onClick={() => startEdit(tag)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteTag(tag.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Excluir"
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
