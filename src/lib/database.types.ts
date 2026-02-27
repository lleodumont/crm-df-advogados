export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type LeadStatus = 'novo' | 'triagem' | 'qualificado' | 'agendado' | 'compareceu' | 'proposta_enviada' | 'ganho' | 'perdido' | 'maturacao';
export type LeadClassification = 'morno' | 'qualificado' | 'estrategico';
export type FamilyIncomeRange = 'ate_10k' | '10k_25k' | '25k_50k' | 'acima_50k' | 'prefiro_nao_informar';
export type UserRole = 'admin' | 'atendimento' | 'comercial' | 'viewer';
export type ActivityType = 'msg_sent' | 'msg_received' | 'call' | 'audio' | 'followup' | 'note' | 'status_change';
export type ActivityChannel = 'whatsapp' | 'phone' | 'email' | 'internal';
export type ScheduledActivityType = 'meeting' | 'call' | 'task' | 'email' | 'follow_up';
export type ScheduledActivityStatus = 'scheduled' | 'completed' | 'cancelled' | 'overdue';
export type ScheduledActivityPriority = 'low' | 'medium' | 'high' | 'urgent';
export type MeetingStatus = 'scheduled' | 'held' | 'no_show' | 'rescheduled' | 'canceled';
export type ProposalStatus = 'open' | 'won' | 'lost';
export type ClosedStatus = 'won' | 'lost';

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: UserRole;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      leads: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          email: string | null;
          city: string | null;
          state: string | null;
          source: string;
          campaign: string | null;
          created_at: string;
          updated_at: string;
          status: LeadStatus;
          owner_user_id: string | null;
          notes: string | null;
          score_total: number;
          score_decision: number;
          score_urgency: number;
          score_assets: number;
          score_fit: number;
          classification: LeadClassification;
          first_meeting_scheduled_at: string | null;
          proposal_presented_at: string | null;
          closed_at: string | null;
          closed_status: ClosedStatus | null;
          deal_value: number | null;
          family_income_range: FamilyIncomeRange | null;
          utm_campaign: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_content: string | null;
          utm_term: string | null;
          campaign_id: string | null;
          adset_id: string | null;
          ad_id: string | null;
        };
        Insert: {
          id?: string;
          full_name: string;
          phone: string;
          email?: string | null;
          city?: string | null;
          state?: string | null;
          source?: string;
          campaign?: string | null;
          created_at?: string;
          updated_at?: string;
          status?: LeadStatus;
          owner_user_id?: string | null;
          notes?: string | null;
          score_total?: number;
          score_decision?: number;
          score_urgency?: number;
          score_assets?: number;
          score_fit?: number;
          classification?: LeadClassification;
          first_meeting_scheduled_at?: string | null;
          proposal_presented_at?: string | null;
          closed_at?: string | null;
          closed_status?: ClosedStatus | null;
          deal_value?: number | null;
          family_income_range?: FamilyIncomeRange | null;
          utm_campaign?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_content?: string | null;
          utm_term?: string | null;
          campaign_id?: string | null;
          adset_id?: string | null;
          ad_id?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string;
          email?: string | null;
          city?: string | null;
          state?: string | null;
          source?: string;
          campaign?: string | null;
          created_at?: string;
          updated_at?: string;
          status?: LeadStatus;
          owner_user_id?: string | null;
          notes?: string | null;
          score_total?: number;
          score_decision?: number;
          score_urgency?: number;
          score_assets?: number;
          score_fit?: number;
          classification?: LeadClassification;
          first_meeting_scheduled_at?: string | null;
          proposal_presented_at?: string | null;
          closed_at?: string | null;
          closed_status?: ClosedStatus | null;
          deal_value?: number | null;
          family_income_range?: FamilyIncomeRange | null;
          utm_campaign?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_content?: string | null;
          utm_term?: string | null;
          campaign_id?: string | null;
          adset_id?: string | null;
          ad_id?: string | null;
        };
      };
      lead_answers: {
        Row: {
          id: string;
          lead_id: string;
          question_key: string;
          answer_value: string;
          source: 'meta_form' | 'triagem_humana';
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          question_key: string;
          answer_value: string;
          source?: 'meta_form' | 'triagem_humana';
          created_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          question_key?: string;
          answer_value?: string;
          source?: 'meta_form' | 'triagem_humana';
          created_at?: string;
        };
      };
      activities: {
        Row: {
          id: string;
          lead_id: string;
          type: ActivityType;
          channel: ActivityChannel | null;
          created_at: string;
          user_id: string | null;
          content: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          type: ActivityType;
          channel?: ActivityChannel | null;
          created_at?: string;
          user_id?: string | null;
          content: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          type?: ActivityType;
          channel?: ActivityChannel | null;
          created_at?: string;
          user_id?: string | null;
          content?: string;
        };
      };
      meetings: {
        Row: {
          id: string;
          lead_id: string;
          scheduled_at: string;
          held_at: string | null;
          status: MeetingStatus;
          responsible_user_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          scheduled_at: string;
          held_at?: string | null;
          status?: MeetingStatus;
          responsible_user_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          scheduled_at?: string;
          held_at?: string | null;
          status?: MeetingStatus;
          responsible_user_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      proposals: {
        Row: {
          id: string;
          lead_id: string;
          presented_at: string;
          value: number;
          payment_terms: string | null;
          status: ProposalStatus;
          closed_at: string | null;
          loss_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          presented_at: string;
          value: number;
          payment_terms?: string | null;
          status?: ProposalStatus;
          closed_at?: string | null;
          loss_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          presented_at?: string;
          value?: number;
          payment_terms?: string | null;
          status?: ProposalStatus;
          closed_at?: string | null;
          loss_reason?: string | null;
          created_at?: string;
        };
      };
      scheduled_activities: {
        Row: {
          id: string;
          lead_id: string;
          user_id: string;
          activity_type: ScheduledActivityType;
          title: string;
          description: string | null;
          scheduled_at: string;
          completed_at: string | null;
          status: ScheduledActivityStatus;
          priority: ScheduledActivityPriority;
          location: string | null;
          duration_minutes: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          user_id: string;
          activity_type: ScheduledActivityType;
          title: string;
          description?: string | null;
          scheduled_at: string;
          completed_at?: string | null;
          status?: ScheduledActivityStatus;
          priority?: ScheduledActivityPriority;
          location?: string | null;
          duration_minutes?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          user_id?: string;
          activity_type?: ScheduledActivityType;
          title?: string;
          description?: string | null;
          scheduled_at?: string;
          completed_at?: string | null;
          status?: ScheduledActivityStatus;
          priority?: ScheduledActivityPriority;
          location?: string | null;
          duration_minutes?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      calculate_lead_score: {
        Args: {
          p_lead_id: string;
        };
        Returns: void;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
