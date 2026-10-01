const chatForm = document.querySelector('.chat-input');
const chatPanel = document.querySelector('.chat-panel');
const questionInput = document.querySelector('#question');

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = questionInput.value.trim();
  if (!q) return;
  questionInput.value = '';

  const bubble = document.createElement('div');
  bubble.className = 'question-bubble';
  bubble.textContent = q;
  chatPanel.insertBefore(bubble, chatForm);

  const answerBlock = document.createElement('div');
  answerBlock.className = 'answer-block';
  const p = document.createElement('p');
  p.textContent = 'Thinking…';
  answerBlock.appendChild(p);
  chatPanel.insertBefore(answerBlock, chatForm);

  const answer = await askQuestion(q);
  p.textContent = answer;
});
