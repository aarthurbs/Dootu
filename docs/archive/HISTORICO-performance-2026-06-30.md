# Histórico — Auditoria de performance 2026-06-30 (arquivado 2026-09-04)

> Texto VERBATIM do `CLAUDE.md` (linhas 342-349). Trabalho CONCLUÍDO: as
> otimizações já estão aplicadas no repositório. As regras que nasceram desta
> auditoria viraram BP-005 e BP-006, que continuam no `CLAUDE.md`.

# Performance (Carregamento e Render) — auditoria 2026-06-30
Otimizações aplicadas (cirúrgicas, sem alterar regra de negócio; ~5.3 MB + 3 requests fora do caminho crítico inicial):
- **Imagens de fundo recomprimidas** (Pillow q80, dimensões preservadas, originais com backup): `assets/capa-bg.jpg` 2.0MB→187KB · `assets/capa-sidebar.jpg` 2.5MB→211KB · `assets/themes/brasil/{bg,sidebar}.jpg` reduzidas. Total dos fundos **5.4MB→0.7MB (−88%)**.
- **`xlsx-populate.min.js` (642KB) virou lazy-load:** removido o `<script>` síncrono; helper `ensureXlsx()` no topo do script inline injeta a lib sob demanda; `await ensureXlsx()` antes dos 3 usos (`fatLoadFile`, `fatWriteRecords`, `fatWriteGroupedRecords`). Só carrega ao usar o Faturador.
- **CSS `transition: all` (16×) → propriedades específicas** (`background-color, border-color, color, box-shadow, transform, opacity`), preservando `var(--ease)`/`var(--ease-spring)` (cumpre a regra Emil, §5).
- **`supabase-*.js` retirados do carregamento (backend PAUSADO):** os 3 `<script>` ficam comentados em `index.html` (~L2935) com a receita de reativação inline; **arquivos mantidos no repo**.
- **Mantido de propósito:** `backdrop-filter`/`blur` (visual "vidro premium"); arquivos órfãos **não carregados** (`Copa.js`, `CAPA-DE-FUNDO.png`, `copa-score.js`, `wizards-score.js`, `fba-shipments.js`) — removê-los não muda o load. **Reorg 2026-07-14:** os `.js` órfãos foram movidos p/ `arquivo/` e os docs (`ARQUITETURA.md`, `CONVERSAS.md`, `PROCESSO-FBA-ENVIOS.md`, `resumo-chat-cyberlab.md`) p/ `docs/`. Nada carregado/agendado saiu da raiz — site e radares intactos.

