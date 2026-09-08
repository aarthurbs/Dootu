---
description: Executa um novo ciclo de aperfeiçoamento da operação de cortes (TikTok e Instagram)
argument-hint: [área ou problema opcional — ex. "trilha B" ou "direitos"]
---

Execute um novo ciclo do `video-growth-loop`.

Delegue ao subagente `video-growth-loop` (ferramenta Agent, `subagent_type: "video-growth-loop"`)
e passe adiante o foco pedido, se houver: $ARGUMENTS

O agente deve seguir o ciclo de 12 etapas definido em `.claude/agents/video-growth-loop.md`
e em `docs/video-ops/AGENTE_VIDEO_GROWTH_LOOP.md`, começando por reconstruir o estado real
a partir do código — não da documentação.

Lembretes que valem para toda execução:

- uma melhoria principal por ciclo, no máximo uma correção pequena relacionada;
- "nenhuma mudança necessária" é um resultado válido;
- sem dados reais, marcar "sem baseline" e não inventar métrica nem tendência;
- checkpoint em `.patch` antes de tocar em código; não commitar automaticamente;
- ao final, atualizar `docs/video-ops/PROGRESSO.md` e `CONTINUAR_PROJETO.md`.
