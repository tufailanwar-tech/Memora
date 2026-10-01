pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let extractor = null;
let library = [];
let llmEngine = null;


async function initEmbeddings(){
  const transformers = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');
  extractor=await transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('model ready');
}
initEmbeddings();
initLLM();

async function initLLM() {
  const webllm = await import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm');

  llmEngine = await webllm.CreateMLCEngine('Llama-3.2-1B-Instruct-q4f16_1-MLC');
  console.log('llm ready');
}

async function embedChunks(chunks){
  for(let i=0;i<chunks.length;i++){
    const out = await extractor(chunks[i].text, { pooling: 'mean', normalize: true });
    chunks[i].embedding = out.tolist()[0];

  }
  console.log('embedded:', chunks.length);
}



function cosineSim(a,b){
  let sum=0;
  for(let i=0;i<a.length;i++){
    sum+=a[i]*b[i];
  }
  return sum;
}

async function retrieve(question){
  const qOut = await extractor(question, { pooling: 'mean', normalize: true });
  const qVec = qOut.tolist()[0];
  const scored = library.map((c) => {
    return { chunk: c, score: cosineSim(qVec, c.embedding) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5);
}

async function askQuestion(question) {
  if (!llmEngine) {
    console.log('llm not ready yet');
    return;
  }
  const top = await retrieve(question);
  const context = top.map(r => "[p" + r.chunk.page + "] " + r.chunk.text).join("\n\n");
  const reply = await llmEngine.chat.completions.create({
    messages: [
      { role: "system", content: "Answer the question using ONLY the context below. Cite sources like [p2]. If the answer is not in the context, say you don't know.Answer briefly in 2-3 sentences." },
      { role: "user", content: "Context:\n" + context + "\n\nQuestion: " + question }
    ],
    max_tokens: 120
  });
  const answer = reply.choices[0].message.content;
  console.log(answer);
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


const pdfSelector=document.querySelector(".nav-feed");
pdfSelector.addEventListener("click",(e)=>{
  e.preventDefault();
  const input=document.createElement('input');
  input.type='file';
  input.accept='.pdf,.md,.txt';
  input.style.display = 'none'
  document.body.appendChild(input);
  input.click();

  input.addEventListener("change",async ()=>{
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
    console.log(pages.length);
    const allChunks = [];
    for (const p of pages) {
      const cs = chunkText(p.text);
      for (const c of cs) {
        allChunks.push({ page: p.page, text: c });
      }
    }
    console.log('total chunks:', allChunks.length);
    if (!extractor) {
    console.log('model not ready yet');
      return;
    }
    await embedChunks(allChunks);
    library.push(...allChunks);
    console.log(allChunks[0].embedding.length);
    console.log(library.length);


  })
})