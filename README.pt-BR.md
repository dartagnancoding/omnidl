# omnidl

CLI de download de mídia. Cole uma URL do YouTube, Twitter/X, TikTok, Instagram, Pinterest (e ~1800 outros sites) e ela detecta a origem, escolhe a ferramenta certa e salva o arquivo num diretório configurado.

> **O que isto é (e não é).** O projeto é uma **camada de orquestração**, não um scraper. O trabalho pesado é feito por duas ferramentas maduras — [yt-dlp](https://github.com/yt-dlp/yt-dlp) (vídeo) e [gallery-dl](https://github.com/mikf/gallery-dl) (galerias/boards de imagem). O omnidl adiciona roteamento por domínio, config de destino, UX de terminal, parsing de progresso e fila de batch. Uso pessoal apenas — sem bypass de DRM/paywall, sem raspagem em massa, sem redistribuição.

*Read in English: [README.md](README.md)*

## Pré-requisitos

- Node.js >= 20
- Binários externos no PATH (rode `omnidl doctor` para checar):
  - `yt-dlp` — `winget install yt-dlp.yt-dlp`
  - `ffmpeg` — `winget install Gyan.FFmpeg` (necessário para conversão em mp3)
  - `gallery-dl` — `winget install mikf.gallery-dl`

## Instalação

O omnidl não está publicado no npm. Instale a partir do código:

```sh
git clone https://github.com/dartagnancoding/omnidl.git
cd omnidl
npm install     # também gera o dist/ (script prepare)
npm link        # torna `omnidl` disponível globalmente
omnidl doctor   # verifica os binários externos
```

O `npm link` aponta o comando global `omnidl` para **esta pasta**. Se você
mover ou renomear a pasta, rode `npm link` de novo no novo lugar.

Para atualizar: `git pull && npm install && npm run build`.

Para desinstalar: `npm unlink -g omnidl`.

## Uso

### Menu interativo

Rode `omnidl` sem argumentos para abrir um menu: baixar mídia, mudar as
pastas padrão de destino (vídeo/áudio/imagem) ou checar a instalação — sem
precisar decorar flag nenhuma. O fluxo de download pergunta mp4 ou mp3, a
qualidade, e mostra a pasta padrão configurada (editável naquele download).

```sh
omnidl
```

### Direto / scriptável

```sh
# Vídeo (padrão: melhor qualidade, salvo no videoDir configurado)
omnidl "https://www.youtube.com/watch?v=..."

# Só áudio, convertido para mp3
omnidl "https://www.youtube.com/watch?v=..." --audio-only

# Limitar a resolução
omnidl "https://x.com/user/status/..." -q 720

# Pin do Pinterest ou board inteiro (passa pelo gallery-dl)
omnidl "https://br.pinterest.com/usuario/minha-pasta/"

# Instagram e X/Twitter hoje exigem sessão logada para baixar vídeo, até
# em posts públicos. Reusa os cookies de sessão do seu browser:
omnidl "https://x.com/usuario/status/..." --cookies-from-browser chrome
# Zen Browser (fork do Firefox) é detectado automaticamente, sem precisar
# informar o caminho do perfil:
omnidl "https://www.instagram.com/reel/..." --cookies-from-browser zen

# Deixa salvo como padrão pra não precisar passar a flag toda vez:
omnidl config set cookiesFromBrowser zen

# Batch: uma URL por linha, '#' para comentários; concorrência limitada
omnidl -b urls.txt -c 3

# Modo interativo: rode sem argumentos
omnidl
```

### Comandos

| Comando | Descrição |
|---|---|
| `omnidl [url]` | Baixa (comando padrão; abre o menu se a URL for omitida) |
| `omnidl config list\|get\|set\|path` | Gerencia as configurações salvas |
| `omnidl doctor` | Verifica se yt-dlp, ffmpeg e gallery-dl estão instalados |
| `omnidl claude [pasta]` | Abre o Claude Code numa pasta (padrão: pasta atual) |

### Opções

| Flag | Descrição |
|---|---|
| `-o, --output <dir>` | Diretório de destino (sobrepõe a config) |
| `-a, --audio-only` | Extrai o áudio e converte para mp3 |
| `-q, --quality <q>` | Altura máxima do vídeo: `best`, `1080`, `720`, `480`, `360` |
| `-f, --format <fmt>` | Expressão de formato crua do yt-dlp (sobrepõe `--quality`) |
| `-b, --batch <file>` | Arquivo de texto com uma URL por linha |
| `-c, --concurrency <n>` | Downloads paralelos no modo batch |
| `--cookies-from-browser <browser>` | Lê cookies de sessão do `chrome`, `firefox`, `edge`, `zen`, ... |

### Configuração

Persistida em `~/.config/omnidl/config.json`:

```sh
omnidl config list
omnidl config set videoDir "D:\Media\Videos"
omnidl config set concurrency 3
omnidl config path
```

| Chave | Padrão | Significado |
|---|---|---|
| `videoDir` | `~/Downloads/omnidl/video` | Destino de vídeo |
| `audioDir` | `~/Downloads/omnidl/audio` | Destino de mp3 |
| `imageDir` | `~/Downloads/omnidl/images` | Destino de galerias/pins |
| `concurrency` | `2` | Paralelismo do batch (1–8) |
| `cookiesFromBrowser` | *(nenhum)* | Browser padrão para cookies de sessão (`chrome`, `firefox`, `edge`, `zen`, ...) |

## Arquitetura

```
URL -> validação -> router -> adapter -> subprocesso -> stream de progresso -> arquivos salvos
```

- `src/core/router.ts` — mapeia URL para adapter por domínio; domínios desconhecidos caem no fallback yt-dlp (ele suporta muito mais sites do que dá para enumerar).
- `src/adapters/` — interface `Adapter` + wrappers sobre yt-dlp e gallery-dl. Adapters custom (Fase 4) entram na frente dos genéricos.
- `src/services/` — detecção de binários com dicas de instalação, parsing do progresso do stdout do yt-dlp, helpers de filesystem e o pool de concorrência.
- `src/core/result.ts` — `Result<T, E>` para falhas esperadas; exceções continuam excepcionais.

## Desenvolvimento

```sh
npm run dev     # tsc --watch
npm test        # testes unitários com vitest (router, parser de progresso, helpers de fs)
```

## Problemas comuns

| Sintoma | Causa / solução |
|---|---|
| `Error: Cannot find module ...\node_modules\omnidl\dist\cli\index.js` | O link global aponta para uma pasta que mudou de lugar ou foi apagada. Rode `npm link` de novo na pasta do projeto. |
| `omnidl` não é reconhecido | O `npm link` nunca foi rodado, ou a pasta global do npm (`npm config get prefix`) não está no PATH. |
| Download do Instagram / X falha | Eles exigem sessão logada: use `--cookies-from-browser <browser>`. |
| `Requested format is not available` | Atualize o yt-dlp (`yt-dlp -U` ou `winget upgrade yt-dlp.yt-dlp`). Os sites mudam com frequência. |

## Aviso legal

Ferramenta de uso pessoal. Você é responsável por respeitar os termos de uso
de cada site e os direitos autorais do que baixar. O omnidl não contorna DRM
nem paywall.

## Licença

[MIT](LICENSE)

## Roadmap

Implementado: Fases 1–3 do briefing (fundação, UX, cobertura). Pendente (Fase 4): adapter custom para um site não coberto usando a técnica de endpoint XHR, além de rate limiting e retry com backoff. Veja [media-downloader-cli-briefing.md](media-downloader-cli-briefing.md).
