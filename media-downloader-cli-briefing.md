# Briefing — CLI de download de mídia

Documento de contexto para iniciar o projeto em outra sessão.

## Objetivo

CLI instalável globalmente que recebe uma URL de qualquer plataforma de mídia
(YouTube, Twitter/X, TikTok, Instagram Reels, Facebook, Pinterest, etc.),
detecta a origem, baixa o conteúdo e salva num diretório escolhido.
Conversão para mp3 quando o alvo for áudio.

Objetivo secundário: aprender como funcionam parsing, scraping e CLIs.
Não é para uso comercial nem redistribuição de conteúdo.

## Stack

- TypeScript + Node.js (>= 20)
- `commander` — parsing de argumentos
- `@inquirer/prompts` — modo interativo
- `chalk` / `ora` — output no terminal
- `zod` — validação de config e input
- `execa` — subprocessos (melhor que `child_process` cru)
- `puppeteer` ou `playwright` — só onde for necessário
- `cheerio` — parsing de HTML estático

Binários externos (não são libs npm, precisam estar no PATH):
- `yt-dlp` — extrator de vídeo
- `ffmpeg` — conversão/merge
- `gallery-dl` — extrator de galerias de imagem

## Decisão de arquitetura importante

A maior parte do trabalho pesado **já está resolvida** por dois projetos
maduros. Escrever parser próprio para cada site é retrabalho e quebra toda
semana quando a plataforma muda o HTML.

- `yt-dlp` já suporta YouTube, Twitter/X, TikTok, Instagram, Facebook,
  Reddit, Twitch e ~1800 outros sites.
- `gallery-dl` já suporta Pinterest, Imgur, Tumblr, DeviantArt e afins.

Portanto o projeto **não é um scraper** — é uma **camada de orquestração**:
roteamento por domínio, configuração de destino, UX de terminal, fila de
downloads, tratamento de erro, e adapters próprios apenas para sites que
nenhuma das duas ferramentas cobre.

Isso é honesto sobre o que o projeto é, e ainda assim tem trabalho real:
detecção de origem, design de CLI, parsing de progresso de subprocesso,
sistema de configuração, e adapters custom.

## Arquitetura proposta

```
src/
  cli/
    index.ts              # entrypoint, registro de comandos
    commands/
      download.ts
      config.ts
  core/
    router.ts             # URL -> adapter
    result.ts             # Result<T, E> / ok() / fail()
    config.ts             # ~/.config/<nome>/config.json via zod
  adapters/
    types.ts              # interface Adapter
    ytdlp.adapter.ts      # wrapper sobre yt-dlp
    gallerydl.adapter.ts  # wrapper sobre gallery-dl
    custom/
      <site>.adapter.ts   # scraping próprio, só quando necessário
  services/
    binary.service.ts     # detecta se yt-dlp/ffmpeg existem
    progress.service.ts   # parse do stdout -> barra de progresso
    fs.service.ts         # resolução de path, colisão de nome, sanitização
```

### Interface do adapter

```ts
interface Adapter {
  name: string;
  matches(url: URL): boolean;
  download(url: URL, opts: DownloadOptions): Promise<Result<DownloadedFile[]>>;
}
```

O router percorre os adapters em ordem de prioridade; custom adapters vêm
antes dos genéricos. Fallback final: tentar `yt-dlp` mesmo assim.

### Fluxo

```
URL -> validação (zod) -> router -> adapter -> subprocesso/scraper
    -> stream de progresso -> fs.service -> log final
```

## Conceitos a documentar durante o desenvolvimento

- **Parser**: transforma um formato (HTML, JSON) em estrutura de dados usável.
- **Scraping estático**: `fetch` + `cheerio`. Rápido, mas só funciona se o
  conteúdo vem no HTML inicial.
- **Browser automation**: Puppeteer/Playwright. Executa o JS da página.
  Necessário para SPAs e conteúdo lazy-loaded (Pinterest infinite scroll).
- **Por que a maioria dos sites modernos exige a segunda opção**: o HTML
  inicial é um shell vazio; os dados chegam por XHR depois.
- **Atalho frequentemente ignorado**: em vez de automatizar o browser, dá
  para inspecionar a aba Network, achar o endpoint XHR que a própria página
  chama, e consumir esse JSON diretamente. Mais rápido e mais estável.

## Fases

**Fase 1 — fundação**
- Setup TS + build + `bin` no package.json + `npm link`
- `Result` type e tratamento de erro
- Detecção de binários com mensagem clara se faltar
- Adapter `yt-dlp` com flags de qualidade e `-x --audio-format mp3`
- Router com 2-3 domínios

**Fase 2 — UX**
- Modo interativo (sem args = prompts)
- Config persistida: pasta padrão por tipo de mídia
- Barra de progresso a partir do stdout do yt-dlp
- `--output`, `--format`, `--audio-only`, `--quality`

**Fase 3 — cobertura**
- Adapter `gallery-dl` (Pinterest, galerias)
- Batch: aceitar arquivo .txt com múltiplas URLs
- Fila com concorrência limitada

**Fase 4 — custom**
- Adapter próprio para um site não coberto, usando a técnica de endpoint XHR
- Rate limiting e retry com backoff

## Restrições e postura

- Uso pessoal, volume baixo. Não é ferramenta de raspagem em massa.
- Respeitar `robots.txt` e rate limits; delay entre requests.
- Não implementar bypass de DRM, paywall ou captcha.
- Não redistribuir o conteúdo baixado.
- Preferir API oficial sempre que existir.

## Pontos a decidir

1. Nome do binário.
2. Puppeteer vs Playwright (Playwright tem API melhor; Puppeteer é mais leve).
3. Distribuir via npm público, ou apenas `npm link` local.
4. Bundle (tsup/esbuild) ou `tsc` puro.
