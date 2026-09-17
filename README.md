<p align="center">
  <img src="./icon-192.png" width="112" alt="OmniTreco" />
</p>

<h1 align="center">🛠️ OmniTreco</h1>

<p align="center"><strong>Seu navegador ganhou poderes.</strong></p>

<p align="center">
  Um multi-tool local-first e browser-first que transforma arquivos,<br />
  sensores e dispositivos ao seu redor em peças de uma mesma ferramenta.
</p>

<p align="center">
  <a href="#por-que-omnitreco">Por quê</a> ·
  <a href="#as-quatro-superfícies">Superfícies</a> ·
  <a href="#omnitreco-vê-ouve-lê">Capacidades</a> ·
  <a href="#local-first-na-prática">Local-first</a> ·
  <a href="#replicabilidade">Replicabilidade</a> ·
  <a href="./EMPOWER_NOT_REPLACE.md">Princípios</a> ·
  <a href="./LICENSE">Licença</a>
</p>

---

> **OmniTreco vê. OmniTreco ouve. OmniTreco lê.**

O OmniTreco não tenta transformar cada pequena tarefa em uma ida a um serviço remoto.

Ele parte de outra pergunta:

> **o que o navegador e os aparelhos que você já tem conseguem fazer por você, aqui e agora?**

Quando a resposta pode continuar no dispositivo, continua no dispositivo.

Quando outro aparelho pode virar uma ferramenta — uma superfície de assinatura, uma câmera para capturar cor, um controle de apresentação — ele vira parte do mesmo instrumento.

Esse é o encontro entre a personalidade do OmniTreco e o princípio da Nomos Ludens:

> **Empower, not replace.**

## Por que OmniTreco

Boa parte das tarefas digitais pequenas acaba terceirizada para serviços diferentes: subir um arquivo para inspecionar, mandar uma imagem para extrair texto, usar um site para gerar hash, instalar um aplicativo só para usar um sensor, enviar um áudio para uma API de transcrição.

O OmniTreco tenta devolver esse repertório ao usuário.

Ele usa capacidades do navegador, processamento local, APIs do dispositivo e conexão P2P para transformar o ambiente ao redor em uma bancada digital.

> **O OmniTreco transforma os aparelhos ao seu redor em peças de um único aparelho.**

A regra de produto é simples:

> **Se o navegador consegue fazer, o servidor não toca no arquivo.**

Infraestrutura remota existe quando há uma razão operacional concreta — como sinalização WebRTC, autenticação ou entrega inicial de assets de software — e não como destino automático do conteúdo do usuário.

## As quatro superfícies

| Superfície | Pergunta mental | O que oferece |
|---|---|---|
| **🪄 Bancada** | “Tenho uma coisa.” | arquivos, mídia, inspeção, OCR, hashes, receitas, pastas |
| **🌀 Outro aparelho** | “Preciso de outro dispositivo.” | Teleporte P2P e poderes remotos |
| **📱 Trecos** | “Quero usar os recursos deste aparelho.” | sensores, câmera, microfone, utilidades físicas |
| **🧰 Bolso** | “Preciso de uma ferramenta rápida.” | geradores, conversores, cálculos e pequenos utilitários |

### 🪄 Bancada

Superfície para receber e processar objetos soltos:

- **Arquivos & mídia** — imagens, PDFs, áudio, vídeos, textos e URLs.
- **Inspeção** — metadados, hashes SHA-256 e visualização de diffs.
- **AutoFix & receitas** — correção de formatação e pipelines de manipulação de texto.
- **Pastas** — análise local, duplicados reais por SHA-256 e snapshots de estrutura.
- **Capacidades contextuais** — OCR, QR/barcodes, transcrição local e Teleporte P2P.

### 🌀 Outro aparelho

Quando o melhor periférico é um aparelho que já está perto:

- **Teleporte P2P** — transferência direta via WebRTC DataChannel.
- **Assinatura remota** — assine com o dedo no celular e receba o vetor SVG no computador.
- **Captura de cor** — use a câmera de outro aparelho para estimar HEX/RGB/HSL.
- **Presenter** — transforme outro dispositivo em controle de slides com timer e ponteiro.

### 📱 Trecos

Utilidades construídas a partir das capacidades do dispositivo atual:

- 👆 **DEDOS** — escolha aleatória multitouch.
- 📐 **NÍVEL** — nível de bolha com giroscópio.
- 🪞 **ESPELHO** — câmera frontal com iluminação.
- 🔊 **BARULHO** — medidor relativo via microfone.
- 🐕 **PET** — tradutor festivo de som de pet.
- 📞 **CHAMADA** — simulação de chamada recebida.
- 💩 **TRONO** — calculadora de tempo e valor acumulado.
- 🎛️ **SONS** — soundboard.
- 🚨 **STROBE** — sinalizador e Morse.
- 🎲 **MENTIRAS** — detector recreativo de mentiras.

### 🧰 Bolso

Ferramentas pequenas que não deveriam exigir um aplicativo inteiro:

- 🎻 **Tiny Violin**
- 🔑 UUID v4, senhas fortes e SHA-256
- 🔤 Base64 e normalização de espaços
- 📊 regra de três e diff visual de texto

## OmniTreco vê. Ouve. Lê.

### 👁️ Vê

- **OCR local** com Tesseract.js em Web Worker.
- **QR Codes** com jsQR.
- **Barcodes 1D** via BarcodeDetector quando disponível.
- O conteúdo da imagem permanece no dispositivo; assets e idiomas podem ser baixados sob demanda.

### 🎙️ Ouve

- **Transformers.js + ONNX Runtime Web** para inferência local.
- Arquitetura **Whisper Tiny Multilingual** via Xenova/whisper-tiny.
- Áudio convertido localmente para PCM mono 16 kHz e processado via WASM/ONNX.
- Modelo baixado sob demanda e cacheado localmente.
- **Zero fallback remoto para áudio ou transcrição.**

### 🔊 Lê

- Síntese de voz via `window.speechSynthesis`.
- Política estrita de uso apenas de vozes em que `voice.localService === true`.

## Teleporte P2P

Arquivos e dados trafegam diretamente entre navegadores via **WebRTC DataChannel**.

A infraestrutura de sinalização — Cloudflare Workers + Durable Objects — troca SDP/ICE candidates, mas não transporta o conteúdo dos arquivos.

O pareamento pode ser feito por QR Code ou código curto de sala.

## Local-first na prática

> **Local-first. Seus dados ficam com você.**

| Operação | Onde acontece |
|---|---|
| OCR e visão | RAM do navegador |
| STT | WASM/ONNX local |
| TTS | síntese instalada no dispositivo |
| Teleporte | P2P entre navegadores |
| Assets de software | podem ser baixados e cacheados |
| Sinalização / identidade | infraestrutura remota quando necessária |

O princípio não é “nunca usar servidor”.

É **não centralizar sem motivo**.

## Arquitetura

```
Browser / PWA
│
├── 🪄 Bancada
│   ├── Inspector Engine
│   ├── Folder Inspector
│   ├── AutoFixer & Recipe Pipeline
│   ├── Vision Engine
│   └── Hearing Engine
│
├── 🌀 Outro aparelho
│   ├── WebRTC P2P Teleport
│   └── MacGyver Remote Powers
│
├── 📱 Trecos
└── 🧰 Bolso

Infraestrutura de apoio, quando necessária:
├── Cloudflare Worker / Durable Object
└── Backend de identidade
```

## Filosofia do produto real

No OmniTreco, teste automatizado não é sinônimo de funcionamento físico.

Usamos três níveis de evidência:

| Nível | Significa |
|---|---|
| **STATIC_PASS** | código compila, lint e sintaxe estão corretos |
| **BROWSER_AUTOMATION_PASS** | fluxo passou em automação controlada |
| **PHYSICAL_PASS** | uma pessoa validou o comportamento em hardware real |

Isso é especialmente importante em recursos que dependem de toque, câmera, microfone, sensores e alto-falante.

## Estado do projeto

O estado funcional e arquitetural publicado parte de uma baseline homologada.

- **Baseline histórico homologado:** `264e2135cdef53556f3d75e3a1e38918fbafa6fb`
- Referência: 2026-09-02.
- Alterações posteriores não são automaticamente homologadas.

```ini
PRODUCT_ARCHITECTURE = FROZEN
FOUR_SURFACE_UX = FROZEN
TELEPORT_CORE = FROZEN
SENSORY_LAYER_IMPLEMENTATION = FROZEN
SENSORY5_FUNCTIONAL_FREEZE = ACCEPTED
IPHONE_SENSORY_ACCEPTANCE = USER_PHYSICAL_VALIDATION_PENDING
```

## Auditoria de terceiros

A auditoria de versões, hashes e licenças está em [THIRD_PARTY.md](./THIRD_PARTY.md).

Principais componentes:

- **Tesseract.js 5.1.0** — Apache-2.0
- **jsQR 1.4.0** — Apache-2.0
- **Transformers.js 2.17.2 / ONNX Runtime Web** — MIT
- **OpenAI Whisper architecture** — MIT
- **Xenova/whisper-tiny ONNX distribution** — Apache-2.0

## Replicabilidade

Esta é uma distribuição pública sanitizada. Ela não aponta para a infraestrutura de produção da Nomos Ludens.

| Classificação | Componentes | O que é necessário |
|---|---|---|
| **BUILD_REPRODUCIBLE** | frontend, Worker Cloudflare, Durable Object | verificações locais e dry-run sem dependências privadas |
| **LOCAL_RUN_REPRODUCIBLE** | Bancada, OCR, QR, STT, áudio, Bolso e Trecos | servir por HTTP; alguns assets podem precisar ser baixados na primeira execução |
| **PRODUCTION_INTEGRATION_DEPENDENT** | sinalização P2P e identidade | Cloudflare + backend próprio de identidade |

### Ambiente de produção próprio

Servidor Node/Express:

```ini
PORT=5188
DATABASE_URL=postgres://seu_usuario:sua_senha@127.0.0.1:5432/omnitreco
FRONTEND_ORIGIN=https://seu-dominio.com
```

Worker Cloudflare:

```bash
printf "https://seu-backend.example.com" | npx wrangler secret put IDENTITY_BACKEND_URL
npx wrangler deploy
```

## Branch canônica

O desenvolvimento canônico do OmniTreco vive na branch `master`.

```bash
git checkout master
```

---

### Nomos Ludens

**Empower, not replace.**

Technology should increase agency before it increases dependence.

[Leia o princípio →](./EMPOWER_NOT_REPLACE.md)

---

**Atribuição obrigatória:** OmniTreco, por Nomos Ludens. Consulte a [licença](./LICENSE).

© 2026 Nomos Ludens
