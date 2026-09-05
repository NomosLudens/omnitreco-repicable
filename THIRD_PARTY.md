# OmniTreco Third-Party Libraries & Licenses Audit

This document maintains an open audit of all third-party libraries, models, and code dependencies used in OmniTreco.

---

## 1. Locality & Software Assets Policy

- **User Audio Policy**: `USER_AUDIO_UPLOAD_REQUESTS = 0`. Zero user audio streams, files, or transcriptions are ever sent to external servers. All audio resampling (16kHz PCM Float32Array) and STT inference execute 100% locally in browser memory via WebAssembly.
- **Software & Model Assets Policy**: `LAZY CDN SOFTWARE ASSETS`. Software engine wrapper `transformers.min.js` is bundled locally in `js/lib/`. Model assets (`Xenova/whisper-tiny` ONNX weights and tokenizers) are lazy-loaded from HuggingFace/CDN on first user consent and stored persistently in browser Cache Storage (`transformers-cache`).

---

## 2. Hearing Layer (OmniTreco Ouve)

### Transformers.js & ONNX Runtime Web (STT WASM Runtime)
- **Library**: `@xenova/transformers` (v2.17.2) / ONNX Runtime Web
- **File**: `js/lib/transformers.min.js`
- **Source**: [jsDelivr Transformers.js v2.17.2](https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js)
- **License**: `MIT`
- **SHA-256**: `bcf7cf304e51f470ed59409622b9d6ffbad80dfcf5baf6a40c919e4b9c4ff812`
- **Execution**: 100% Client-Side WebAssembly / WASM SIMD.

### Xenova/whisper-tiny (Speech Recognition Model)
- **Model**: `Xenova/whisper-tiny`
- **Upstream Architecture License**: `MIT` (OpenAI Whisper)
- **ONNX Distribution License**: `Apache-2.0` (HuggingFace Xenova)
- **Storage**: Browser Cache Storage (`transformers-cache`)
- **Execution**: 100% Client-Side WebAssembly ONNX inference. Lazy-loaded on demand.

---

## 3. Vision Layer (OmniTreco Vê)

### Tesseract.js (OCR Engine)
- **Library**: `tesseract.min.js` (v5.1.0)
- **File**: `js/lib/tesseract.min.js`
- **Source**: [jsDelivr Tesseract.js v5](https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js)
- **License**: `Apache-2.0`
- **SHA-256**: `a8e29918d098b2b06e1012bdaeffb4aec0445c5d5654709023e0bd1f442a80e8`

### jsQR (QR Code Decoder Engine)
- **Library**: `jsQR` (v1.4.0)
- **File**: `js/lib/jsqr.js`
- **Source**: [jsDelivr jsQR v1.4.0](https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js)
- **License**: `Apache-2.0`
- **SHA-256**: `bc40c8a15196236b2314db0856f72ca0b49980cd5413b8c852a7349f5fee0859`

---

## 4. Speech Layer (OmniTreco Lê)

### Web SpeechSynthesis (Local Text-to-Speech)
- **Engine**: `window.speechSynthesis` & `SpeechSynthesisUtterance`
- **License**: W3C Open Standard
- **Voice Strict Policy**: Accepts EXCLUSIVELY local voices where `voice.localService === true`.
