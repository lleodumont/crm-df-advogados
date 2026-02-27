import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface MappingConfig {
  csvColumn: string;
  targetField: string;
}

export default function ImportLeads() {
  const { profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<MappingConfig[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);

  const questionKeyOptions = [
    { value: 'stage', label: 'Estágio de Decisão' },
    { value: 'timeline_start', label: 'Prazo para Começar' },
    { value: 'authority', label: 'Autonomia de Decisão' },
    { value: 'urgency_now', label: 'Urgências Atuais' },
    { value: 'risk_15d', label: 'Risco nos Próximos 15 Dias' },
    { value: 'assets_types', label: 'Tipos de Bens' },
    { value: 'assets_range', label: 'Faixa de Patrimônio' },
    { value: 'offer_fit', label: 'Fit com Oferta' },
    { value: 'family_income_range', label: 'Faixa de Renda Familiar' },
  ];

  const leadFieldOptions = [
    { value: 'full_name', label: 'Nome Completo (obrigatório)' },
    { value: 'phone', label: 'Telefone (obrigatório)' },
    { value: 'email', label: 'Email' },
    { value: 'campaign', label: 'Campanha' },
    { value: 'source', label: 'Origem' },
    { value: 'family_income_range', label: 'Faixa de Renda Familiar' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseCSV(selectedFile);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length === 0) return;

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      setHeaders(headers);

      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });

      setCsvData(data);

      const initialMappings = headers.map(header => ({
        csvColumn: header,
        targetField: '',
      }));
      setMappings(initialMappings);
    };
    reader.readAsText(file);
  };

  const updateMapping = (csvColumn: string, targetField: string) => {
    setMappings(prev =>
      prev.map(m => (m.csvColumn === csvColumn ? { ...m, targetField } : m))
    );
  };

  const importLeads = async () => {
    setImporting(true);
    setImportResult(null);

    let successCount = 0;
    let errorCount = 0;

    try {
      for (const row of csvData) {
        try {
          const leadData: any = {
            source: 'meta_form',
            owner_user_id: profile?.id,
          };

          const answers: any[] = [];

          mappings.forEach(mapping => {
            if (!mapping.targetField) return;

            const value = row[mapping.csvColumn];
            if (!value) return;

            if (leadFieldOptions.some(opt => opt.value === mapping.targetField)) {
              leadData[mapping.targetField] = value;
            } else if (questionKeyOptions.some(opt => opt.value === mapping.targetField)) {
              answers.push({
                question_key: mapping.targetField,
                answer_value: value,
                source: 'meta_form',
              });
            }
          });

          if (!leadData.full_name || !leadData.phone) {
            errorCount++;
            continue;
          }

          const { data: lead, error: leadError } = await supabase
            .from('leads')
            .insert(leadData)
            .select()
            .single();

          if (leadError) {
            console.error('Error inserting lead:', leadError);
            errorCount++;
            continue;
          }

          if (answers.length > 0) {
            const answersWithLeadId = answers.map(a => ({
              ...a,
              lead_id: lead.id,
            }));

            const { error: answersError } = await supabase
              .from('lead_answers')
              .insert(answersWithLeadId);

            if (answersError) {
              console.error('Error inserting answers:', answersError);
            }
          }

          successCount++;
        } catch (error) {
          console.error('Error processing row:', error);
          errorCount++;
        }
      }

      setImportResult({ success: successCount, errors: errorCount });
    } catch (error) {
      console.error('Import error:', error);
      alert('Erro durante a importação');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <a href="/leads" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </a>
        <h1 className="text-3xl font-bold text-gray-900">Importar Leads do Meta</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">1. Selecione o arquivo CSV</h2>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <label className="cursor-pointer">
              <span className="text-blue-600 hover:text-blue-700 font-medium">
                Selecionar arquivo CSV
              </span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {file && (
              <div className="mt-4 text-sm text-gray-600">
                Arquivo selecionado: <span className="font-medium">{file.name}</span>
              </div>
            )}
          </div>
        </div>

        {headers.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">2. Mapeie as colunas</h2>
            <p className="text-sm text-gray-600 mb-4">
              Relacione cada coluna do CSV com um campo do sistema. Nome e telefone são obrigatórios.
            </p>

            <div className="space-y-3">
              {mappings.map((mapping, index) => (
                <div key={index} className="grid grid-cols-2 gap-4 items-center">
                  <div className="text-sm font-medium text-gray-700">
                    {mapping.csvColumn}
                  </div>
                  <select
                    value={mapping.targetField}
                    onChange={(e) => updateMapping(mapping.csvColumn, e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Ignorar coluna</option>
                    <optgroup label="Campos do Lead">
                      {leadFieldOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Perguntas do Formulário">
                      {questionKeyOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {csvData.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">3. Visualizar dados</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {headers.map((header, index) => (
                      <th key={index} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {csvData.slice(0, 5).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {headers.map((header, colIndex) => (
                        <td key={colIndex} className="px-4 py-3 text-sm text-gray-700">
                          {row[header]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {csvData.length > 5 && (
                <div className="text-sm text-gray-500 text-center py-2">
                  Mostrando 5 de {csvData.length} registros
                </div>
              )}
            </div>
          </div>
        )}

        {csvData.length > 0 && (
          <div>
            <button
              onClick={importLeads}
              disabled={importing}
              className={`w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium transition-colors ${
                importing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
              }`}
            >
              {importing ? 'Importando...' : `Importar ${csvData.length} leads`}
            </button>
          </div>
        )}

        {importResult && (
          <div className="mt-6 p-4 border rounded-lg">
            {importResult.success > 0 && (
              <div className="flex items-center gap-2 text-green-700 mb-2">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">{importResult.success} leads importados com sucesso!</span>
              </div>
            )}
            {importResult.errors > 0 && (
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">{importResult.errors} erros durante a importação</span>
              </div>
            )}
            <a
              href="/leads"
              className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Ver Leads
            </a>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-blue-900 mb-2">Como funciona o scoring?</h3>
        <p className="text-sm text-blue-800 mb-4">
          Após a importação, o sistema calcula automaticamente o score de cada lead com base nas respostas do formulário:
        </p>
        <ul className="text-sm text-blue-800 space-y-2 list-disc list-inside">
          <li><strong>Pilar Decisão (0-40 pontos):</strong> Estágio, prazo e autonomia</li>
          <li><strong>Pilar Urgência (0-30 pontos):</strong> Situações de risco e urgências</li>
          <li><strong>Pilar Patrimônio (0-25 pontos):</strong> Tipos e valor dos bens</li>
          <li><strong>Pilar Fit (0-5 pontos):</strong> Alinhamento com a oferta</li>
        </ul>
        <p className="text-sm text-blue-800 mt-4">
          <strong>Classificação:</strong> 0-39 = Morno | 40-69 = Qualificado | 70-100 = Qualificado de alto valor
        </p>
      </div>
    </div>
  );
}
