import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export const MESSAGES_KEY = ['whatsapp_messages'];

export function useRealtimeMessages(leadId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    const filter = leadId ? `lead_id=eq.${leadId}` : undefined;
    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
        ...(filter ? { filter } : {}),
      }, () => {
        qc.invalidateQueries({ queryKey: MESSAGES_KEY });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [qc, leadId]);
}
