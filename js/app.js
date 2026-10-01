const pdfSelector=document.querySelector(".nav-feed");
pdfSelector.addEventListener("click",(e)=>{
  e.preventDefault();
  const input=document.createElement('input');
  input.type='file';
  input.accept='.pdf,.md,.txt';
  input.style.display = 'none'
  document.body.appendChild(input);
  input.click();

  input.addEventListener("change",()=>{
    const file = input.files[0];
    
  })
})