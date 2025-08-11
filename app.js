const langButtons = document.querySelectorAll('.lang-btn');
const codeArea = document.getElementById('codeArea');
const resultEl = document.getElementById('result');
const analyzeBtn = document.getElementById('analyzeBtn');

let currentLang = 'python';

// Store code per language so it persists on switching
const codeStore = {
  python: '',
  java: '',
  cpp: ''
};

langButtons.forEach(btn => {
  if (btn.dataset.lang === currentLang) btn.classList.add('active');
});
codeArea.placeholder = "Paste your Python code here...";
codeArea.value = codeStore[currentLang];

langButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.lang === currentLang) return;

    currentLang = btn.dataset.lang;
    langButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const placeholders = {
      python: "Paste your Python code here...",
      java: "Paste your Java code here...",
      cpp: "Paste your C++ code here..."
    };

    codeArea.placeholder = placeholders[currentLang];

    clearResult();
  });
});

analyzeBtn.addEventListener('click', () => {
  const code = codeArea.value.trim();
  if (!checkCodeMatchesLanguage(code, currentLang)) {
    showResult({
      language: capitalize(currentLang),
      complexity: 'N/A',
      explanation: `⚠️ The pasted code does not look like valid ${capitalize(currentLang)} code. Please double-check language selection or code.`,
      confidence: ''
    });
    return;
  }
  if (code === '') {
    showResult({
      language: capitalize(currentLang),
      complexity: 'O(1)',
      explanation: 'No code detected; constant time complexity.',
      confidence: 'Empty input assumed constant time.'
    });
    return;
  }
  const analysis = analyzeCodeRuntime(code, currentLang);
  showResult(analysis);
});

function checkCodeMatchesLanguage(code, lang) {
  const trimmed = code.trim();
  if (trimmed === '') return true;
  if (lang === 'python') {
    if (trimmed.includes('{') || trimmed.includes('}') || trimmed.includes(';')) return false;
    return true;
  } else if (lang === 'java') {
    return true;
  } else if (lang === 'cpp') {
    return true;
  }
  return true;
}

function analyzeCodeRuntime(code, lang) {
  switch(lang) {
    case 'python': return analyzePython(code);
    case 'java': return analyzeJavaCpp(code, 'Java');
    case 'cpp': return analyzeJavaCpp(code, 'C++');
    default: return { language: lang, complexity: 'N/A', explanation: 'Language not supported.', confidence: '' };
  }
}

// --- Python analyzer (unchanged, no recursion detection) ---
function analyzePython(code) {
  const lines = code.split('\n');

  let loopStack = [];
  let maxNestedDepth = 0;

  let complexityStack = [];

  function getIndent(line) {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  for (let i=0; i<lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('for ') || trimmed.startsWith('while ')) {
      const indent = getIndent(line);

      while (loopStack.length > 0 && loopStack[loopStack.length -1] >= indent) {
        loopStack.pop();
        complexityStack.pop();
      }

      let complexity = 1;

      if (trimmed.startsWith('for ')) {
        if (/range\s*\(\s*n\s*\)/.test(trimmed)) complexity = 'n';
        else if (/range\s*\(\s*\d+\s*\)/.test(trimmed)) complexity = 1;
        else complexity = 'n';
      } else if (trimmed.startsWith('while ')) {
        const whileMatch = trimmed.match(/while\s+(\w+)\s*<\s*n/);
        if (whileMatch) {
          const varName = whileMatch[1];
          let doubling = false;
          for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
            if (new RegExp(`${varName}\\s*=\\s*${varName}\\s*\\*\\s*2`).test(lines[j]) || new RegExp(`${varName}\\s*\\*=\\s*2`).test(lines[j])) {
              doubling = true;
              break;
            }
          }
          complexity = doubling ? 'logn' : 'n';
        } else {
          complexity = 'n';
        }
      }

      loopStack.push(indent);
      complexityStack.push(complexity);
      if (loopStack.length > maxNestedDepth) maxNestedDepth = loopStack.length;

    } else {
      const indent = getIndent(line);
      while (loopStack.length > 0 && loopStack[loopStack.length -1] >= indent) {
        loopStack.pop();
        complexityStack.pop();
      }
    }
  }

  if (maxNestedDepth === 0) {
    return {
      language: 'Python',
      complexity: 'O(1)',
      explanation: 'No loops detected; constant time complexity.',
      confidence: ''
    };
  }

  // Here we just multiply nested loops, which works for Python indentation-based nesting
  let totalComplexity = '1';

  for (const c of complexityStack) {
    if (c === 1) continue;
    if (totalComplexity === '1') totalComplexity = c;
    else if ((totalComplexity === 'n' && c === 'logn') || (totalComplexity === 'logn' && c === 'n')) totalComplexity = 'n log n';
    else if (totalComplexity === 'n' && c === 'n') totalComplexity = `n^${maxNestedDepth}`;
    else if (totalComplexity === 'logn' && c === 'logn') totalComplexity = `(log n)^${maxNestedDepth}`;
    else totalComplexity = `n^${maxNestedDepth}`;
  }

  let explanation = '';
  if (totalComplexity === 'n') explanation = 'Detected linear loops depending on n.';
  else if (totalComplexity === 'logn') explanation = 'Detected logarithmic loops.';
  else if (totalComplexity === 'n log n') explanation = 'Detected nested loops with linear and logarithmic factors.';
  else if (totalComplexity.startsWith('n^')) explanation = `Detected nested linear loops with depth ${maxNestedDepth}.`;
  else explanation = 'Detected loops depending on n.';

  return {
    language: 'Python',
    complexity: `O(${totalComplexity})`,
    explanation,
    confidence: ''
  };
}

// --- Java and C++ Analyzer with max over sequential loops and multiplication over nested loops ---
function analyzeJavaCpp(code, langName) {
  const lines = code.split('\n');

  // Stack of arrays: each element is an array representing the current block's loops complexities (e.g. nested loops inside that block)
  // For nested loops: multiply complexities inside one array
  // For sequential loops inside the same block: we keep track and take max complexity among them
  let stack = [[]]; // start with root block

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect loop starts
    if (line.startsWith('for(') || line.startsWith('for (') || line.startsWith('while(') || line.startsWith('while (')) {
      let isLog = false;
      let update = '';

      const headerMatch = line.match(/\(([^;]*);([^;]*);([^)]*)\)/);
      if (headerMatch) {
        update = headerMatch[3].trim();
      } else {
        const forMatch = line.match(/\((.*)\)/);
        if (forMatch) {
          const inside = forMatch[1];
          const parts = inside.split(';');
          if (parts.length === 3) {
            update = parts[2].trim();
          } else {
            const tokens = inside.split(/\s+/);
            update = tokens[tokens.length - 1];
          }
        }
      }

      if (update) {
        if (/(\w+)\s*\*\=\s*2/.test(update) || /(\w+)\s*=\s*\1\s*\*\s*2/.test(update) || /(\w+)\s*<<=\s*1/.test(update)) {
          isLog = true;
        }
      }

      if (line.startsWith('while')) {
        const varMatch = line.match(/while\s*\(\s*(\w+)\s*[<>=!]+\s*(\w+)\s*\)/);
        if (varMatch) {
          const varName = varMatch[1];
          for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
            if (new RegExp(`${varName}\\s*=\\s*${varName}\\s*\\*\\s*2`).test(lines[j]) || new RegExp(`${varName}\\s*\\*=\\s*2`).test(lines[j])) {
              isLog = true;
              break;
            }
          }
        }
      }

      // Push a new block for this loop's nested content
      // But first add the loop itself complexity (n or logn) to current block
      stack[stack.length - 1].push(isLog ? 'logn' : 'n');
      stack.push([]); // new nested block for inner loops
    }
    else if (line === '}') {
      // Closing a block: pop inner loops
      const innerLoops = stack.pop();

      // Combine inner loops complexities by multiplying all (nested loops)
      let innerComplexity = '1';
      for (const c of innerLoops) {
        if (c === 1) continue;
        if (innerComplexity === '1') innerComplexity = c;
        else if ((innerComplexity === 'n' && c === 'logn') || (innerComplexity === 'logn' && c === 'n')) innerComplexity = 'n log n';
        else if (innerComplexity === 'n' && c === 'n') innerComplexity = 'n^2';
        else if (innerComplexity === 'logn' && c === 'logn') innerComplexity = '(log n)^2';
        else innerComplexity = 'n^2'; // fallback for complex cases
      }

      // Replace last added loop complexity with multiplied complexity
      // The last complexity on the outer block is the loop itself (the one for which this block was nested)
      // Pop last, multiply it with innerComplexity, then push back
      let outerBlock = stack[stack.length - 1];
      if (outerBlock.length === 0) {
        // No outer loop? Just push innerComplexity as a separate loop
        outerBlock.push(innerComplexity);
      } else {
        const last = outerBlock.pop();

        let combined = '1';
        if (last === '1') combined = innerComplexity;
        else if (innerComplexity === '1') combined = last;
        else if ((last === 'n' && innerComplexity === 'logn') || (last === 'logn' && innerComplexity === 'n')) combined = 'n log n';
        else if (last === 'n' && innerComplexity === 'n') combined = 'n^2';
        else if (last === 'logn' && innerComplexity === 'logn') combined = '(log n)^2';
        else {
          // If either is already a power or more complex string, just concatenate powers (simplified)
          // For now fallback to n^2 for safety
          combined = 'n^2';
        }

        outerBlock.push(combined);
      }
    }
  }

  // Now stack[0] contains all top-level loops (sequential loops)
  // We want to take the max complexity among them, not multiply

  // Helper to convert complexity string to numeric order for comparison
  function complexityOrder(c) {
    if (c === '1') return 0;
    if (c === 'logn') return 1;
    if (c === 'n') return 2;
    if (c === 'n log n') return 3;
    if (c.startsWith('n^')) return 4 + parseInt(c.slice(2)) || 4;
    if (c.startsWith('(log n)^')) return 1 + parseInt(c.slice(8)) || 1;
    return 0;
  }

  // Find max complexity by order
  let maxComplexity = '1';
  for (const c of stack[0]) {
    if (complexityOrder(c) > complexityOrder(maxComplexity)) {
      maxComplexity = c;
    }
  }

  // Compose a readable explanation for maxComplexity
  let explanation = '';
  switch(maxComplexity) {
    case '1': explanation = 'No loops detected; constant time complexity.'; break;
    case 'logn': explanation = 'Detected logarithmic loops.'; break;
    case 'n': explanation = 'Detected linear loops depending on n.'; break;
    case 'n log n': explanation = 'Detected nested loops with linear and logarithmic factors.'; break;
    default:
      if (maxComplexity.startsWith('n^')) {
        const power = maxComplexity.slice(2);
        explanation = `Detected nested linear loops with depth ${power}.`;
      } else {
        explanation = 'Detected loops depending on n.';
      }
  }

  return {
    language: langName,
    complexity: `O(${maxComplexity})`,
    explanation,
    confidence: ''
  };
}

function showResult({ language, complexity, explanation, confidence }) {
  resultEl.style.opacity = '0';
  setTimeout(() => {
    resultEl.innerHTML = `
      <strong>Language:</strong> ${language}<br>
      <strong>Estimated Complexity:</strong> ${complexity}<br>
      <em>${explanation}</em><br>
      <small>${confidence}</small>
    `;
    resultEl.style.opacity = '1';
  }, 100);
}

function clearResult() {
  resultEl.innerHTML = '';
}

function capitalize(s) {
  if (typeof s !== 'string') return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

codeArea.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = codeArea.selectionStart;
    const end = codeArea.selectionEnd;
    codeArea.value = codeArea.value.substring(0, start) + '    ' + codeArea.value.substring(end);
    codeArea.selectionStart = codeArea.selectionEnd = start + 4;
  } else if (e.key === '{') {
    e.preventDefault();
    const start = codeArea.selectionStart;
    const end = codeArea.selectionEnd;
    codeArea.value = codeArea.value.substring(0, start) + '{}' + codeArea.value.substring(end);
    codeArea.selectionStart = codeArea.selectionEnd = start + 1;
  }
});

codeArea.addEventListener('input', () => {
  codeStore[currentLang] = codeArea.value;
});
