pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let extractor = null;

async function initEmbeddings(){
  const transformers = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');
  extractor=await transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('model ready');
}
initEmbeddings();

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


  })
})