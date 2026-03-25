import { BookOpen, TrendingUp, Target, Star, Award, Users } from 'lucide-react';

export default function Instructions() {
  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <BookOpen className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Instruções do CRM</h1>
          <p className="text-gray-600 mt-1">Processo comercial e sistema de pontuação</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl shadow-sm border border-blue-100 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="w-6 h-6 text-blue-600" />
          Visão Geral do Processo Comercial
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          O processo comercial é dividido em etapas claras que guiam o lead desde o primeiro contato até o fechamento.
          Cada etapa tem objetivos específicos e requer ações determinadas para avançar o lead no funil.
        </p>
      </div>

      <div className="grid gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-6 h-6 text-green-600" />
            Etapas do Pipeline
          </h2>

          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-semibold text-gray-900 mb-1">1. Novo Lead</h3>
              <p className="text-gray-600 text-sm">
                Lead recém-chegado ao sistema. Aguardando primeiro contato e qualificação inicial.
              </p>
            </div>

            <div className="border-l-4 border-yellow-500 pl-4">
              <h3 className="font-semibold text-gray-900 mb-1">2. Triagem</h3>
              <p className="text-gray-600 text-sm">
                Fase de qualificação inicial. Coleta de informações básicas e avaliação do perfil do lead.
              </p>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-semibold text-gray-900 mb-1">3. Qualificado</h3>
              <p className="text-gray-600 text-sm">
                Lead validado com potencial de negócio. Pronto para agendamento de reunião.
              </p>
            </div>

            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="font-semibold text-gray-900 mb-1">4. Agendado</h3>
              <p className="text-gray-600 text-sm">
                Reunião marcada com o lead. Aguardando data do encontro.
              </p>
            </div>

            <div className="border-l-4 border-teal-500 pl-4">
              <h3 className="font-semibold text-gray-900 mb-1">5. Compareceu</h3>
              <p className="text-gray-600 text-sm">
                Lead participou da reunião. Fase de apresentação de proposta.
              </p>
            </div>

            <div className="border-l-4 border-orange-400 pl-4">
              <h3 className="font-semibold text-gray-900 mb-1">6. Não Compareceu</h3>
              <p className="text-gray-600 text-sm">
                Lead tinha reunião agendada mas não compareceu. Tentar reagendamento ou mover para maturação.
              </p>
            </div>

            <div className="border-l-4 border-orange-500 pl-4">
              <h3 className="font-semibold text-gray-900 mb-1">7. Proposta Enviada</h3>
              <p className="text-gray-600 text-sm">
                Proposta comercial enviada ao lead. Aguardando resposta e negociação.
              </p>
            </div>

            <div className="border-l-4 border-green-600 pl-4">
              <h3 className="font-semibold text-gray-900 mb-1">8. Ganho</h3>
              <p className="text-gray-600 text-sm">
                Negócio fechado com sucesso. Lead se tornou cliente.
              </p>
            </div>

            <div className="border-l-4 border-red-500 pl-4">
              <h3 className="font-semibold text-gray-900 mb-1">9. Perdido</h3>
              <p className="text-gray-600 text-sm">
                Negócio não concretizado. Documentar motivo da perda para aprendizado.
              </p>
            </div>

            <div className="border-l-4 border-gray-500 pl-4">
              <h3 className="font-semibold text-gray-900 mb-1">10. Maturação</h3>
              <p className="text-gray-600 text-sm">
                Lead com potencial mas sem condições atuais de fechamento. Manter contato periódico.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Sistema de Pontuação (Score)
          </h2>

          <p className="text-gray-700 mb-6">
            O score total é calculado com base em 4 pilares que avaliam a qualidade e probabilidade de conversão do lead.
            A pontuação máxima é <strong>100 pontos</strong>.
          </p>

          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                  <h3 className="font-semibold text-gray-900">Pilar Decisão (0–40 pontos)</h3>
                </div>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Peso 40%</span>
              </div>
              <p className="text-gray-600 text-sm mb-2">
                Avalia o estágio de decisão, prazo para agir e autonomia do lead para fechar negócio.
              </p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm text-gray-600">
                <p><strong>Estágio de decisão:</strong> Decidido = 25 pts · Quase decidido = 15 pts · Avaliando = 5 pts</p>
                <p><strong>Prazo:</strong> Até 7 dias = 10 pts · Até 30 dias = 5 pts</p>
                <p><strong>Autonomia:</strong> Decide sozinho = 5 pts · Precisa alinhar = 3 pts · Não sabe = 1 pt</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-600"></div>
                  <h3 className="font-semibold text-gray-900">Pilar Urgência (0–30 pontos)</h3>
                </div>
                <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">Peso 30%</span>
              </div>
              <p className="text-gray-600 text-sm mb-2">
                Mede a necessidade imediata e o risco de não agir rapidamente.
              </p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm text-gray-600">
                <p><strong>Urgência declarada:</strong> Alta = 30 pts · Média = 15 pts · Baixa = 5 pts</p>
                <p><strong>Situações de risco:</strong> Processo existente = +15 · Ameaça de processo = +10 · Conflito de bens = +8 · Disputa de filhos = +8</p>
                <p><strong>Risco nos próximos 15 dias:</strong> Sim = +10 · Talvez = +5</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-600"></div>
                  <h3 className="font-semibold text-gray-900">Pilar Patrimônio (0–25 pontos)</h3>
                </div>
                <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">Peso 25%</span>
              </div>
              <p className="text-gray-600 text-sm mb-2">
                Avalia o volume e a complexidade do patrimônio do lead.
              </p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm text-gray-600">
                <p><strong>Valor dos bens:</strong> Acima de R$ 1M = 20 pts · R$ 500k–1M = 12 pts · R$ 200k–500k = 7 pts · Até R$ 200k = 3 pts</p>
                <p><strong>Tipo de bens:</strong> Registrado para contexto da negociação (não impacta o score)</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                  <h3 className="font-semibold text-gray-900">Pilar Fit (0–5 pontos)</h3>
                </div>
                <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">Peso 5%</span>
              </div>
              <p className="text-gray-600 text-sm mb-2">
                Analisa aderência do lead ao serviço oferecido.
              </p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm text-gray-600">
                <p><strong>Condução completa:</strong> 5 pts · <strong>Não sabe:</strong> 2 pts · <strong>Outros:</strong> 0 pts</p>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <Star className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Score Total (0–100 pontos)</h4>
                <p className="text-sm text-gray-700">
                  Soma dos 4 pilares. Leads com score acima de <strong>70 pontos</strong> são super qualificados
                  e devem receber atenção imediata. Leads com score entre <strong>40 e 69</strong> são qualificados
                  e devem ser acompanhados ativamente.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Award className="w-6 h-6 text-yellow-600" />
            Classificação de Leads
          </h2>

          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-green-50 to-white rounded-lg border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-600"></div>
                  <h3 className="font-semibold text-gray-900">Super qualificado (70–100 pontos)</h3>
                </div>
                <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full">Prioridade máxima</span>
              </div>
              <p className="text-gray-700 text-sm">
                Leads de altíssimo valor. Decisores com urgência, alto patrimônio e fit perfeito.
                Devem ser contatados em até 1 hora após entrada no sistema.
              </p>
            </div>

            <div className="p-4 bg-gradient-to-r from-yellow-50 to-white rounded-lg border border-yellow-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
                  <h3 className="font-semibold text-gray-900">Qualificado (40–69 pontos)</h3>
                </div>
                <span className="text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full">Atenção regular</span>
              </div>
              <p className="text-gray-700 text-sm">
                Leads com bom potencial. Possuem características favoráveis mas podem precisar de mais trabalho
                de nutrição. Devem ser acompanhados com atenção regular.
              </p>
            </div>

            <div className="p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                  <h3 className="font-semibold text-gray-900">Morno (0–39 pontos)</h3>
                </div>
                <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-full">Contato esporádico</span>
              </div>
              <p className="text-gray-700 text-sm">
                Leads com baixo potencial imediato. Podem estar em fase de pesquisa ou não ter fit adequado.
                Manter contato esporádico e reavaliar periodicamente.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-white rounded-xl shadow-sm border border-green-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Boas Práticas</h2>

          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-green-600 mt-2 flex-shrink-0"></div>
              <p className="text-gray-700">
                <strong>Responda rápido:</strong> Leads super qualificados (score ≥ 70) devem ser contatados em até 1 hora após entrada no sistema
              </p>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-green-600 mt-2 flex-shrink-0"></div>
              <p className="text-gray-700">
                <strong>Atualize o score:</strong> Sempre que obtiver novas informações na triagem, atualize as respostas para manter a classificação precisa
              </p>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-green-600 mt-2 flex-shrink-0"></div>
              <p className="text-gray-700">
                <strong>Documente tudo:</strong> Registre todas interações, reuniões e acordos feitos com o lead
              </p>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-green-600 mt-2 flex-shrink-0"></div>
              <p className="text-gray-700">
                <strong>Agenda ativa:</strong> Use a agenda para programar todas atividades e garantir follow-ups consistentes
              </p>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-green-600 mt-2 flex-shrink-0"></div>
              <p className="text-gray-700">
                <strong>Analise perdas:</strong> Sempre documente o motivo da perda para identificar padrões e melhorar o processo
              </p>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
