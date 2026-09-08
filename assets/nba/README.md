# assets/nba/ — Logos dos times da NBA

Coloque aqui os **logos dos 30 times da NBA**, um arquivo por time.

## Regras de nome de arquivo (importante)
- Nome = **sigla do time em minúsculas** + `.png`.
- Ex.: Washington Wizards → `was.png`, Los Angeles Lakers → `lal.png`.
- Formato recomendado: **PNG com fundo transparente**, ~200×200px (quadrado).
- Se o arquivo de um time não existir, o site cai automaticamente num
  "monograma" colorido (a sigla sobre a cor do time) — nada quebra.

## Lista completa (30 arquivos)

### Conferência Leste (East)
| Arquivo | Time | Divisão |
| --- | --- | --- |
| `atl.png` | Atlanta Hawks | Southeast |
| `bos.png` | Boston Celtics | Atlantic |
| `bkn.png` | Brooklyn Nets | Atlantic |
| `cha.png` | Charlotte Hornets | Southeast |
| `chi.png` | Chicago Bulls | Central |
| `cle.png` | Cleveland Cavaliers | Central |
| `det.png` | Detroit Pistons | Central |
| `ind.png` | Indiana Pacers | Central |
| `mia.png` | Miami Heat | Southeast |
| `mil.png` | Milwaukee Bucks | Central |
| `nyk.png` | New York Knicks | Atlantic |
| `orl.png` | Orlando Magic | Southeast |
| `phi.png` | Philadelphia 76ers | Atlantic |
| `tor.png` | Toronto Raptors | Atlantic |
| `was.png` | Washington Wizards | Southeast |

### Conferência Oeste (West)
| Arquivo | Time | Divisão |
| --- | --- | --- |
| `dal.png` | Dallas Mavericks | Southwest |
| `den.png` | Denver Nuggets | Northwest |
| `gsw.png` | Golden State Warriors | Pacific |
| `hou.png` | Houston Rockets | Southwest |
| `lac.png` | LA Clippers | Pacific |
| `lal.png` | Los Angeles Lakers | Pacific |
| `mem.png` | Memphis Grizzlies | Southwest |
| `min.png` | Minnesota Timberwolves | Northwest |
| `nop.png` | New Orleans Pelicans | Southwest |
| `okc.png` | Oklahoma City Thunder | Northwest |
| `phx.png` | Phoenix Suns | Pacific |
| `por.png` | Portland Trail Blazers | Northwest |
| `sac.png` | Sacramento Kings | Pacific |
| `sas.png` | San Antonio Spurs | Southwest |
| `uta.png` | Utah Jazz | Northwest |

> A relação completa (sigla, conferência, divisão, cor) vive em `nba-teams.js`
> (`window.NBA.teams`). É de lá que o seletor "torcer por 2 times" e o
> "Round Start" leem o caminho do logo: `assets/nba/<sigla>.png`.
