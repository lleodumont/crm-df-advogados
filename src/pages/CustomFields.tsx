import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, GripVertical, Check, X } from 'lucide-react';

interface CustomSection {
  id: string;
  name: string;
  order_index: number | null;
}

interface CustomField {
  id: string;
  section_id: string | null;
  name: string;
  type: string;
  options: string[];
  is_required: boolean | null;
  order_index: number | null;
}

export default function CustomFields() {
  const [sections, setSections] = useState<CustomSection[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newSectionName, setNewSectionName] = useState('');
  const [showNewFieldForSection, setShowNewFieldForSection] = useState<string | null>(null);
  
  // Field form
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [fieldOptions, setFieldOptions] = useState<string>('');
  const [fieldRequired, setFieldRequired] = useState(false);

  // Modal de Exclusão customizado
  const [confirmDelete, setConfirmDelete] = useState<{type: 'section' | 'field', id: string} | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: sectionsData } = await supabase.from('custom_sections').select('*').order('order_index');
    const { data: fieldsData } = await supabase.from('custom_fields').select('*').order('order_index');
    
    if (sectionsData) setSections(sectionsData as unknown as CustomSection[]);
    if (fieldsData) setFields(fieldsData as unknown as CustomField[]);
    setLoading(false);
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;

    const { data, error } = await supabase
      .from('custom_sections')
      .insert([{ name: newSectionName, order_index: sections.length }])
      .select()
      .single();

    if (!error && data) {
      setSections([...sections, data as unknown as CustomSection]);
      setNewSectionName('');
    }
  };

  const executeDeleteSection = async (id: string) => {
    setConfirmDelete(null);
    
    // Pega todos os campos dessa sessão
    const { data: fieldsToDelete } = await supabase.from('custom_fields').select('id').eq('section_id', id);
    if (fieldsToDelete && fieldsToDelete.length > 0) {
      const fieldIds = fieldsToDelete.map(f => f.id);
      // Apaga os valores preenchidos nos leads para evitar FK violation
      await supabase.from('lead_custom_values').delete().in('field_id', fieldIds);
    }

    // Deleta os campos da sessão
    const { error: fieldsError } = await supabase.from('custom_fields').delete().eq('section_id', id);
    if (fieldsError) {
      alert('Erro ao limpar campos da sessão: ' + fieldsError.message);
      return;
    }

    const { error } = await supabase.from('custom_sections').delete().eq('id', id);
    if (error) {
      alert('Erro ao apagar sessão: ' + error.message);
      return;
    }
    setSections(sections.filter(s => s.id !== id));
  };

  const handleCreateField = async (sectionId: string) => {
    if (!fieldName.trim()) return;

    const optionsArray = fieldType === 'select' ? fieldOptions.split(',').map(o => o.trim()).filter(Boolean) : [];

    const { data, error } = await supabase
      .from('custom_fields')
      .insert([{
        section_id: sectionId,
        name: fieldName,
        type: fieldType,
        options: optionsArray,
        is_required: fieldRequired,
        order_index: fields.filter(f => f.section_id === sectionId).length
      }])
      .select()
      .single();

    if (!error && data) {
      setFields([...fields, data as unknown as CustomField]);
      setShowNewFieldForSection(null);
      setFieldName('');
      setFieldType('text');
      setFieldOptions('');
      setFieldRequired(false);
    }
  };

  const executeDeleteField = async (id: string) => {
    setConfirmDelete(null);
    
    // Deleta também valores salvos nos leads para este campo pra evitar violação de FK
    const { error: valuesError } = await supabase.from('lead_custom_values').delete().eq('field_id', id);
    if (valuesError) {
       console.error('Falha ao limpar respostas preenchidas deste campo:', valuesError);
    }

    const { error } = await supabase.from('custom_fields').delete().eq('id', id);
    if (error) {
       alert('Erro ao apagar campo: ' + error.message);
       return;
    }
    setFields(fields.filter(f => f.id !== id));
  };


  if (loading) return <div className="p-8 text-center text-gray-500">Caregando construtor...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold border-b pb-4">Construtor de Campos Personalizados</h1>
        <p className="text-gray-500 mt-2">Crie abas e defina campos dinâmicos para qualificar detalhadamente seus leads.</p>
      </div>

      {/* CREATE SECTION */}
      <div className="bg-white p-6 rounded-xl shadow-sm border mb-8">
        <h2 className="font-semibold mb-4">Adicionar Nova Sessão</h2>
        <form onSubmit={handleCreateSection} className="flex gap-4">
          <input
            type="text"
            placeholder="Ex: Qualificação Financeira"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            className="flex-1 border rounded-lg px-4 py-2"
          />
          <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700">
            Criar Sessão
          </button>
        </form>
      </div>

      {/* RENDER SECTIONS */}
      <div className="space-y-6">
        {sections.map(section => (
          <div key={section.id} className="bg-gray-50 border rounded-xl overflow-hidden">
            <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <GripVertical className="w-5 h-5 text-slate-500" />
                {section.name}
              </h3>
              <button type="button" onClick={(e) => { e.preventDefault(); setConfirmDelete({ type: 'section', id: section.id }); }} className="text-red-400 hover:text-red-300">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-3 mb-6">
                {fields.filter(f => f.section_id === section.id).length === 0 && (
                  <p className="text-sm text-gray-400 italic">Nenhum campo. Adicione o primeiro abaixo.</p>
                )}
                {fields.filter(f => f.section_id === section.id).map(field => (
                  <div key={field.id} className="flex justify-between items-center bg-white p-3 border rounded-lg shadow-sm">
                    <div>
                      <span className="font-semibold text-gray-800">{field.name}</span>
                      <span className="ml-3 text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">{field.type}</span>
                      {field.is_required && <span className="ml-2 text-xs text-red-500 font-medium">*Obrigatório</span>}
                    </div>
                    <button type="button" onClick={(e) => { e.preventDefault(); setConfirmDelete({ type: 'field', id: field.id }); }} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* NEW FIELD FORM */}
              {showNewFieldForSection === section.id ? (
                <div className="bg-white border rounded-lg p-5">
                  <h4 className="font-medium text-sm mb-3">Novo Campo para: {section.name}</h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Nome do Campo</label>
                      <input type="text" value={fieldName} onChange={e=>setFieldName(e.target.value)} className="w-full border rounded p-2" placeholder="Ex: Renda Mensal" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Tipo</label>
                      <select value={fieldType} onChange={e=>setFieldType(e.target.value)} className="w-full border rounded p-2">
                        <option value="text">Texto Livre</option>
                        <option value="number">Número</option>
                        <option value="date">Data</option>
                        <option value="select">Dropdown (Opções)</option>
                        <option value="boolean">Sim/Não</option>
                      </select>
                    </div>
                  </div>
                  
                  {fieldType === 'select' && (
                    <div className="mb-4">
                      <label className="block text-xs font-semibold mb-1">Opções (separadas por vírgula)</label>
                      <input type="text" value={fieldOptions} onChange={e=>setFieldOptions(e.target.value)} className="w-full border rounded p-2" placeholder="Alta, Média, Baixa" />
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-4">
                    <input type="checkbox" id="req" checked={fieldRequired} onChange={e=>setFieldRequired(e.target.checked)} />
                    <label htmlFor="req" className="text-sm font-medium">Tornar preenchimento obrigatório</label>
                  </div>

                  <div className="flex gap-2">
                    <button type="button" onClick={(e) => { e.preventDefault(); handleCreateField(section.id); }} className="bg-indigo-600 text-white px-4 py-2 rounded font-medium text-sm flex items-center gap-1">
                      <Check className="w-4 h-4"/> Salvar Campo
                    </button>
                    <button type="button" onClick={(e) => { e.preventDefault(); setShowNewFieldForSection(null); }} className="bg-gray-100 text-gray-700 px-4 py-2 rounded font-medium text-sm flex items-center gap-1">
                      <X className="w-4 h-4"/> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowNewFieldForSection(section.id);
                    setFieldName('');
                    setFieldType('text');
                  }} 
                  className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                >
                  <Plus className="w-4 h-4" /> Adicionar Campo
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Tem certeza?</h3>
            <p className="text-gray-600 mb-6 text-sm">
              {confirmDelete.type === 'section' 
                ? 'Isso apagará a sessão inteira e todos os campos contidos nela. Dados salvos nos leads dessa seção serão perdidos permanentemente.'
                : 'Isso apagará este campo. Os dados que os leads já tiverem preenchidos nele também sumirão.'}
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-5 py-2 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => confirmDelete.type === 'section' ? executeDeleteSection(confirmDelete.id) : executeDeleteField(confirmDelete.id)}
                className="px-5 py-2 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 shadow-sm"
              >
                Sim, Apagar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
