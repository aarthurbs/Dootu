/* -- Radar Claude & Loops DADOS -- */
window.CLAUDE_RADAR = {
  claudeUpdatedAt: "2026-07-22T00:03:05-03:00",
  marketUpdatedAt: "2026-07-22T04:02:02-03:00",
  news: [
    {
      tag: "Produto e automação",
      title: "Claude for Teachers combina skills e tarefas recorrentes",
      url: "https://www.anthropic.com/news/claude-for-teachers",
      source: "Anthropic",
      date: "2026-07-14",
      summary: "A Anthropic lançou uma oferta para professores com skills especializadas, Claude Code e Cowork. O anúncio mostra tarefas entregues uma vez e executadas novamente em horário definido.",
      impact: "Confirma que skills específicas e rotinas agendadas estão virando um padrão de produto."
    },
    {
      tag: "Engenharia",
      title: "UST aplica Claude em loops de validação de hardware",
      url: "https://www.anthropic.com/news/ust-claude",
      source: "Anthropic",
      date: "2026-07-09",
      summary: "A UST integra Claude Code a pipelines que leem esquemas, executam testes de regressão e comparam equipamentos com gêmeos digitais.",
      impact: "O valor está no ciclo completo: contexto, ação, medição do resultado real e repetição."
    },
    {
      tag: "Uso e aprendizado",
      title: "Claude ganha painel de reflexão sobre padrões de uso",
      url: "https://www.anthropic.com/news/reflect-with-claude",
      source: "Anthropic",
      date: "2026-07-09",
      summary: "O recurso beta resume padrões de uso e sugere melhorias com o framework 4D: delegação, descrição, discernimento e diligência.",
      impact: "A revisão periódica ajuda a transformar tarefas repetidas em skills e manter decisões humanas nas etapas certas."
    },
    {
      tag: "Segurança e agentes",
      title: "Alberta usa rotina em duas etapas para revisar código",
      url: "https://www.anthropic.com/news/alberta-government-claude-cybersecurity",
      source: "Anthropic",
      date: "2026-07-06",
      summary: "O Governo de Alberta combinou varredura por regras com revisão por Claude Code, exigindo arquivo e linha exatos para cada achado.",
      impact: "É um modelo confiável: ferramenta determinística, agente para contexto e humano para aprovar ações de risco."
    },
    {
      tag: "Modelo",
      title: "Claude Sonnet 5 reforça execução agentiva e verificação",
      url: "https://www.anthropic.com/news/claude-sonnet-5",
      source: "Anthropic",
      date: "2026-06-30",
      summary: "A Anthropic apresentou o Sonnet 5 com foco em planejamento, uso de ferramentas e execução autônoma até um resultado testado.",
      impact: "Loops frequentes precisam de continuidade, critérios de parada e checagem do próprio trabalho."
    }
  ],
  skills: [
    {
      name: "Skill de tarefa repetível",
      evidence: "O repositório oficial anthropics/skills define skills como instruções, scripts e recursos carregados conforme a tarefa.",
      loop: ["Identificar a tarefa", "Definir entrada e saída", "Executar", "Verificar", "Ajustar o SKILL.md"],
      application: "Comece por uma skill de pesquisa que aceita fontes confiáveis, elimina duplicatas e registra URL e data.",
      url: "https://github.com/anthropics/skills"
    },
    {
      name: "Loop de código com teste",
      evidence: "Casos publicados pela Anthropic mostram Claude reproduzindo falhas, criando testes, corrigindo e verificando antes da entrega.",
      loop: ["Reproduzir", "Criar teste que falha", "Corrigir", "Executar testes", "Revisar o diff"],
      application: "A condição de parada é objetiva: teste novo e testes existentes passam sem mudar partes fora do pedido.",
      url: "https://www.anthropic.com/news/claude-sonnet-5"
    },
    {
      name: "Loop em duas camadas",
      evidence: "Alberta usou regras automáticas para achar padrões e Claude para revisar os sinais com evidência exata.",
      loop: ["Filtro determinístico", "Análise do agente", "Evidência", "Aprovação humana", "Ação", "Nova checagem"],
      application: "No radar: domínio e data primeiro; análise de relevância depois; fonte obrigatória antes de gravar.",
      url: "https://www.anthropic.com/news/alberta-government-claude-cybersecurity"
    },
    {
      name: "Subagentes, hooks e MCP com função clara",
      evidence: "A Anthropic apresenta subagentes e hooks para orquestração, MCP para serviços e contexto estruturado para repositórios grandes.",
      loop: ["Planejar", "Delegar parte independente", "Executar", "Aplicar guardrail", "Reunir", "Validar"],
      application: "Use subagente só para trabalho independente, hook para regra mecânica e MCP apenas quando um serviço externo for necessário.",
      url: "https://www.anthropic.com/webinars/claude-code-advanced-patterns"
    }
  ],
  market: {
    thesis: "Estratégia principal: piloto pago de triagem de pedidos e pendências para pequenas operações de comércio e serviços, transformando exportações e mensagens em uma fila revisável. Na comparação: essa opção tem evidência local forte, demanda recorrente, custo baixo, risco controlável e repetibilidade alta; um SaaS amplo tem concorrência e tempo até receita maiores; agentes que enviam mensagens ou mudam dados sem revisão elevam o risco. O preço é hipótese comercial, não dado de mercado.",
    target: "Pequenas empresas brasileiras, especialmente comércio e serviços, com 10–49 pessoas e rotina diária de pedidos, planilhas, mensagens e pendências operacionais.",
    offer: "Piloto de 14 dias: script Python local recebe exportações autorizadas, usa Claude/Codex para classificar e resumir pendências e entrega uma planilha ou painel de revisão. Nenhuma mensagem é enviada e nenhum dado é alterado sem aprovação humana.",
    whyNow: "Sinal Brasil: a TIC Empresas 2025 registrou uso de IA em 15% das pequenas empresas, ante 10% em 2024; ainda há espaço para implementação prática. O PBIA prevê estímulo à adoção de IA por MPEs. Sinal global: a Anthropic passou a empacotar fluxos de pequenas empresas com conectores e aprovação antes de ações, reforçando o formato supervisionado — não é uma medição do mercado brasileiro.",
    plan: [
      { period: "Dias 1–3", action: "Escolher um único nicho, entrevistar cinco responsáveis e medir volume, tempo e erro da triagem atual." },
      { period: "Dias 4–7", action: "Montar com dados fictícios ou anonimizados um loop local: importar, classificar, gerar fila e revisar amostras humanas." },
      { period: "Dias 8–14", action: "Oferecer dois pilotos pagos de escopo fechado; sugerir um valor-teste apenas após validar economia de tempo e aceitar que pode não converter." },
      { period: "Dias 15–30", action: "Comparar antes e depois, registrar falhas e só propor manutenção se o cliente confirmar uso recorrente e aprovar o fluxo." }
    ],
    disclaimer: "Estratégia experimental de negócio, sem garantia de renda ou lucro e sem recomendação de investimento. Respeite LGPD, contratos, permissões de acesso e revisão humana; não use spam, coleta proibida ou automação autônoma de comunicações e dados sensíveis.",
    sources: [
      { title: "Cetic.br — TIC Empresas: uso de IA alcança 17%; pequenas empresas, 15% em 2025 (Brasil, 12 jun. 2026)", url: "https://cetic.br/pt/noticia/uso-de-inteligencia-artificial-por-empresas-brasileiras-avanca-e-atinge-17-aponta-pesquisa-do-cetic-br/" },
      { title: "MCTI — Plano Brasileiro de Inteligência Artificial 2024–2028, ação IA para MPEs (Brasil)", url: "https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/transformacaodigital/plano-brasileiro-de-inteligencia-artificial" },
      { title: "Anthropic — Claude for Small Business (sinal global, 13 maio 2026)", url: "https://www.anthropic.com/news/claude-for-small-business" }
    ]
  }
};
