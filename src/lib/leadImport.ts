import { supabase } from './supabase';

export interface LeadImportData {
  nome: string;
  telefone: string;
  decidido_divorcio?: 'sim' | 'nao' | 'quase';
  esta_separado?: 'sim' | 'nao';
  possui_bens?: 'sim' | 'nao';
  possui_filhos_pequenos?: 'sim' | 'nao';
  nivel_urgencia?: 'alta' | 'media' | 'baixa';
  valor_dos_bens?: string;
  divorcio_formalizado?: 'sim' | 'nao';
  utm_campaign?: string;
  utm_medium?: string;
  utm_source?: string;
  utm_content?: string;
  campaign_id?: string;
  ad_id?: string;
  group_id?: string;
}

export async function importLeadViaWebhook(leadData: LeadImportData) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const webhookPayload = {
    nome: leadData.nome,
    telefone: leadData.telefone,
    decidido_divorcio: leadData.decidido_divorcio,
    esta_separado: leadData.esta_separado,
    possui_bens: leadData.possui_bens,
    possui_filhos_pequenos: leadData.possui_filhos_pequenos,
    nivel_urgencia: leadData.nivel_urgencia,
    valor_dos_bens: leadData.valor_dos_bens,
    divorcio_formalizado: leadData.divorcio_formalizado,
    utm_campaign: leadData.utm_campaign,
    utm_medium: leadData.utm_medium,
    utm_source: leadData.utm_source,
    utm_content: leadData.utm_content,
    'campaign-id': leadData.campaign_id,
    'ad-id': leadData.ad_id,
    'groud-id': leadData.group_id,
  };

  const response = await fetch(`${supabaseUrl}/functions/v1/meta-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(webhookPayload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || 'Erro ao importar lead');
  }

  return await response.json();
}

export async function importLeadDirectly(leadData: LeadImportData) {
  const campaignSource = leadData.utm_source || 'manual';
  const campaignName = leadData.utm_campaign || leadData.campaign_id || null;

  const { data: leadRecord, error: leadError } = await supabase
    .from('leads')
    .insert({
      full_name: leadData.nome,
      phone: leadData.telefone,
      source: campaignSource,
      campaign: campaignName,
      status: 'novo',
    })
    .select()
    .single();

  if (leadError) throw leadError;

  const answers = [];

  if (leadData.decidido_divorcio) {
    const stageValue =
      leadData.decidido_divorcio === 'sim' ? 'decidi_estruturar' :
      leadData.decidido_divorcio === 'quase' ? 'quase_decidido' :
      'avaliando';

    answers.push({
      lead_id: leadRecord.id,
      question_key: 'stage',
      answer_value: stageValue,
      source: 'meta_form',
    });
  }

  if (leadData.nivel_urgencia) {
    const urgencyMap: Record<string, string> = {
      'alta': 'ja_existe_processo',
      'media': 'ameaca_processo',
      'baixa': 'organizar_com_calma',
    };

    answers.push({
      lead_id: leadRecord.id,
      question_key: 'urgency_now',
      answer_value: urgencyMap[leadData.nivel_urgencia],
      source: 'meta_form',
    });
  }

  if (leadData.possui_bens) {
    answers.push({
      lead_id: leadRecord.id,
      question_key: 'has_assets',
      answer_value: leadData.possui_bens,
      source: 'meta_form',
    });

    if (leadData.possui_bens === 'sim' && leadData.valor_dos_bens) {
      const assetValue = parseInt(leadData.valor_dos_bens.replace(/\D/g, ''));
      let assetRange = 'ate_200k';

      if (assetValue > 1000000) {
        assetRange = 'acima_1m';
      } else if (assetValue >= 500000) {
        assetRange = '500k_1m';
      } else if (assetValue >= 200000) {
        assetRange = '200k_500k';
      }

      answers.push({
        lead_id: leadRecord.id,
        question_key: 'assets_range',
        answer_value: assetRange,
        source: 'meta_form',
      });
    }
  }

  if (leadData.esta_separado) {
    answers.push({
      lead_id: leadRecord.id,
      question_key: 'separated',
      answer_value: leadData.esta_separado,
      source: 'meta_form',
    });
  }

  if (leadData.possui_filhos_pequenos) {
    answers.push({
      lead_id: leadRecord.id,
      question_key: 'has_children',
      answer_value: leadData.possui_filhos_pequenos,
      source: 'meta_form',
    });
  }

  if (leadData.divorcio_formalizado) {
    answers.push({
      lead_id: leadRecord.id,
      question_key: 'divorce_formalized',
      answer_value: leadData.divorcio_formalizado,
      source: 'meta_form',
    });
  }

  if (leadData.utm_campaign) {
    answers.push({
      lead_id: leadRecord.id,
      question_key: 'utm_campaign',
      answer_value: leadData.utm_campaign,
      source: 'meta_form',
    });
  }

  if (leadData.utm_medium) {
    answers.push({
      lead_id: leadRecord.id,
      question_key: 'utm_medium',
      answer_value: leadData.utm_medium,
      source: 'meta_form',
    });
  }

  if (leadData.utm_content) {
    answers.push({
      lead_id: leadRecord.id,
      question_key: 'utm_content',
      answer_value: leadData.utm_content,
      source: 'meta_form',
    });
  }

  if (leadData.campaign_id) {
    answers.push({
      lead_id: leadRecord.id,
      question_key: 'campaign_id',
      answer_value: leadData.campaign_id,
      source: 'meta_form',
    });
  }

  if (leadData.ad_id) {
    answers.push({
      lead_id: leadRecord.id,
      question_key: 'ad_id',
      answer_value: leadData.ad_id,
      source: 'meta_form',
    });
  }

  if (leadData.group_id) {
    answers.push({
      lead_id: leadRecord.id,
      question_key: 'group_id',
      answer_value: leadData.group_id,
      source: 'meta_form',
    });
  }

  if (answers.length > 0) {
    const { error: answersError } = await supabase
      .from('lead_answers')
      .insert(answers);

    if (answersError) throw answersError;
  }

  await supabase.from('activities').insert({
    lead_id: leadRecord.id,
    type: 'note',
    channel: 'internal',
    content: `Lead importado via ${campaignSource}${campaignName ? ` - Campanha: ${campaignName}` : ''}`,
  });

  return { success: true, lead_id: leadRecord.id };
}
