import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { LEADS_KEY } from './useLeads';

export function useRealtimeLeads() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        qc.invalidateQueries({ queryKey: LEADS_KEY });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [qc]);
}
