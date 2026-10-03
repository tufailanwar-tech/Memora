# Memora — your offline AI librarian

Ask questions across your PDFs and get answers with page citations — entirely in your browser. No backend, no API key, no cloud. Your documents never leave your machine.

## How it works

1. **Ingest** — PDF.js extracts text page by page.
2. **Chunk** — text is split into 500-character chunks with 50-character overlap.
3. **Embed** — Transformers.js (`Xenova/all-MiniLM-L6-v2`) turns chunks into 384-dim vectors.
4. **Retrieve** — cosine similarity finds the top 5 most relevant chunks.
5. **Answer** — WebLLM runs Llama locally and answers from those chunks, with `[pN]` page citations.

## Quick start

Serve the folder over HTTP, then open it in Chrome/Edge:


npx serve .

1. Click **Feed** to add a PDF.
2. Wait for `model ready` + `llm ready` in the console (first run downloads the model, ~450MB, then it's cached).
3. Ask anything in the chat.

## Requirements

- Chrome or Edge 113+ (WebGPU required).
- A real GPU. Integrated graphics work but slowly — the app defaults to the lightweight 1B model to stay safe.

## Models

|              | Fast (default)      | Smart (opt-in)        |
|--------------|---------------------|-----------------------|
| Model        | Llama-3.2-1B-Instruct | Llama-3.2-3B-Instruct |
| Download     | ~450MB              | ~1.9GB                |
| Best for     | weak GPUs, quick answers | stronger GPUs, better reasoning |

Switch in the console: `localStorage.setItem('memora-model', 'smart')`, then reload. Set it to `'fast'` (or remove the key) to go back.

## Privacy

Everything runs on-device: PDF parsing, embeddings, retrieval, and the language model. Only the top-5 retrieved chunks (~2,500 characters) are shown to the local model per question — never the whole document, and never to any server.

## Project structure
index.html — layout
css/ — styles
js/app.js — pipeline: ingest, chunk, embed, retrieve, LLM
js/ui.js — chat rendering




## Tech

PDF.js · Transformers.js · WebLLM · vanilla HTML/CSS/JS
