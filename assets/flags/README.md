# assets/flags/ — Bandeiras das seleções (Copa)

Coloque aqui as **bandeiras das seleções** que estão jogando a Copa.

## Regras de nome de arquivo (importante)
- Nome = **sigla FIFA da seleção em minúsculas** (3 letras) + `.png`.
- Ex.: Brasil → `bra.png`, Argentina → `arg.png`, França → `fra.png`,
  Portugal → `por.png`, Estados Unidos → `usa.png`.
- Formato recomendado: **PNG**, proporção ~4:3 (ex.: 120×90px).
- Se a bandeira de uma seleção não existir aqui, o site tenta a bandeira
  pública da ESPN; se também falhar, mostra só o nome — nada quebra.

## Como o site escolhe o arquivo
O placar da Copa (`copa-score.js`) lê a sigla da seleção direto da API da ESPN
e procura `assets/flags/<sigla>.png`. Então basta nomear o arquivo com a sigla
de 3 letras da seleção, em minúsculas.

## Siglas FIFA comuns (referência rápida)
| Arquivo | Seleção |
| --- | --- |
| `bra.png` | Brasil |
| `arg.png` | Argentina |
| `fra.png` | França |
| `eng.png` | Inglaterra |
| `esp.png` | Espanha |
| `ger.png` | Alemanha |
| `por.png` | Portugal |
| `ned.png` | Holanda |
| `usa.png` | Estados Unidos |
| `mex.png` | México |
| `uru.png` | Uruguai |
| `cro.png` | Croácia |
| `bel.png` | Bélgica |
| `ita.png` | Itália |
| `jpn.png` | Japão |
| `kor.png` | Coreia do Sul |
| `mar.png` | Marrocos |
| `sen.png` | Senegal |

> Não precisa ser exatamente esta lista — vale qualquer seleção da Copa atual.
> O importante é o **nome do arquivo = sigla de 3 letras em minúsculas**.
