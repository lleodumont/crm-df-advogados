import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Layers } from 'lucide-react';

interface CustomFieldsViewerProps {
  leadId: string;
}

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

export default function CustomFieldsViewer({ leadId }: CustomFieldsViewerProps) {
  const [sections, setSections] = useState<CustomSection[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStructureAndValues();
  }, [leadId]);

  const fetchStructureAndValues = async () => {
    setLoading(true);
    
    // Fetch schema
    const { data: sectionsData } = await supabase.from('custom_sections').select('*').order('order_index');
    const { data: fieldsData } = await supabase.from('custom_fields').select('*').order('order_index');
    
    // Fetch values for this lead
    const { data: valuesData } = await supabase
      .from('lead_custom_values')
      .select('field_id, value')
      .eq('lead_id', leadId);

    if (sectionsData) setSections(sectionsData as unknown as CustomSection[]);
    if (fieldsData) setFields(fieldsData as unknown as CustomField[]);
    
    if (valuesData) {
      const valMap: Record<string, string> = {};
      valuesData.forEach(v => { if (v.field_id) valMap[v.field_id] = v.value ?? ''; });
      setValues(valMap);
    }
    setLoading(false);
  };

  const handleValueChange = (fieldId: string, newValue: string) => {
    setValues(prev => ({ ...prev, [fieldId]: newValue }));
  };

  const handleBlur = async (fieldId: string) => {
    const val = values[fieldId];
    
    // Upsert the value
    const { error } = await supabase
      .from('lead_custom_values')
      .upsert({
        lead_id: leadId,
        field_id: fieldId,
        value: val ?? null
      }, { onConflict: 'lead_id, field_id' });
      
    if (error) {
      console.error('Error saving field:', error);
    }
  };

  if (loading) return <div className="animate-pulse flex space-x-4"><div className="flex-1 space-y-4 py-1"><div className="h-4 bg-gray-200 rounded w-3/4"></div></div></div>;

  if (sections.length === 0) return null;

  return (
    <div className="space-y-6">
      {sections.map(section => {
        const sectionFields = fields.filter(f => f.section_id === section.id);
        if (sectionFields.length === 0) return null;

        return (
          <div key={section.id} className="bg-white rounded-[1.5rem] border border-gray-200 overflow-hidden shadow-sm">
            <div className="bg-gray-50 border-b border-gray-100 px-6 py-4">
              <h4 className="flex items-center gap-2 text-sm font-black text-gray-700 uppercase tracking-widest">
                <Layers className="w-4 h-4 text-indigo-500" />
                {section.name}
              </h4>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 bg-white">
              {sectionFields.map(field => {
                const val = values[field.id] || '';

                return (
                  <div key={field.id} className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wide flex justify-between">
                      {field.name}
                      {field.is_required && <span className="text-red-400">*</span>}
                    </label>

                    {field.type === 'select' ? (
                      <select
                        value={val}
                        onChange={(e) => handleValueChange(field.id, e.target.value)}
                        onBlur={() => handleBlur(field.id)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="">Não informado</option>
                        {field.options?.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'boolean' ? (
                      <select
                        value={val}
                        onChange={(e) => handleValueChange(field.id, e.target.value)}
                        onBlur={() => handleBlur(field.id)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="">Não informado</option>
                        <option value="Sim">Sim</option>
                        <option value="Não">Não</option>
                      </select>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                        value={val}
                        onChange={(e) => handleValueChange(field.id, e.target.value)}
                        onBlur={() => handleBlur(field.id)}
                        placeholder="Digite o valor..."
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
