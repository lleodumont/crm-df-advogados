import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export const LEADS_KEY = ['leads'];

export function useLeads(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: [...LEADS_KEY, filters],
    queryFn: async () => {
      let query = supabase.from('leads').select('*');
      // aplicar filtros se existirem
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status as string);
      }
      const { data, error } = await query
        .order('score_total', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: string }) => {
      const { error } = await supabase.from('leads').update({ status }).eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LEADS_KEY }),
  });
}
