import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Scale, Phone, Calendar, DollarSign } from 'lucide-react';

interface Lead {
  id: string;
  full_name: string;
  phone: string;
  closed_at: string | null;
  deal_value: number | null;
  owner_user_id: string | null;
}

export default function Juridico() {
  const { profile } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile && profile.role !== 'admin' && profile.role !== 'juridico') {
      window.location.href = '/';
      return;
    }
    loadLeads();
  }, [profile]);

  const loadLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, full_name, phone, closed_at, deal_value, owner_user_id')
        .eq('status', 'ganho')
        .order('closed_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error loading juridico leads:', error);
    } finally {
      setLoading(false);
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Jurídico</h1>
        <p className="text-gray-600 mt-1">Clientes com contrato fechado</p>
      </div>

      {leads.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Scale className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nenhum cliente ganho ainda</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {leads.map((lead) => (
            <a
              key={lead.id}
              href={`/leads/${lead.id}`}
              className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Scale className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{lead.full_name}</p>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {lead.phone}
                  </span>
                  {lead.closed_at && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(lead.closed_at).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>
              {lead.deal_value != null && (
                <div className="flex items-center gap-1 text-green-700 font-medium text-sm">
                  <DollarSign className="w-4 h-4" />
                  {lead.deal_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              )}
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
                Ganho
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
