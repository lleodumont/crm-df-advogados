export type LeadStatus = 'novo' | 'triagem' | 'qualificado' | 'agendado' | 'compareceu' | 'no_show' | 'proposta_enviada' | 'ganho' | 'perdido' | 'maturacao';
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

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          channel: string
          completed_at: string | null
          content: string
          created_at: string
          duration_minutes: number | null
          id: string
          lead_id: string
          scheduled_at: string | null
          status: string
          type: string
          user_id: string | null
        }
        Insert: {
          channel?: string
          completed_at?: string | null
          content: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          lead_id: string
          scheduled_at?: string | null
          status?: string
          type: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          completed_at?: string | null
          content?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          lead_id?: string
          scheduled_at?: string | null
          status?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_stale_strategic_leads"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          created_at: string | null
          empresa_id: string | null
          grupo: string | null
          id: string
          nome: string
          tipo: string | null
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string | null
          grupo?: string | null
          id?: string
          nome: string
          tipo?: string | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string | null
          grupo?: string | null
          id?: string
          nome?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          ativo: boolean | null
          beneficios: number | null
          cargo: string | null
          created_at: string | null
          empresa_id: string | null
          encargos: number | null
          id: string
          nome: string
          salario: number | null
          tipo: string | null
        }
        Insert: {
          ativo?: boolean | null
          beneficios?: number | null
          cargo?: string | null
          created_at?: string | null
          empresa_id?: string | null
          encargos?: number | null
          id?: string
          nome: string
          salario?: number | null
          tipo?: string | null
        }
        Update: {
          ativo?: boolean | null
          beneficios?: number | null
          cargo?: string | null
          created_at?: string | null
          empresa_id?: string | null
          encargos?: number | null
          id?: string
          nome?: string
          salario?: number | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          chave: string
          descricao: string | null
          id: string
          updated_at: string | null
          valor: Json
        }
        Insert: {
          chave: string
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor: Json
        }
        Update: {
          chave?: string
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor?: Json
        }
        Relationships: []
      }
      custom_fields: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          is_required: boolean | null
          name: string
          options: Json | null
          order_index: number | null
          section_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          name: string
          options?: Json | null
          order_index?: number | null
          section_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          name?: string
          options?: Json | null
          order_index?: number | null
          section_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "custom_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_sections: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          order_index: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          order_index?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          order_index?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      empresas: {
        Row: {
          cor: string | null
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          cor?: string | null
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          cor?: string | null
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      lawsuits: {
        Row: {
          case_number: string
          cause: string
          claimed_amount: number
          created_at: string
          date_closed: string | null
          date_filed: string
          description: string | null
          id: string
          paid_amount: number
          plaintiff: string
          status: string
        }
        Insert: {
          case_number: string
          cause: string
          claimed_amount?: number
          created_at?: string
          date_closed?: string | null
          date_filed?: string
          description?: string | null
          id?: string
          paid_amount?: number
          plaintiff: string
          status: string
        }
        Update: {
          case_number?: string
          cause?: string
          claimed_amount?: number
          created_at?: string
          date_closed?: string | null
          date_filed?: string
          description?: string | null
          id?: string
          paid_amount?: number
          plaintiff?: string
          status?: string
        }
        Relationships: []
      }
      lead_answers: {
        Row: {
          answer_value: string
          created_at: string
          id: string
          lead_id: string
          question_key: string
          source: string
        }
        Insert: {
          answer_value: string
          created_at?: string
          id?: string
          lead_id: string
          question_key: string
          source?: string
        }
        Update: {
          answer_value?: string
          created_at?: string
          id?: string
          lead_id?: string
          question_key?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_answers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_answers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_stale_strategic_leads"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      lead_custom_values: {
        Row: {
          created_at: string
          field_id: string | null
          id: string
          lead_id: string | null
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          field_id?: string | null
          id?: string
          lead_id?: string | null
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          field_id?: string | null
          id?: string
          lead_id?: string | null
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_custom_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_custom_values_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_custom_values_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_stale_strategic_leads"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          created_at: string | null
          created_by: string | null
          lead_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          lead_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          lead_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_stale_strategic_leads"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ad_id: string | null
          adset_id: string | null
          campaign: string | null
          campaign_id: string | null
          city: string | null
          classification: string
          closed_at: string | null
          closed_status: string | null
          created_at: string
          deal_value: number | null
          email: string | null
          family_income_range: string | null
          first_meeting_scheduled_at: string | null
          full_name: string
          id: string
          notes: string | null
          owner_user_id: string | null
          phone: string
          proposal_presented_at: string | null
          score_assets: number
          score_decision: number
          score_fit: number
          score_total: number
          score_urgency: number
          source: string
          state: string | null
          status: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          ad_id?: string | null
          adset_id?: string | null
          campaign?: string | null
          campaign_id?: string | null
          city?: string | null
          classification?: string
          closed_at?: string | null
          closed_status?: string | null
          created_at?: string
          deal_value?: number | null
          email?: string | null
          family_income_range?: string | null
          first_meeting_scheduled_at?: string | null
          full_name: string
          id?: string
          notes?: string | null
          owner_user_id?: string | null
          phone: string
          proposal_presented_at?: string | null
          score_assets?: number
          score_decision?: number
          score_fit?: number
          score_total?: number
          score_urgency?: number
          source?: string
          state?: string | null
          status?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          ad_id?: string | null
          adset_id?: string | null
          campaign?: string | null
          campaign_id?: string | null
          city?: string | null
          classification?: string
          closed_at?: string | null
          closed_status?: string | null
          created_at?: string
          deal_value?: number | null
          email?: string | null
          family_income_range?: string | null
          first_meeting_scheduled_at?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          owner_user_id?: string | null
          phone?: string
          proposal_presented_at?: string | null
          score_assets?: number
          score_decision?: number
          score_fit?: number
          score_total?: number
          score_urgency?: number
          source?: string
          state?: string | null
          status?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_divorcio: {
        Row: {
          acordo_informal: boolean | null
          bens_descricao: string | null
          conversation_id: string | null
          created_at: string | null
          data_agendamento: string | null
          data_hora_ultima_msg_lead: string | null
          decidido: boolean | null
          email: string | null
          id: string
          idades_filhos: string | null
          nome: string | null
          observacoes: string | null
          pipeline_stage: string | null
          prioridade_premium: boolean | null
          regime_bens: string | null
          renda_faixa: string | null
          renda_variavel: boolean | null
          score_qualificacao: number | null
          score_total: number | null
          score_urgencia: number | null
          status_ia: boolean | null
          telefone: string | null
          tem_bens: boolean | null
          tem_dividas: boolean | null
          tem_filhos: boolean | null
          tem_investimentos: boolean | null
          tipo_relacao: string | null
          updated_at: string | null
          urgencia: number | null
          valor_bens_estimado: number | null
          valor_dividas_estimado: number | null
          valor_em_conta: number | null
          valor_investimentos: number | null
          valor_patrimonio: number | null
        }
        Insert: {
          acordo_informal?: boolean | null
          bens_descricao?: string | null
          conversation_id?: string | null
          created_at?: string | null
          data_agendamento?: string | null
          data_hora_ultima_msg_lead?: string | null
          decidido?: boolean | null
          email?: string | null
          id?: string
          idades_filhos?: string | null
          nome?: string | null
          observacoes?: string | null
          pipeline_stage?: string | null
          prioridade_premium?: boolean | null
          regime_bens?: string | null
          renda_faixa?: string | null
          renda_variavel?: boolean | null
          score_qualificacao?: number | null
          score_total?: number | null
          score_urgencia?: number | null
          status_ia?: boolean | null
          telefone?: string | null
          tem_bens?: boolean | null
          tem_dividas?: boolean | null
          tem_filhos?: boolean | null
          tem_investimentos?: boolean | null
          tipo_relacao?: string | null
          updated_at?: string | null
          urgencia?: number | null
          valor_bens_estimado?: number | null
          valor_dividas_estimado?: number | null
          valor_em_conta?: number | null
          valor_investimentos?: number | null
          valor_patrimonio?: number | null
        }
        Update: {
          acordo_informal?: boolean | null
          bens_descricao?: string | null
          conversation_id?: string | null
          created_at?: string | null
          data_agendamento?: string | null
          data_hora_ultima_msg_lead?: string | null
          decidido?: boolean | null
          email?: string | null
          id?: string
          idades_filhos?: string | null
          nome?: string | null
          observacoes?: string | null
          pipeline_stage?: string | null
          prioridade_premium?: boolean | null
          regime_bens?: string | null
          renda_faixa?: string | null
          renda_variavel?: boolean | null
          score_qualificacao?: number | null
          score_total?: number | null
          score_urgencia?: number | null
          status_ia?: boolean | null
          telefone?: string | null
          tem_bens?: boolean | null
          tem_dividas?: boolean | null
          tem_filhos?: boolean | null
          tem_investimentos?: boolean | null
          tipo_relacao?: string | null
          updated_at?: string | null
          urgencia?: number | null
          valor_bens_estimado?: number | null
          valor_dividas_estimado?: number | null
          valor_em_conta?: number | null
          valor_investimentos?: number | null
          valor_patrimonio?: number | null
        }
        Relationships: []
      }
      meetings: {
        Row: {
          created_at: string
          held_at: string | null
          id: string
          lead_id: string
          notes: string | null
          responsible_user_id: string | null
          scheduled_at: string
          status: string
        }
        Insert: {
          created_at?: string
          held_at?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          responsible_user_id?: string | null
          scheduled_at: string
          status?: string
        }
        Update: {
          created_at?: string
          held_at?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          responsible_user_id?: string | null
          scheduled_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_stale_strategic_leads"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "meetings_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      n8n_chat_histories: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          order_index: number
          stage_key: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          order_index: number
          stage_key: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          order_index?: number
          stage_key?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          lead_id: string
          loss_reason: string | null
          loss_reason_category: string | null
          payment_terms: string | null
          presented_at: string
          status: string
          value: number
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          lead_id: string
          loss_reason?: string | null
          loss_reason_category?: string | null
          payment_terms?: string | null
          presented_at: string
          status?: string
          value: number
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          loss_reason?: string | null
          loss_reason_category?: string | null
          payment_terms?: string | null
          presented_at?: string
          status?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_stale_strategic_leads"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      retiradas_pf: {
        Row: {
          created_at: string | null
          data: string
          descricao: string | null
          empresa_id: string
          id: string
          observacoes: string | null
          tipo_retirada: string
          transacao_id: string | null
          valor: number
        }
        Insert: {
          created_at?: string | null
          data: string
          descricao?: string | null
          empresa_id: string
          id?: string
          observacoes?: string | null
          tipo_retirada: string
          transacao_id?: string | null
          valor: number
        }
        Update: {
          created_at?: string | null
          data?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          observacoes?: string | null
          tipo_retirada?: string
          transacao_id?: string | null
          valor?: number
        }
        Relationships: []
      }
      scheduled_activities: {
        Row: {
          activity_type: string
          completed_at: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          lead_id: string
          location: string | null
          notes: string | null
          priority: string
          scheduled_at: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          lead_id: string
          location?: string | null
          notes?: string | null
          priority?: string
          scheduled_at: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          lead_id?: string
          location?: string | null
          notes?: string | null
          priority?: string
          scheduled_at?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_stale_strategic_leads"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string | null
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      transacoes: {
        Row: {
          categoria_id: string | null
          colaborador_id: string | null
          created_at: string | null
          data: string
          data_prevista: string | null
          data_realizada: string | null
          descricao: string
          empresa_id: string | null
          id: string
          is_retirada_pf: boolean | null
          observacoes: string | null
          status: string | null
          tipo: string | null
          valor: number
          valor_previsto: number | null
          valor_realizado: number | null
        }
        Insert: {
          categoria_id?: string | null
          colaborador_id?: string | null
          created_at?: string | null
          data?: string
          data_prevista?: string | null
          data_realizada?: string | null
          descricao: string
          empresa_id?: string | null
          id?: string
          is_retirada_pf?: boolean | null
          observacoes?: string | null
          status?: string | null
          tipo?: string | null
          valor: number
          valor_previsto?: number | null
          valor_realizado?: number | null
        }
        Update: {
          categoria_id?: string | null
          colaborador_id?: string | null
          created_at?: string | null
          data?: string
          data_prevista?: string | null
          data_realizada?: string | null
          descricao?: string
          empresa_id?: string | null
          id?: string
          is_retirada_pf?: boolean | null
          observacoes?: string | null
          status?: string | null
          tipo?: string | null
          valor?: number
          valor_previsto?: number | null
          valor_realizado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          active: boolean | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          role: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          api_url: string | null
          created_at: string | null
          created_by: string | null
          id: string
          instance_id: string
          name: string
          phone_number: string | null
          qr_code: string | null
          status: string
          token: string | null
          updated_at: string | null
        }
        Insert: {
          api_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          instance_id: string
          name: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          token?: string | null
          updated_at?: string | null
        }
        Update: {
          api_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          instance_id?: string
          name?: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          token?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          content: string
          created_at: string | null
          direction: string
          external_id: string | null
          id: string
          instance_id: string | null
          lead_id: string | null
          media_url: string | null
          message_type: string
          phone_number: string
          sent_by: string | null
          status: string
        }
        Insert: {
          content: string
          created_at?: string | null
          direction: string
          external_id?: string | null
          id?: string
          instance_id?: string | null
          lead_id?: string | null
          media_url?: string | null
          message_type?: string
          phone_number: string
          sent_by?: string | null
          status?: string
        }
        Update: {
          content?: string
          created_at?: string | null
          direction?: string
          external_id?: string | null
          id?: string
          instance_id?: string | null
          lead_id?: string | null
          media_url?: string | null
          message_type?: string
          phone_number?: string
          sent_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_stale_strategic_leads"
            referencedColumns: ["lead_id"]
          },
        ]
      }
    }
    Views: {
      vw_stale_strategic_leads: {
        Row: {
          classification: string | null
          full_name: string | null
          idle_time: string | null
          last_activity_at: string | null
          lead_id: string | null
          owner_user_id: string | null
          phone: string | null
          score_total: number | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_lead_score: { Args: { p_lead_id: string }; Returns: undefined }
      current_user_role: { Args: never; Returns: string }
      get_latest_answer: {
        Args: { p_key: string; p_lead_id: string }
        Returns: string
      }
      get_whatsapp_conversations: {
        Args: never
        Returns: {
          last_message: string
          last_message_direction: string
          last_message_time: string
          lead_id: string
          lead_name: string
          lead_phone: string
          unread_count: number
        }[]
      }
      has_token: {
        Args: { p_answer: string; p_token: string }
        Returns: boolean
      }
      marcar_como_previsto: {
        Args: { p_transacao_id: string }
        Returns: undefined
      }
      marcar_como_realizado: {
        Args: {
          p_data_realizada?: string
          p_transacao_id: string
          p_valor_realizado?: number
        }
        Returns: undefined
      }
      recalculate_lead_score: {
        Args: { p_lead_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
