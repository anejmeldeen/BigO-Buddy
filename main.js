// main.js

// handle language button active state
const langButtons = document.querySelectorAll('.lang-btn');
let selectedLang = 'Python';

langButtons.forEach(button => {
  button.addEventListener('click', () => {
    langButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    selectedLang = button.dataset.lang;
  });
});

// analyze button click handler
const analyzeBtn = document.getElementById('analyzeBtn');
const codeInput = document.getElementById('codeInput');
const resultText = document.getElementById('resultText');

analyzeBtn.addEventListener('click', () => {
  const code = codeInput.value.trim();
  if (!code) {
    alert('Please enter your code to analyze.');
    return;
  }

  resultText.textContent = `Analyzing ${selectedLang} code...\n\nPlease wait...`;

  fetch('http://127.0.0.1:5000/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: code,           // use the code from textarea
      language: selectedLang // use the selected language
    }),
  })
  .then(res => {
    if (!res.ok) throw new Error('Network response was not ok');
    return res.json();
  })
  .then(data => {
    console.log('Response:', data);
    if (data.result) {
      // split result by semicolon format
      const parts = data.result.split(';');
      if (parts.length >= 2) {
        resultText.textContent = `Complexity: ${parts[0]}\nExplanation: ${parts.slice(1).join(';')}`;
      } else {
        resultText.textContent = data.result;
      }
    } else if (data.error) {
      resultText.textContent = `Error: ${data.error}`;
    } else {
      resultText.textContent = 'Unexpected response format.';
    }
  })
  .catch(err => {
    console.error('Fetch error:', err);
    resultText.textContent = 'Failed to fetch analysis. See console for details.';
  });
});

codeInput.addEventListener('keydown', (e) => {
  // TAB inserts 4 spaces
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = codeInput.selectionStart;
    const end = codeInput.selectionEnd;
    codeInput.value = codeInput.value.substring(0, start) + '    ' + codeInput.value.substring(end);
    codeInput.selectionStart = codeInput.selectionEnd = start + 4;
  }

  // Auto-insert closing } when { is typed
  if (e.key === '{') {
    e.preventDefault();
    const start = codeInput.selectionStart;
    const end = codeInput.selectionEnd;
    // insert {} and place cursor between them
    codeInput.value = codeInput.value.substring(0, start) + '{}' + codeInput.value.substring(end);
    codeInput.selectionStart = codeInput.selectionEnd = start + 1;
  }
});