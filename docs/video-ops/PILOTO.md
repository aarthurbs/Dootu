# Piloto operacional — uma linha editorial, duas contas

**Escrito em:** 01/08/2026 · **Estado:** preparado, **não iniciado** — falta material
autorizado. Nada aqui inventa fonte, direito ou métrica.

Escopo do piloto: **uma** linha editorial, **uma** conta TikTok, **uma** conta Instagram,
até **seis** fontes autorizadas, **3–5 publicações por semana em cada plataforma**.
As outras oito contas ficam desligadas até a linha piloto ser validada.

A meta de três vídeos por dia é do **total futuro** da operação, não de cada conta.

---

## 1. Checklist operacional

### Antes de começar (uma vez)

- [ ] definir a linha editorial: nome, público, temas e o que ela **não** cobre;
- [ ] cadastrar a conta TikTok (nome, `@handle`, fuso);
- [ ] cadastrar a conta Instagram (nome, `@handle`, fuso);
- [ ] confirmar que as duas contas apontam para a mesma linha editorial;
- [ ] criar a árvore de pastas no Drive (botão *Copiar estrutura do Drive* → criar em
      `G:\Meu Drive\Projeto Automação de Vídeos\`);
- [ ] combinar a disponibilidade semanal de revisão (horas/semana e em quais dias).

### Por fonte (repetir até seis)

- [ ] cadastrar o **criador** com perfis oficiais e política pública de cortes;
- [ ] cadastrar a **autorização** com evidência anexada (§2);
- [ ] confirmar plataformas, monetização, território, validade, direito de editar,
      música, voz/imagem e possibilidade de revogação;
- [ ] obter o arquivo original — do titular ou por download nativo permitido;
      **não** burlar login, paywall, DRM ou bloqueio;
- [ ] salvar o original em `Fontes originais\<sourceId>\` e **nunca** sobrescrevê-lo;
- [ ] registrar o SHA-256 do original;
- [ ] cadastrar a **fonte** no Estúdio e vinculá-la à autorização;
- [ ] só então marcar a fonte como *Liberada*.

Se qualquer item ficar incerto: **quarentena**. Não processar, não publicar.

### Por corte (3–5 na primeira semana)

- [ ] marcar início e fim no corte (o Estúdio exige fim > início);
- [ ] escrever assunto, gancho e motivo editorial;
- [ ] gerar as duas variantes (uma por conta da linha);
- [ ] **decidir cada variante separadamente** — TikTok e Reels não são a mesma edição (§4);
- [ ] legendar e revisar o texto à mão (nomes, valores, datas e CTA são obrigatórios);
- [ ] conferir a área segura no preview do próprio aplicativo, não no editor;
- [ ] conferir que não há marca d'água de outra rede;
- [ ] revisar e **aprovar** cada variante (nenhuma publicação sem aprovação humana);
- [ ] exportar o pacote de publicação de cada variante;
- [ ] publicar/agendar pela ferramenta nativa da plataforma;
- [ ] colar o link real da postagem de volta no Estúdio.

### Medição (por publicação)

- [ ] registrar métricas em **1 h**, **24 h**, **7 d** e **30 d**;
- [ ] deixar em branco o que não foi medido — o Estúdio guarda `null` e mostra `—`;
      **nunca** digitar 0 para representar ausência;
- [ ] anotar minutos humanos gastos por corte;
- [ ] anotar se a variante foi aprovada na primeira revisão.

### Semanal

- [ ] revisar backlog (meta: abaixo de um dia);
- [ ] conferir espaço livre no Drive (meta: pelo menos 20%);
- [ ] revisar as autorizações que estejam perto do vencimento;
- [ ] uma hipótese testada por vez (§4), nunca duas ao mesmo tempo.

---

## 2. Modelos de cadastro

O Estúdio já tem os campos abaixo. Este é o roteiro do que **preencher** e do que
**anexar**, para o cadastro não virar teatro.

### 2.1 Criador

| Campo | O que registrar |
|---|---|
| Nome do criador/canal | nome público exato |
| Perfis oficiais | URLs dos perfis reais, um por linha |
| Contato | e-mail/telefone/@ usado para pedir a autorização |
| Política pública de cortes | texto ou link da política, se existir |

Cadastrar o criador **não autoriza nada**. Quem autoriza é a permissão.

### 2.2 Autorização (permissão)

| Campo | O que registrar | Bloqueia? |
|---|---|---|
| Tipo | autorização direta, programa de cortes, licenciado, domínio público | — |
| Titular dos direitos | quem realmente detém o direito (pode não ser o canal) | avisa |
| Evidência | texto da mensagem, descrição do print, trecho do contrato | **sim** para marcar Válida |
| Link da evidência | URL da política/postagem/documento | **sim** (texto ou link) |
| Concedida em | data | — |
| Válida até | data; vazio = sem prazo declarado | **sim** se vencida |
| Plataformas cobertas | TikTok e/ou Instagram | **sim** — sem marcar, não cobre nada |
| Monetização | permitida, proibida, não declarada | avisa |
| Território | onde vale | avisa |
| Status | não verificada / válida / vencida / revogada | **sim** — só *Válida* libera |
| Observações | limitações, o que o titular pediu | — |

Itens que o Estúdio **não** tem campo próprio e que devem ir em **Observações**, porque
são exatamente os que costumam invalidar um uso aparentemente autorizado:

- **direito de editar/cortar** — autorização para republicar não é autorização para editar;
- **música** — a trilha pode estar licenciada só para uma rede, ou só para o vídeo original;
- **voz e imagem de pessoas** — inclusive de convidados que não são o titular;
- **menores de idade** aparecendo;
- **sublicenciamento** — se você pode repassar a terceiros;
- **revogação** — como o titular pede a retirada e em quanto tempo você atende.

Modelo de pedido de autorização (adaptar; não é parecer jurídico):

```text
Olá, [nome]. Sou o Arthur, produzo cortes sobre [tema].
Gostaria de autorização para: recortar, editar e publicar trechos de [obra/episódio/live]
nas plataformas [TikTok e/ou Instagram], no território [Brasil / mundial],
[com | sem] monetização, [pelo prazo de X / por prazo indeterminado],
dando crédito como [forma de crédito].
Confirma que você é o titular dos direitos desse material, incluindo a trilha sonora
e a imagem/voz das pessoas que aparecem? Caso queira revogar depois, retiro em até
[X] dias após o aviso.
Pode responder confirmando por escrito? Vou guardar esta mensagem como comprovação.
```

Guardar a resposta em `Criadores e permissões\permissoes\<permissionId>\`.

### 2.3 Fonte

| Campo | O que registrar |
|---|---|
| Criador | o criador cadastrado |
| Autorização | a permissão que cobre **esta** fonte |
| Nome do material | título da live/episódio |
| Formato | live, podcast, outro |
| Episódio | número/identificação |
| Data encontrada | data |
| Link da origem | URL canônica |
| Link no Drive | pasta/arquivo do original |
| Duração | segundos |
| Situação | rascunho → direitos pendentes → **liberada** (ou bloqueada) |

O Estúdio recusa marcar *Liberada* sem autorização vinculada e válida.

### 2.4 Método de obtenção — portão separado

Registrar em Observações da fonte **como** o arquivo chegou:

- [ ] enviado pelo titular;
- [ ] download nativo que o criador habilitou;
- [ ] biblioteca licenciada, com comprovante salvo.

Ter direito autoral **não** significa que o método de captura respeita os termos da
plataforma. São dois portões independentes e ambos precisam passar.

---

## 3. Benchmark de legendas — preparado, não instalado

Decisão vigente: candidato principal `faster-whisper`, CPU INT8, modelo `small`; backup
Subtitle Edit 5 portátil com `whisper.cpp`; WhisperX adiado. **Nada será instalado antes
do corpus existir.**

### Passo 1 — corpus (depende de você)

Cerca de **10 minutos** de áudio PT-BR que você tenha direito de usar. Sugestão de
composição, para o resultado significar alguma coisa:

- ~4 min de fala limpa (microfone bom, um falante);
- ~3 min de áudio difícil (ruído de fundo, fala rápida, sobreposição);
- ~3 min com o vocabulário real do nicho: nomes próprios, números, marcas, siglas.

Fonte aceitável: **gravação sua**. Não usar material de terceiro para benchmark.

### Passo 2 — referência

Transcrever à mão os 10 minutos e revisar. Sem essa referência não existe medição — só
impressão.

### Passo 3 — medir (por motor)

| Métrica | Como |
|---|---|
| Tempo de execução | relógio, do início ao fim |
| Pico de RAM | Gerenciador de Tarefas durante a execução |
| WER | palavras erradas ÷ palavras da referência |
| Erros de nome/número | contagem absoluta (peso alto: um CNPJ errado é grave) |
| Desvio de sincronização | maior atraso/adiantamento observado, em segundos |

Registrar versão, origem e SHA-256 de cada componente baixado.

### Passo 4 — metas internas

São **metas do projeto**, não promessas do fornecedor:

- WER ≤ 12% em fala limpa;
- WER ≤ 20% em áudio difícil;
- 100% de revisão humana de nomes, valores, datas e CTA — independente do WER.

Comparar `small` com `medium` **só** se `small` não bater a meta. Se `small` passar, a
comparação é tempo desperdiçado.

---

## 4. TikTok e Instagram são decisões separadas

O corte mestre pode ser o mesmo. A variante **não é cópia**.

| | TikTok | Instagram Reels |
|---|---|---|
| Abertura | mais rápida e abrupta | contexto claro em até ~2 s |
| Linguagem | direta | um pouco mais explicada |
| Teste inicial de duração | 15–35 s e 35–60 s | 20–45 s e 45–90 s |
| Capa | não se aplica | capa própria, pensada para a grade |
| Foco métrico | tempo assistido, conclusão, compartilhamentos, favoritos | alcance, tempo médio, salvamentos, compartilhamentos, seguidores |
| Cuidado obrigatório | sem marca d'água de outra rede | revisar enquadramento e área segura |
| Áudio e CTA | próprios | próprios |

Uma hipótese por experimento. Mudar duração **e** gancho ao mesmo tempo não ensina nada.

---

## 5. Quando parar de crescer — e quando crescer

Só ampliar volume ou abrir a segunda linha editorial quando **todos** forem verdadeiros:

- zero publicações sem aprovação humana;
- 100% das fontes publicadas com prova de autorização;
- ≥95% dos jobs concluídos sem correção técnica;
- ≥90% das variantes aprovadas na primeira revisão;
- backlog abaixo de um dia;
- armazenamento com pelo menos 20% livre;
- métricas completas em ≥90% dos posts;
- nenhuma violação de direitos ou de termos;
- ganho mensurável em retenção, compartilhamentos ou salvamentos numa coorte comparável
  (mínimo de 20 posts).

Um único vídeo viral **não** prova que o processo funciona.

---

## 6. O que depende de decisão ou material seu

Nada abaixo pode ser resolvido por código.

| # | Pendência | Sem isso… |
|---|---|---|
| 1 | Qual é a linha editorial piloto (nome, público, temas) | não dá para cadastrar contas nem cortes |
| 2 | Os dois `@handle` (TikTok e Instagram), ou aviso de que serão criados | o destino fica ambíguo e o caminho no Drive não fecha |
| 3 | As seis fontes autorizadas + prova de cada autorização | o piloto não começa; não vou buscar nem baixar mídia de terceiro |
| 4 | Confirmação por fonte: plataformas, monetização, território, validade, edição, música, voz/imagem, revogação | a autorização não pode ser marcada como Válida |
| 5 | Disponibilidade semanal de revisão | não dá para dimensionar 3–5 posts/semana |
| 6 | ~10 min de áudio PT-BR **seu** para o corpus | o benchmark de legendas não roda e nada será instalado |
| 7 | Aprovação explícita para instalar o motor de legenda escolhido | nenhuma dependência nova entra |
| 8 | Decisão sobre o calendário F1.3 (só quando houver ~20 posts agendados) | fica adiado, como está |
| 9 | Decisão sobre Fase 3 / APIs (go/no-go da semana 12) | segue manual, como está |

Enquanto 1–5 não chegarem, a próxima tarefa técnica segura é o corpus (item 6) e, depois,
o trabalhador local conforme `CONTRATO_TRABALHADOR.md`.
