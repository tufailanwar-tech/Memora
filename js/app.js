pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';


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

  })
})