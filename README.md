# 🛠️ OmniTreco

> **Atribuição obrigatória:** OmniTreco, por Nomos Ludens — consulte o arquivo [LICENSE](LICENSE).

> Seu navegador ganhou poderes.

> **OmniTreco vê. OmniTreco ouve. OmniTreco lê.**

---

## 💡 O que é o OmniTreco?

O **OmniTreco** é um multi-tool web *local-first*, *browser-first* e PWA, projetado para transformar arquivos, sensores e dispositivos ao seu redor em peças de uma mesma ferramenta.

> *O OmniTreco transforma os aparelhos ao seu redor em peças de um único aparelho.*

Sem depender de SaaS corporativos ou processamento em nuvem para manipulação de conteúdos do usuário, o OmniTreco executa tudo diretamente na memória do navegador.

---

## 🗺️ As Quatro Superfícies Principais

A interface do OmniTreco é organizada em torno de apenas **quatro entradas mentais principais**:

```
 🪄 BANCADA         🌀 OUTRO APARELHO         📱 TRECOS         🧰 BOLSO
"Tenho uma coisa"   "Preciso de outro"    "Recursos deste"   "Ferramenta rápida"
```

### 🪄 1. Bancada — *"Tenho uma coisa."*
Superfície contextual para recepção e processamento de objetos soltos:
- **Arquivos & Mídias**: Imagens, PDFs, áudio, vídeos, textos e URLs.
- **Análise & Inspeção**: Inspeção de arquivos, cálculo de hashes SHA-256, metadados e visualização de diffs.
- **AutoFix & Receitas**: Correção automática de formatação, remoção de quebras inválidas e criação de pipelines customizados de manipulação de texto.
- **Análise de Pastas**: Inspeção local de diretórios, cálculo de duplicados reais por SHA-256 completo e criação de snapshots de estrutura.
- **Capacidades Sensoriais Contextuais**: OCR de imagens, leitura de QR/Barcodes, transcrição local de áudio e atalho direto para o Teleporte P2P.

### 🌀 2. Outro aparelho — *"Preciso de outro dispositivo."*
Superfície de integração entre múltiplos aparelhos:
- **Teleporte P2P**: Transferência direta de arquivos e dados via WebRTC DataChannel.
- **Poderes Remotos (Modo MacGyver)**:
  - ✍️ *Superfície para Assinatura*: Assine com o dedo no celular e receba o vetor SVG transparente no computador.
  - 🎨 *Capturador de Cor do Mundo Real*: Aponte a câmera do dispositivo remoto para estimar a cor visual em HEX/RGB/HSL.
  - 🖥️ *Controle Presenter*: Passador de slides P2P com temporizador e sinalização de ponteiro laser.

### 📱 3. Trecos — *"Quero usar os recursos deste aparelho."*
Conjunto de utilidades e sensores nativos do dispositivo atual:
- 👆 **DEDOS**: Escolha aleatória multitouch.
- 📐 **NÍVEL**: Nível de bolha usando o giroscópio.
- 🪞 **ESPELHO**: Câmera frontal com iluminação Ring Light.
- 🔊 **BARULHO**: Medidor de nível relativo de ruído via microfone.
- 🐕 **PET**: Tradutor festivo de som de pet.
- 📞 **CHAMADA**: Simulação de chamada recebida para escape.
- 💩 **TRONO**: Calculadora de tempo e valor acumulado.
- 🎛️ **SONS**: Soundboard com efeitos sonoros auditados.
- 🚨 **STROBE**: Lanterna com sinalizador de código Morse.
- 🎲 **MENTIRAS**: Detector de mentiras recreativo.

### 🧰 4. Bolso — *"Preciso de uma ferramenta rápida."*
Menu Quick Pocket acessível para utilitários imediatos:
- 🎻 **Tiny Violin**: Efeito sonoro imediato.
- 🔑 **Geradores**: UUID v4, senhas fortes e hash SHA-256.
- 🔤 **Conversores**: Base64 encode/decode, Normalizador de espaços.
- 📊 **Calculadoras**: Regra de três simples, diff visual de texto.

---

## 👁️🎙️🔊 OmniTreco vê. Ouve. Lê.

### 👁️ OmniTreco Vê
- **OCR Local**: Reconhecimento óptico de caracteres em imagens via **Tesseract.js** em Web Worker local (português e inglês).
- **Leitor QR**: Decodificação de QR Codes via **jsQR** diretamente da matriz de pixels da imagem.
- **Barcodes 1D**: Suporte a formatos de barras nativos (EAN-13, UPC-A, Code-128) via **BarcodeDetector** nativo.
- *Privacidade*: O conteúdo da imagem nunca sai do dispositivo. Assets do Tesseract/idioma podem ser baixados da CDN sob demanda, mas a imagem do usuário permanece 100% local.

### 🎙️ OmniTreco Ouve
- **Runtime**: **Transformers.js (v2.17.2)** + **ONNX Runtime Web** (WebAssembly / WASM SIMD).
- **Modelo**: **Xenova/whisper-tiny** (*OpenAI Whisper Tiny Multilingual architecture*).
- **Pipeline Local**:
  $$\text{Áudio} \xrightarrow{\text{Web Audio API}} \text{PCM mono 16 kHz Float32Array} \xrightarrow{\text{WASM/ONNX}} \text{Texto final}$$
- *Download & Cache*: Modelo baixado sob demanda (~39 MB observados) e armazenado persistentemente em Cache Storage do navegador (`transformers-cache`). Opção de remoção local disponível na interface.
- *Zero Fallback Remoto*: Nenhum áudio ou transcrição é enviado para APIs externas.

### 🔊 OmniTreco Lê
- **Síntese de Voz**: Motor de leitura em voz alta baseado em `window.speechSynthesis`.
- *Política Estrita*: Aceita **EXCLUSIVAMENTE** vozes onde `voice.localService === true`. Vozes remotas de nuvem são sumariamente bloqueadas.

---

## 🌀 Teleporte P2P

- **Conexão Direta**: Arquivos e dados trafegam diretamente entre navegadores usando WebRTC DataChannel.
- **Sinalização Separada**: A infraestrutura de sinalização (Cloudflare Workers + Durable Objects) intermedia apenas a troca de SDP/ICE candidates, jamais tocando nos arquivos transferidos.
- **Pareamento Simples**: Conexão via QR Code ou código curto de sala.

> *Se o navegador consegue fazer, o servidor não toca no arquivo.*  
> *Processamento local sempre que possível. Infraestrutura remota é usada somente quando necessária para conexão ou entrega de assets de software.*

---

## 🛡️ Privacidade / Local-First

> **Local-First. Seus dados ficam com você.**

- **OCR & Visão**: Imagens e documentos são processados inteiramente na RAM do navegador.
- **Transcrição STT**: Inferência de áudio executada por código WebAssembly local.
- **Síntese TTS**: Uso exclusivo de síntese de voz instalada localmente no SO/navegador.
- **Teleporte**: Conteúdo transmitido de ponto a ponto (P2P).
- **Download de Assets**: Modelos WebAssembly, bibliotecas vendorizadas e pacotes de idioma são baixados via HTTPS e cacheados localmente. Sinalização WebRTC e autenticação utilizam infraestrutura remota apenas quando estritamente necessárias.

---

## 🏗️ Arquitetura do Sistema

```
Browser / PWA (Client-Side Only)
│
├── 🪄 Bancada
│   ├── Inspector Engine (Metadata & Hashes)
│   ├── Folder Inspector (Full SHA-256 Duplicates & Snapshots)
│   ├── AutoFixer & Recipe Pipeline Engine
│   ├── Vision Engine (Tesseract.js OCR & jsQR)
│   └── Hearing Engine (Transformers.js WASM + 16kHz PCM)
│
├── 🌀 Outro aparelho
│   ├── WebRTC P2P Teleport Engine
│   └── MacGyver Remote Powers (Signature SVG, Color Capture, Presenter)
│
├── 📱 Trecos (Sensor Suite & Audio Synthesis)
│
└── 🧰 Bolso (Quick Pocket Utilities)

Infraestrutura de Apoio (Quando Necessária):
├── Cloudflare Worker / Durable Object (WebRTC Signaling Room)
└── Backend de Identidade (PostgreSQL - apenas sessão/identidade)
```

---

## 📚 Auditoria de Terceiros & Licenças

A auditoria completa de hashes, versões e licenças está detalhada em [THIRD_PARTY.md](THIRD_PARTY.md).

- **Tesseract.js** (v5.1.0) — Apache-2.0
- **jsQR** (v1.4.0) — Apache-2.0
- **Transformers.js** (v2.17.2) / ONNX Runtime Web — MIT
- **OpenAI Whisper Architecture** — MIT
- **Xenova/whisper-tiny ONNX Distribution** — Apache-2.0

---

## 🔒 Estado do Projeto — FROZEN BASELINE

O estado funcional e arquitetural do OmniTreco está **congelado e homologado**.

- **Baseline SHA Homologado**: `264e2135cdef53556f3d75e3a1e38918fbafa6fb`

```ini
PRODUCT_ARCHITECTURE = FROZEN
FOUR_SURFACE_UX = FROZEN
TELEPORT_CORE = FROZEN
SENSORY_LAYER_IMPLEMENTATION = FROZEN
SENSORY5_FUNCTIONAL_FREEZE = ACCEPTED
IPHONE_SENSORY_ACCEPTANCE = USER_PHYSICAL_VALIDATION_PENDING
```

---

## 🧪 Filosofia do Produto Real

No OmniTreco, uma suíte de testes passando não é garantia automática de funcionamento físico em hardwares reais. Adotamos a seguinte classificação:

1. **STATIC_PASS**: Código compila, lints limpos e sintaxe válida.
2. **BROWSER_AUTOMATION_PASS**: Fluxos verificados via automação em ambiente controlado.
3. **PHYSICAL_PASS**: Teste humano em hardware real (ex: toque físico e alto-falante de iPhone/Android).

---

## 🌿 Branch Canônica

O desenvolvimento canônico do OmniTreco vive exclusivamente na branch **`master`**.

```bash
git checkout master
```

---

## 🛠️ Matriz de Replicabilidade

Esta distribuição pública sanitizada não aponta para a infraestrutura de produção de Nomos Ludens. Ela categoriza seus componentes em 3 níveis de reprodutibilidade:

| Classificação | Componente / Recursos | Instruções para Execução |
| :--- | :--- | :--- |
| **`BUILD_REPRODUCIBLE`** | Aplicação Frontend, Worker Cloudflare, Durable Object | `node -c app.js` e `npx wrangler deploy --dry-run` funcionam imediatamente sem dependências binárias privadas. |
| **`LOCAL_RUN_REPRODUCIBLE`** | Bancada, Motores Locais (Tesseract.js OCR, jsQR Scanner, Transformers.js WASM STT, Audio Engine, Bolso & Trecos) | Sirva staticamente com `npx serve .` ou abra `index.html`. Funciona 100% offline no navegador sem necessidade de backend. |
| **`PRODUCTION_INTEGRATION_DEPENDENT`** | Sinalização WebRTC P2P (Durable Objects), Sync de Identidade / Aparelhos | Requer `npx wrangler deploy` na Cloudflare e configuração da variável secreta `IDENTITY_BACKEND_URL` apontando para o servidor SQL (`server/src/server.js`). |

---

## 🔑 Configuração de Ambiente para Produção

Para conectar esta cópia ao seu próprio ambiente de produção, use um domínio e um backend sob seu controle. Nenhum valor real deve ser commitado no repositório:

1. Configure as variáveis de ambiente no servidor Node/Express (`server/.env`):
   ```ini
   PORT=5188
   DATABASE_URL=postgres://seu_usuario:sua_senha@127.0.0.1:5432/omnitreco
   FRONTEND_ORIGIN=https://seu-dominio.com
   ```
2. Defina o segredo no Worker Cloudflare:
   ```bash
   printf "https://seu-backend.example.com" | npx wrangler secret put IDENTITY_BACKEND_URL
   npx wrangler deploy
   ```
