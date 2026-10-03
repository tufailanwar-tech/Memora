pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let extractor = null;
let library = [];
let llmEngine = null;
const MODEL_SMART = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
const MODEL_FAST = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
const chatHistory = [];
const documents = [];
const readingPage = document.querySelector('.reading-page');
const originalReadingHTML = readingPage.innerHTML;
let openDocumentIndex = null;
let currentDocumentPage = 0;
let renderRequest = 0;
let activeRenderTask = null;

function openDocument(index) {
  openDocumentIndex = index;
  currentDocumentPage = 0;
  renderDocumentPage();
}

function closeDocument() {
  renderRequest += 1;
  if (activeRenderTask) activeRenderTask.cancel();
  activeRenderTask = null;
  openDocumentIndex = null;
  currentDocumentPage = 0;
  readingPage.innerHTML = originalReadingHTML;
}

async function renderDocumentPage() {
  const request = ++renderRequest;
  if (activeRenderTask) activeRenderTask.cancel();
  activeRenderTask = null;
  const documentIndex = openDocumentIndex;
  const pageIndex = currentDocumentPage;
  const documentData = documents[documentIndex];
  const page = await documentData.pdf.getPage(pageIndex + 1);
  if (request !== renderRequest || documentIndex !== openDocumentIndex || pageIndex !== currentDocumentPage) return;

  readingPage.innerHTML = `
    <div class="reading-topline">
      <p></p>
      <button class="close-document" type="button" aria-label="Close document">×</button>
    </div>
    <div class="document-canvas-wrap">
      <canvas class="document-canvas"></canvas>
    </div>
    <nav class="page-nav" aria-label="Page navigation">
      <a href="#previous-page"></a>
      <span></span>
      <a href="#next-page"></a>
    </nav>
  `;

  const pageNumber = pageIndex + 1;
  readingPage.querySelector('.reading-topline p').textContent = `${documentData.name} / PAGE ${pageNumber}`;
  readingPage.querySelector('.page-nav span').textContent = `PAGE ${pageNumber} OF ${documentData.pages.length}`;

  const closeButton = readingPage.querySelector('.close-document');
  const pageLinks = readingPage.querySelectorAll('.page-nav a');
  pageLinks[0].textContent = `← ${pageNumber > 1 ? pageNumber - 1 : 'START'}`;
  pageLinks[1].textContent = `${pageNumber < documentData.pages.length ? pageNumber + 1 : 'END'} →`;

  closeButton.addEventListener('click', closeDocument);
  pageLinks[0].addEventListener('click', (event) => {
    event.preventDefault();
    if (pageIndex > 0) {
      currentDocumentPage = pageIndex - 1;
      renderDocumentPage();
    }
  });
  pageLinks[1].addEventListener('click', (event) => {
    event.preventDefault();
    if (pageIndex < documentData.pages.length - 1) {
      currentDocumentPage = pageIndex + 1;
      renderDocumentPage();
    }
  });

  const canvas = readingPage.querySelector('.document-canvas');
  const context = canvas.getContext('2d');
  const initialViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(readingPage.clientWidth / initialViewport.width, 2);
  const viewport = page.getViewport({ scale });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const renderTask = page.render({ canvasContext: context, viewport });
  activeRenderTask = renderTask;
  try {
    await renderTask.promise;
  } catch (error) {
    if (error.name !== 'RenderingCancelledException') throw error;
  } finally {
    if (activeRenderTask === renderTask) activeRenderTask = null;
  }
}



async function initEmbeddings() {
  const transformers = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');
  extractor = await transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('model ready');
}

initEmbeddings();
if (localStorage.getItem('memora-model')) {
  initLLM();
} else {
  document.querySelector('.model-modal').hidden = false;
}

document.querySelector('.model-switch').addEventListener('click', () => {
  document.querySelector('.model-modal').hidden = false;
});

document.querySelectorAll('.model-option').forEach((btn) => {
  btn.addEventListener('click', () => {
    const prev = localStorage.getItem('memora-model');
    const next = btn.dataset.model;
    document.querySelector('.model-modal').hidden = true;
    if (prev === next) return;
    localStorage.setItem('memora-model', next);
    if (prev === null) {
      initLLM();
    } else {
      location.reload();
    }
  });
});


async function initLLM() {
  const webllm = await import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm');
  const saved = localStorage.getItem('memora-model');
  const order = saved === 'smart' ? [MODEL_SMART, MODEL_FAST] : [MODEL_FAST];

  for (const id of order) {
    try {
      llmEngine = await webllm.CreateMLCEngine(id);
      console.log('llm ready (' + id + ')');
      return;
    } catch (err) {
      console.log(id + ' failed, trying next:', err.message);
    }
  }
  console.log('llm failed to load');
}

async function embedChunks(chunks) {
  for (let i = 0; i < chunks.length; i++) {
    const out = await extractor(chunks[i].text, { pooling: 'mean', normalize: true });
    chunks[i].embedding = out.tolist()[0];

  }
  console.log('embedded:', chunks.length);
}



function cosineSim(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

function editDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function keywordRescue(question, top) {
  const stop = ['what', 'which', 'where', 'when', 'does', 'about', 'from', 'with', 'your', 'this', 'that', 'there', 'their', 'have', 'has'];
  const qwords = question.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !stop.includes(w));
  const twords = top[0].chunk.text.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/);
  return qwords.some(qw => twords.some(tw => tw === qw || editDistance(qw, tw) <= (qw.length >= 6 ? 2 : 1)));
}


async function retrieve(question) {
  const qOut = await extractor(question, { pooling: 'mean', normalize: true });
  const qVec = qOut.tolist()[0];
  const pool = openDocumentIndex === null ? library : library.filter(c => c.doc === openDocumentIndex);
  const scored = pool.map((c) => {
    return { chunk: c, score: cosineSim(qVec, c.embedding) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5);
}

async function askQuestion(question) {
  if (!llmEngine) {
    console.log('llm not ready yet');
    return "The model is still loading — please wait a moment and try again.";
  }
  const top = await retrieve(question);
  if (top.length === 0 || (top[0].score < 0.2 && !keywordRescue(question, top))) {
    const msg = "I couldn't find anything about that in your documents.";
    chatHistory.push({ role: "user", content: question });
    chatHistory.push({ role: "assistant", content: msg });
    return msg;
  }
  const context = top.map(r => "[p" + r.chunk.page + "] " + r.chunk.text).join("\n\n");
  let answer;
  try {
    const reply = await llmEngine.chat.completions.create({
      messages: [
        {
          role: "system", content:
            "Answer the question using ONLY the context below, in one short sentence of your own words. Put the page like [p1] at the end. If the context truly has no answer, say you don't know."
        },
        ...chatHistory.slice(-4),
        { role: "user", content: "Context:\n" + context + "\n\nQuestion: " + question }
      ],
      max_tokens: 80
    });
    answer = reply.choices[0].message.content;
  } catch (err) {
    console.log('generation failed:', err.message);
    answer = "The graphics processor gave up — please reload the page and try again.";
  }
  console.log(answer);
  chatHistory.push({ role: "user", content: question });
  chatHistory.push({ role: "assistant", content: answer });
  return answer;
}




function chunkText(text) {
  const chunks = [];
  const size = 500;
  const overlap = 50;
  for (let i = 0; i < text.length; i += size - overlap) {
    chunks.push(text.slice(i, i + size));
  }

  return chunks;
}


const pdfSelector = document.querySelector(".nav-feed");
pdfSelector.addEventListener("click", (e) => {
  e.preventDefault();
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,.md,.txt';
  input.style.display = 'none'
  document.body.appendChild(input);
  input.click();

  input.addEventListener("change", async () => {
    const file = input.files[0];
    const bytes = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    console.log(file.name, pdf.numPages);

    const grid = document.querySelector('.library-grid');
    const card = document.createElement('article');
    card.className = 'library-card memory-card';
    card.innerHTML = `
      <span class="status-tag">PDF · ACTIVE</span>
      <h2>${file.name}</h2>
      <p>${pdf.numPages} pages · just added</p>
    `;
    grid.appendChild(card);


    // const chunks = chunkText(text);
    // console.log('chunks:', chunks.length);
    // console.log(chunks[0].slice(0, 80));

    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      let page = await pdf.getPage(i);
      let textContent = await page.getTextContent();
      let text = textContent.items.map(item => item.str).join(' ');
      pages.push({ page: i, text: text });
    }
    const documentIndex = documents.push({ name: file.name, pdf, pages }) - 1;
    const libraryCount = document.querySelector('.library-count');
    if (libraryCount) {
      libraryCount.textContent = `${documents.length} OBJECT${documents.length === 1 ? '' : 'S'}`;
    }
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Open ${file.name}`);
    card.addEventListener('click', () => openDocument(documentIndex));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDocument(documentIndex);
      }
    });
    console.log(pages.length);
    const allChunks = [];
    for (const p of pages) {
      const cs = chunkText(p.text);
      for (const c of cs) {
        allChunks.push({ doc: documentIndex, page: p.page, text: c });
      }
    }
    console.log('total chunks:', allChunks.length);
    while (!extractor) {
      await new Promise(r => setTimeout(r, 500));
    }
    await embedChunks(allChunks);
    library.push(...allChunks);
    const chatPanel = document.querySelector('.chat-panel');
    const chatEmpty = chatPanel.querySelector('.chat-empty');
    if (chatEmpty) chatEmpty.remove();
    const systemNote = document.createElement('div');
    systemNote.className = 'system-note';
    systemNote.textContent = `${file.name} added — ask me anything about it.`;
    chatPanel.insertBefore(systemNote, chatPanel.querySelector('.chat-input'));
    console.log(allChunks[0].embedding.length);
    console.log(library.length);


  })
})
