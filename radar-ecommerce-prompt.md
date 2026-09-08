# Agente Radar E-commerce — rotina de sábado

Você está no projeto do site do vendedor (`C:\Users\Teste\Downloads\Seller-Arthur`).
Sua ÚNICA tarefa: pesquisar na web as notícias da semana do mundo do e-commerce e
reescrever o arquivo `ecommerce-news-data.js`. **Não toque em nenhum outro arquivo.**

## Pesquisa

Faça 4 a 6 buscas (WebSearch), em português e inglês, cobrindo a última semana:

- Amazon (Brasil e global): taxas FBA, Prime Day e outros eventos, políticas de seller, logística
- Mercado Livre, Shopee, TikTok Shop: novidades, taxas, eventos
- E-commerce brasileiro: regulação (ex. taxação de importados), dados de mercado
- Eventos promocionais dos próximos ~60 dias no Brasil (Prime Day, Dia dos Pais, etc.)

Regras rígidas:
- Não invente NADA. Só inclua item com URL real vinda dos resultados de busca.
- Fontes preferidas: E-Commerce Brasil, Mercado&Consumo, Exame, Valor, about.amazon.com.br, Reuters, CNBC, Marketplace Pulse, EcommerceBytes.
- 6 a 9 notícias, ordenadas da mais importante para a menos (importância = impacto para um seller Amazon FBA brasileiro que também vende em Mercado Livre, Shopee e TikTok Shop).
- Em `events`, só datas confirmadas por fonte real, dentro dos próximos 60 dias.

## Gravação

Reescreva `ecommerce-news-data.js` EXATAMENTE neste formato (JS válido, UTF-8),
preservando o comentário de cabeçalho que já existe no arquivo:

```js
window.ECOM_NEWS = {
  updatedAt: "YYYY-MM-DD",   // data de hoje
  items: [
    {
      tag: "Amazon",         // ou: Mercado Livre | Shopee | TikTok Shop | Mercado | Regulação | Logística
      title: "título em português, máx ~90 caracteres",
      url: "https://...",
      source: "nome da fonte",
      date: "YYYY-MM-DD",    // data real da notícia
      summary: "resumo factual de 1-2 frases em português",
      impact: "1 frase: o que muda para um seller FBA multi-marketplace"
    }
  ],
  events: [
    { date: "YYYY-MM-DD", name: "nome do evento comercial" }
  ]
};
```

Depois de gravar, valide com `node --check ecommerce-news-data.js`. Se falhar,
corrija até passar. Não faça commit, não altere o index.html, não crie arquivos novos.
