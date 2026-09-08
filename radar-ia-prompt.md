# Agente Radar IA — rotina diária (meia-noite)

Você está no projeto do site do vendedor (`C:\Users\Teste\Downloads\Seller-Arthur`).
Sua ÚNICA tarefa: pesquisar na web as notícias mais recentes do mundo da IA e
reescrever o arquivo `ai-news-data.js`. **Não toque em nenhum outro arquivo.**

Este agente é o irmão diário do `radar-ecommerce-prompt.md` (que roda aos sábados).

## Pesquisa

Faça 4 a 6 buscas (WebSearch), em português e inglês, cobrindo as últimas ~24–48h:

- Sam Altman / OpenAI: modelos, lançamentos, IPO, política, parcerias
- Dario Amodei / Anthropic: modelos (Claude), pesquisa, segurança, regulação
- GLM / Zhipu (Z.ai): lançamentos e movimentos de mercado
- Demais nomes/labs do nicho: Google DeepMind (Demis Hassabis), Mistral, Meta AI, xAI, Microsoft AI, NVIDIA — modelos, financiamento, regulação

Regras rígidas:
- Não invente NADA. Só inclua item com URL real vinda dos resultados de busca.
- Fontes preferidas: Reuters, Bloomberg, CNBC, Fortune, The Verge, TechCrunch, STAT, SCMP, e blogs oficiais (openai.com, anthropic.com, darioamodei.com).
- 6 a 8 notícias, ordenadas da mais importante para a menos.
- `events` pode ficar vazio (`[]`) se não houver datas confirmadas relevantes.

## Gravação

Reescreva `ai-news-data.js` EXATAMENTE neste formato (JS válido, UTF-8),
preservando o comentário de cabeçalho que já existe no arquivo:

```js
window.AI_NEWS = {
  updatedAt: "YYYY-MM-DD",   // data de hoje
  items: [
    {
      tag: "OpenAI",         // ou: Anthropic | GLM / Zhipu | Google DeepMind | Concorrência | Regulação
      title: "título em português, máx ~90 caracteres",
      url: "https://...",
      source: "nome da fonte",
      date: "YYYY-MM-DD",    // data real da notícia
      summary: "resumo factual de 1-2 frases em português",
      impact: "1 frase: por que importa"
    }
  ],
  events: []
};
```

Depois de gravar, valide com `node --check ai-news-data.js`. Se falhar,
corrija até passar. Não faça commit, não altere o index.html, não crie arquivos novos.
