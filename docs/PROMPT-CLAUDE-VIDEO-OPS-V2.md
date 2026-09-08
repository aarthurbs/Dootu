# Prompt mestre v2 — Estúdio de Vídeos para 10 contas

**Atualizado em:** 2026-07-31  
**Decisões confirmadas nesta versão:** cinco contas no TikTok + cinco no Instagram; cortes de lives e podcasts de terceiros que autorizam a divulgação; processamento no computador do Arthur; todos os cortes finais salvos no Google Drive.  
**Objetivo desta versão:** fazer o Claude Code auditar a base existente e devolver um plano técnico executável. Esta primeira rodada **não autoriza alterações no código**. Depois da revisão do Arthur, a execução será liberada uma fase por vez.

## Como usar

Abra o Claude Code na raiz do Seller-Arthur e envie todo o conteúdo a partir de **“1. Papel”**. Na primeira resposta ele deve planejar, esclarecer decisões realmente bloqueantes e parar. Quando o plano estiver aprovado, use a frase: `EXECUTAR FASE 1 DO PLANO APROVADO`.

---

## 1. Papel

Você é um arquiteto de produto e engenheiro de software sênior especializado em operações de vídeo, fluxos editoriais, automações seguras e integrações oficiais com redes sociais.

Sua missão é evoluir o módulo existente **Estúdio de Vídeos** do Seller-Arthur para uma central que permita administrar **10 contas no total — cinco no TikTok e cinco no Instagram** — e acompanhar todo o ciclo de um conteúdo: fonte, autorização, transcrição, cortes, edição, aprovação, salvamento no Google Drive, calendário, publicação e resultados.

Trabalhe como colaborador do projeto. Primeiro entenda o que já existe; depois proponha a menor evolução segura. Não reescreva a aplicação e não crie um produto paralelo.

## 2. Contexto confirmado

- O Seller-Arthur é um site estático, client-side, em Vanilla JS, com `index.html` e dados locais.
- Não há bundler nem dependências npm no frontend.
- Já existe uma tela ativa em `data-view="video-ops"`, implementada por `video-ops.js` e `video-ops.css`, com teste em `test-video-ops.js`.
- O estado atual usa `localStorage: pp_video_ops_v1`, schema 3, e guarda somente metadados.
- O módulo atual já possui contas, fila de conteúdo, confirmação de direitos, aprovação humana, agenda, estados de publicação, métricas, histórico, CSV e backup JSON.
- Arquivos de vídeo, senhas, tokens e segredos não podem ser guardados em `localStorage`.
- A publicação real atual é manual. Não finja que uma publicação ocorreu.
- O backend Supabase está planejado, mas permanece pausado. Não o reative sem aprovação explícita.
- A arquitetura alvo do projeto mantém o frontend Vanilla JS e usa Supabase/Postgres/Auth/Edge Functions/RLS quando o backend for autorizado. Segredos ficam somente no servidor/Vault.
- Há um pipeline offline em `video-apresentacao/`, mas ele não faz parte do runtime do site. Avalie se componentes locais dele e o FFmpeg vendorizado podem ser reaproveitados, sem acoplar ou copiar tudo automaticamente.
- Decisão confirmada: serão **10 contas no total**, organizadas inicialmente como cinco linhas editoriais, cada uma com um perfil no TikTok e outro no Instagram. Essa relação deve continuar configurável; não a enterre em código fixo.
- Arthur não produzirá lives próprias nesta operação. A matéria-prima serão **lives e podcasts publicados por terceiros que apoiam e autorizam a criação e divulgação de cortes**.
- A permissão precisa ser registrável por criador/canal e reaproveitável nas fontes cobertas por ela. Guarde a evidência disponível: programa oficial de cortes, página pública, mensagem, contrato ou outra autorização verificável, inclusive limitações de plataforma, território, prazo e monetização.
- Um link encontrado na internet, crédito na legenda ou um pequeno recorte não comprovam autorização quando não houver essa permissão.
- Todo processamento de mídia deve acontecer **no computador do Arthur**, sem enviar o vídeo bruto a um serviço em nuvem por padrão.
- Todos os cortes finais e suas variantes devem ser salvos no **Google Drive**. A primeira opção arquitetural a avaliar é gravar numa pasta local sincronizada pelo Google Drive para computador, sem colocar credenciais do Drive no frontend.

Leia primeiro `AGENTS.md` e `CLAUDE.md`. Para UI/CSS/design, invoque e siga `emil-design-eng` antes de trabalhar. Use buscas e trechos pequenos; não despeje arquivos grandes no contexto.

## 3. Objetivo do produto

Transformar o Estúdio de Vídeos numa sala de controle simples, visual e confiável para:

1. Ver as 10 contas e descobrir rapidamente quais precisam de atenção.
2. Receber um arquivo ou link autorizado de uma live ou podcast de terceiro.
3. Registrar a origem e a prova dos direitos de uso.
4. Transcrever o material com timestamps quando houver processamento disponível.
5. Sugerir os melhores trechos com motivo, gancho e nota de confiança.
6. Processar localmente e ajustar início/fim, formato vertical, título, legenda, hashtags e identidade editorial.
7. Criar variantes próprias para TikTok e Instagram sem marca d'água de outra rede.
8. Exigir revisão e aprovação humana antes de qualquer publicação.
9. Programar o conteúdo na conta correta e deixar o destino inequivocamente visível.
10. Salvar cada corte final e variante na pasta correta do Google Drive.
11. Registrar publicação, falhas, métricas e aprendizados por conta, formato e linha editorial.

A experiência precisa funcionar para uma pessoa não técnica. Estados automáticos nunca podem ser silenciosos: sucesso, processamento, ausência de resultado, bloqueio e erro precisam aparecer com linguagem clara.

## 4. Fluxo operacional obrigatório

```text
Live ou podcast autorizado
  → validação de direitos
  → ingestão local
  → transcrição local com timestamps
  → análise local e candidatos a corte
  → seleção/ajuste humano no computador
  → renderização local por plataforma
  → salvamento na pasta sincronizada do Google Drive
  → revisão humana
  → agenda
  → publicação manual ou integração oficial
  → confirmação real do resultado
  → métricas em 1h, 24h e 7d
  → recomendação do próximo conteúdo
```

Cada etapa deve possuir estado visível. Use, no mínimo, estas máquinas de estado como ponto de partida e proponha ajustes se necessário:

- **Fonte:** `draft | rights_pending | ready | blocked`
- **Processamento:** `queued | ingesting | transcribing | analyzing | rendering | ready | failed | cancelled`
- **Corte:** `candidate | selected | editing | review | approved | changes | rejected`
- **Publicação:** `draft | scheduled | publishing | published | error`

Nenhum item pode avançar para aprovação quando faltar origem válida, autorização, destino ou arquivo utilizável. Nenhum item pode avançar para publicação se mudou depois da aprovação.

## 5. Escopo funcional alvo

### 5.1 Rede de contas

- Exatamente cinco contas no TikTok e cinco no Instagram na primeira operação, sem limite técnico rígido escondido no modelo.
- Plataforma, nome, `@handle`, nicho, linha editorial, público, fuso, status e modo de publicação.
- Visão geral das contas ativas, pausadas, sem conteúdo, com erro e atrasadas.
- Um vídeo-base pode gerar variantes para mais de uma conta, mas cada destino mantém legenda, agenda, aprovação e resultado próprios.
- Proteção contra publicar no perfil errado: mostrar plataforma, avatar/nome retornado pela integração oficial e confirmação final do destino.

### 5.2 Biblioteca de fontes

- Entrada por arquivo local ou URL de uma live/podcast de terceiro autorizado.
- Cadastro do criador/canal: nome, perfis oficiais, política de cortes e contato/evidência da autorização.
- Campos de direitos: `permission | clip_program | licensed | public_domain`, titular, prova/link/documento, data, plataformas permitidas, monetização, território, validade e observações.
- Uma autorização pode cobrir várias lives/episódios do mesmo criador, mas cada fonte deve indicar qual autorização a cobre.
- Bloquear download, processamento e publicação quando a situação jurídica estiver pendente ou bloqueada.
- Detectar duplicidade por URL canônica no MVP e preparar evolução para fingerprint do arquivo no backend.
- Não criar um downloader genérico que burle proteção, login, paywall, DRM ou termos de uma plataforma.

### 5.3 Fábrica de cortes

- Todo download permitido, transcrição, análise e renderização acontece localmente no computador do Arthur.
- Transcrição com timestamps e idioma por um adaptador local; não escolher nem instalar modelo pesado sem aprovação.
- Candidatos com início, fim, duração, gancho, assunto, motivo da escolha, alerta de contexto e nota de confiança.
- Editor simples de `in/out`, reenquadramento 9:16, área segura de legenda, capa e prévia.
- Legendas queimadas opcionais, arquivo de legenda separado e revisão do texto.
- Variações de gancho, título, legenda e hashtags por plataforma.
- Preservar contexto: não sugerir trechos que mudem o sentido da fala ou façam afirmações enganosas.
- Render final preferencial: MP4/H.264/AAC, 9:16, com especificação validada novamente nas documentações oficiais na data da implementação.
- Manter arquivos temporários locais identificáveis e nunca apagá-los antes de confirmar que o corte final foi gravado na pasta do Drive. Limpeza automática deve ser opcional e explícita.

### 5.4 Aprovação e calendário

- Fila única com filtros por conta, plataforma, etapa, data, direitos e erro.
- Comparação entre vídeo, transcrição, corte, legenda e destino na mesma revisão.
- Aprovar, pedir ajustes ou rejeitar com motivo.
- Calendário de sete dias e visão geral de conflitos entre as 10 contas.
- Mudança em fonte, arquivo, corte, texto, destino ou horário invalida a aprovação anterior.
- Ações destrutivas explícitas, com confirmação e possibilidade de recuperação quando viável.

### 5.5 Publicação e resultados

- Enquanto não existir integração aprovada, exportar o vídeo e um pacote de publicação com legenda, hashtags, capa, destino e checklist; depois registrar manualmente o link real.
- Quando houver integração oficial, usar jobs idempotentes, tentativas limitadas, estado consultável e log de erro compreensível.
- Nunca marcar como publicado apenas porque o envio começou. Confirmar o estado final retornado pela plataforma.
- Guardar métricas por janela de tempo: visualizações, curtidas, comentários, compartilhamentos, retenção quando disponível, seguidores e visitas à marca central.
- Exibir aprendizado por conta, linha editorial, duração, gancho, assunto e horário. Não inventar métricas ausentes.

### 5.6 Google Drive como destino dos cortes

- O Google Drive será o repositório canônico dos **cortes finais**, variantes, legendas, capas e manifestos de publicação. Os vídeos-fonte não precisam ser enviados ao Drive por padrão.
- Na primeira implementação, preferir uma pasta local sincronizada pelo Google Drive para computador. O caminho deve ser escolhido na configuração local e nunca ficar hardcoded no repositório.
- O processador local grava primeiro num arquivo temporário e só depois faz a troca para o nome final, evitando arquivos incompletos na pasta sincronizada.
- Usar nomes determinísticos com ID do corte, criador, assunto, plataforma, conta e versão, sanitizados para Windows.
- Separar um corte mestre das variantes TikTok/Instagram para evitar duplicação desnecessária.
- Propor uma estrutura semelhante a esta, ajustando-a ao `driveTree()` existente:

```text
Projeto Automação de Vídeos/
  Criadores e permissões/
  Cortes mestres/
  Variantes/
    TikTok/<conta>/
    Instagram/<conta>/
  Legendas e capas/
  Publicados/
  Relatórios/
  Erros de processamento/
```

- Diferenciar os estados `renderizado localmente`, `gravado na pasta do Drive` e `sincronização confirmada`. Não dizer que chegou à nuvem apenas porque o arquivo foi criado na pasta local.
- Se a confirmação automática de sincronização não for confiável sem a API do Drive, exibir isso honestamente e permitir confirmação manual.

## 6. Arquitetura por fases

### Fase 0 — auditoria e plano, agora

Não altere arquivos. Entregue o diagnóstico e o plano pedidos na seção 10 e pare para aprovação.

### Fase 1 — sala de controle local

Evolua incrementalmente o módulo atual sem processamento pesado nem credenciais:

- visão geral das 10 contas;
- biblioteca de fontes e direitos;
- cadastro reutilizável de criadores e permissões de corte;
- projetos de corte com timestamps preenchidos manualmente;
- variantes por plataforma;
- aprovação e calendário unificado;
- estrutura e configuração da pasta local sincronizada do Google Drive;
- pacote de publicação manual com destino de arquivo determinístico;
- migração segura do schema atual;
- backups compatíveis e novos testes.

Metadados podem permanecer no `localStorage`; binários continuam fora dele. Não tente processar vídeos grandes dentro do navegador nesta fase. A primeira fatia pode preparar manifestos de jobs e caminhos do Drive sem fingir que o worker local já existe.

### Fase 2 — processador local e Google Drive, somente após autorização

- Criar um **worker/CLI local em Python**, sem servidor Node, que leia manifestos de jobs, processe os vídeos e escreva resultados de forma atômica.
- Auditar primeiro o pipeline `video-apresentacao/` e o FFmpeg vendorizado; reaproveitar apenas o que for estável, pequeno e testável.
- Download somente quando a origem autorizar e sem burlar autenticação, DRM ou bloqueios. Também aceitar o arquivo fornecido manualmente pelo Arthur.
- Fila local persistente e idempotente, com cancelamento, progresso, retentativas limitadas e logs legíveis.
- Adaptadores locais substituíveis para transcrição, análise de cortes, legendagem e renderização.
- Integração inicial com o site por manifestos importáveis/exportáveis ou outro mecanismo local simples e explícito. Não crie serviço residente ou servidor local sem justificar e receber aprovação.
- Saída na pasta local sincronizada do Google Drive, com escrita temporária, verificação do arquivo final e manifesto de resultado.
- Segredos e tokens não entram no worker nesta fase. Google Drive para computador cuida da sincronização da pasta.

Antes de escolher modelos locais ou instalar dependências, compare requisitos de CPU/GPU/RAM, tempo por hora de vídeo, qualidade em PT-BR, tamanho dos downloads e portabilidade. Não instale nada sem aprovação do Arthur.

### Fase 3 — backend opcional e integrações oficiais

- Só reativar Supabase com aprovação explícita. Quando autorizado, usar Auth/Postgres/RLS por `user_id` e Edge Functions para OAuth, webhooks e chamadas às plataformas.
- O processamento de mídia continua local; Supabase não substitui o worker de vídeo.
- Instagram: somente contas profissionais e fluxo oficial; publicar de servidor e acompanhar o status do container.
- TikTok: implementar apenas se o aplicativo e o caso de uso forem aceitos pela plataforma. Manter exportação/publicação manual como caminho funcional.
- OAuth por conta, renovação segura, revogação, escopos mínimos e indicador de conexão expirada.
- Webhooks/consulta de status e reconciliação de publicações.
- Nunca pedir ou armazenar senha de TikTok/Instagram.

### Fase 4 — aprendizagem e escala

- métricas automatizadas;
- ranking de formatos e cortes;
- recomendações explicáveis;
- custo por corte e por resultado;
- expansão gradual, sem colocar as 10 contas em carga total antes de validar os perfis-piloto.

## 7. Modelo de dados que deve ser planejado

Não implemente este desenho cegamente. Compare com o schema 3 existente e proponha uma migração idempotente e reversível.

- `editorialLines`: identidade, público, temas e regras.
- `creators`: criador/canal, perfis oficiais, contato e política pública de cortes.
- `permissions`: criador, tipo, evidência, plataformas, monetização, território, validade e status.
- `accounts`: plataforma, handle, linha editorial, fuso, status e modo de publicação.
- `sources`: criador, autorização vinculada, live/podcast, episódio, origem, URL/arquivo local, duração e status.
- `transcripts`: idioma, segmentos com início/fim, fornecedor, versão e status.
- `clips`: fonte, início/fim, gancho, motivo, score, contexto e estado editorial.
- `variants`: corte, plataforma, conta, título, legenda, hashtags, capa, especificação e render.
- `approvals`: versão aprovada, pessoa, data, decisão e motivo.
- `publications`: variante, conta, agenda, estado, ID externo, URL real, tentativas e erro.
- `metricSnapshots`: publicação, janela, horário e valores disponíveis.
- `jobs`: tipo, alvo, estado, progresso, tentativas, erro e timestamps.
- `driveArtifacts`: corte/variante, caminho relativo, nome, tamanho, checksum, versão e estado de gravação/sincronização.
- `auditLog`: ação, ator, entidade, versão e data.

Evite duplicar o arquivo de vídeo para cada destino. Separe fonte, corte mestre, variante, artefato do Drive e publicação. Preserve os registros existentes e aceite backups antigos válidos.

## 8. Segurança, direitos e regras das plataformas

- A operação se baseia em criadores que apoiam cortes de suas lives e podcasts, mas essa permissão deve ser registrável e verificável. Não extrapole uma autorização além das plataformas, do prazo ou da monetização permitidos.
- Conteúdo encontrado na internet não é automaticamente reutilizável. Exija a autorização vinculada ao criador/fonte antes de processar/publicar.
- Não automatize criação de contas, compra de seguidores, curtidas/comentários artificiais, spam, coleta não autorizada ou tentativa de manipular recomendação.
- Não faça scraping autenticado nem automação de navegador para publicar em massa.
- Não contorne DRM, paywall, bloqueio de download ou proteção de origem.
- Não misture tokens de contas. Toda credencial futura deve ser vinculada ao usuário e à conta correta no servidor, com RLS e trilha de auditoria.
- Revalide políticas e especificações nas fontes oficiais imediatamente antes de implementar cada integração.

Referências oficiais atuais para a auditoria:

- [TikTok — Content Sharing Guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines/): clientes não auditados publicam apenas de forma privada; as diretrizes também restringem utilitários internos e cópia arbitrária de outras plataformas.
- [TikTok — Direct Post API](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post): exige consentimento, informações atuais do criador, escopo próprio e consulta do resultado.
- [Meta — workspace oficial da Instagram API](https://www.postman.com/meta/instagram/overview): publicação e métricas para contas profissionais por APIs oficiais.
- [Instagram — direitos autorais](https://www.facebook.com/help/instagram/354736791367645?locale=pt_BR): encontrar, baixar, creditar ou modificar um conteúdo não garante o direito de publicá-lo.

Se a documentação oficial contradisser este prompt, pare, cite a fonte e proponha um caminho compatível. Não prometa publicação pública automática no TikTok até validar que o nosso caso de uso pode ser aprovado.

## 9. Experiência e qualidade

- Preserve o design system do Seller-Arthur e escopo CSS em `#view-video-ops`/`.vop-*`.
- Interface profissional e direta, sem aparência genérica de IA, glow neon ou enfeites sem função.
- Tudo que for clicável recebe feedback `:active` sutil.
- Nunca use `transition: all` nem `ease-in`; transições de UI abaixo de 300 ms e em propriedades específicas.
- Use movimento somente para explicar mudança de estado e respeite `prefers-reduced-motion`.
- Toda automação deve exibir: processando, concluiu, encontrou opções, não encontrou, foi bloqueada ou falhou.
- A fila precisa continuar utilizável com centenas de registros: renderização limitada/paginada ou virtualizada, busca e filtros.
- Re-render de área rolável deve preservar a posição quando o contexto não mudou.
- Acessibilidade: teclado, foco visível, rótulos, `aria-live` para feedback e contraste suficiente.

## 10. Sua primeira resposta obrigatória

Nesta primeira rodada, **não escreva nem altere código**. Entregue exatamente:

1. **Estado atual confirmado:** o que `video-ops.js`, `video-ops.css`, `test-video-ops.js` e a fiação no `index.html` já fazem.
2. **Lacunas:** o que falta para chegar ao fluxo completo, separado entre frontend, backend, mídia e integrações.
3. **Decisões bloqueantes:** no máximo cinco perguntas que realmente mudem arquitetura ou escopo. Não pergunte o que pode ser descoberto no repositório.
4. **Arquitetura proposta:** site Vanilla JS, worker local, pasta sincronizada do Google Drive, fronteiras de segurança e fluxo de dados.
5. **Migração de dados:** schema atual → próximo schema, com compatibilidade de backup e rollback.
6. **Plano por fases:** entregas pequenas, ordem, arquivos envolvidos, riscos e critérios de aceite verificáveis.
7. **Plano de testes:** testes puros, migração, estados, direitos, duplicidade, falhas e ponte com `index.html`.
8. **Primeira fatia recomendada:** a menor entrega útil que possamos testar com um par piloto — uma conta TikTok e uma Instagram da mesma linha editorial — sem backend e sem processar vídeo no navegador.
9. **Fora de escopo explícito:** tudo que não será feito nessa primeira fatia.

Termine com: `Aguardando aprovação para executar a Fase 1.`

## 11. Contrato para execução depois da aprovação

Quando eu disser `EXECUTAR FASE N DO PLANO APROVADO`:

- confirme o estado vivo do código antes de editar;
- faça somente a fase autorizada;
- aplique mudanças cirúrgicas e preserve recursos existentes;
- não adicione framework, bundler ou dependência npm ao frontend;
- não reative Supabase nem crie servidor Node sem autorização específica;
- mantenha processamento e renderização no computador do Arthur;
- grave todo corte final na pasta configurada do Google Drive e reporte separadamente gravação local e sincronização;
- use migração versionada e nunca apague dados silenciosamente;
- preserve aprovação humana, verificação de direitos e publicação honesta;
- execute ao menos `node --check video-ops.js` e `node test-video-ops.js`;
- adicione testes para toda regra nova;
- verifique a interface via `http://localhost`, em desktop e largura móvel;
- reporte arquivos alterados, testes executados, limitações restantes e próximo passo;
- pare ao final da fase, sem avançar automaticamente.
