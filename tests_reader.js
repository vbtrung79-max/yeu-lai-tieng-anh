const fs = require('fs');

// Mock localStorage
const store = {};
global.localStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, value) => { store[key] = value.toString(); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { for (let k in store) delete store[k]; }
};

// Mock SpeechSynthesis
global.window = {
  speechSynthesis: {
    cancel: () => {},
    speak: (utt) => {
      global.window.lastSpokenText = utt.text;
    }
  }
};
global.SpeechSynthesisUtterance = function(text) {
  this.text = text;
  this.lang = 'en-US';
  this.rate = 1.0;
};

// Mock DOM elements
const mockElements = {};
function createMockElement(id = '', tag = '') {
  const el = {
    id,
    tagName: tag.toUpperCase(),
    classList: {
      classes: new Set(),
      add(c) { this.classes.add(c); },
      remove(c) { this.classes.delete(c); },
      contains(c) { return this.classes.has(c); }
    },
    attributes: {},
    setAttribute(name, val) { this.attributes[name] = val; },
    getAttribute(name) { return this.attributes[name] || null; },
    addEventListener(event, callback) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(callback);
    },
    dispatchEvent(event) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(cb => cb({ preventDefault: () => {}, stopPropagation: () => {} }));
      }
    },
    listeners: {},
    parentNode: {
      replaceChild: (newChild, oldChild) => {
        el.replacedChild = newChild;
      }
    },
    cloneNode: () => createMockElement(id, tag),
    querySelector: (sel) => createMockElement('', 'div'),
    querySelectorAll: (sel) => [],
    closest: (sel) => {
      if (sel === '.sentence') {
        return { textContent: 'Once when I was six years old I saw a magnificent picture.' };
      }
      return null;
    },
    appendChild: (child) => {},
    innerHTML: '',
    textContent: ''
  };
  return el;
}

global.document = {
  addEventListener: () => {},
  createElement: (tag) => createMockElement('', tag),
  body: {
    appendChild: (child) => {}
  },
  getElementById: (id) => {
    if (!mockElements[id]) {
      mockElements[id] = createMockElement(id);
    }
    return mockElements[id];
  },
  querySelector: (sel) => {
    if (sel.startsWith('#')) {
      const id = sel.substring(1);
      return global.document.getElementById(id);
    }
    return createMockElement();
  },
  querySelectorAll: (sel) => {
    return [];
  }
};

// Mock global books array
global.BOOKS = [
  {
    day: 1,
    title: "The Little Prince - Chapter 1",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    content: "Once when I was six years old I saw a magnificent picture.",
    dictionary: {
      "once": "một lần, ngày xưa",
      "six": "sáu",
      "years": "năm",
      "old": "tuổi",
      "saw": "nhìn thấy",
      "magnificent": "tráng lệ, tuyệt vời",
      "picture": "bức tranh, bức ảnh"
    }
  }
];

// Load app.js code
const appCode = fs.readFileSync('./app.js', 'utf8');
eval(appCode);

async function runTests() {
  console.log('--- STARTING INTERACTIVE READER & AUDIO PLAYER TESTS ---');

  // Verify that loadReaderBook is exposed on window
  console.assert(typeof global.window.loadReaderBook === 'function', 'loadReaderBook should be exposed on window');

  // Set up mock session
  localStorage.setItem('mock_supabase_session', JSON.stringify({
    user: { id: 'user-123', email: 'test@example.com' }
  }));

  // Test 1: Load and Render Day 1 Story
  const readerContent = global.document.getElementById('reader-content');
  const nativeAudio = global.document.getElementById('native-audio');

  global.window.loadReaderBook(1);

  // Check if book audio is loaded
  console.assert(nativeAudio.src === 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', 'Audio source should match Day 1 story');

  // Test 2: Tokenization and word click handling
  const mockWordSpan = createMockElement('', 'span');
  mockWordSpan.textContent = 'magnificent';
  mockWordSpan.setAttribute('data-word', 'magnificent');

  // Manually invoke handleWordClick
  handleWordClick(mockWordSpan, global.BOOKS[0], 1);

  // Wait a moment for async checkIfWordSaved promises to resolve
  await new Promise(resolve => setTimeout(resolve, 100));

  // Check if sidebar widgets are updated
  const dictWord = global.document.getElementById('dict-word');
  const dictDefinition = global.document.getElementById('dict-definition');
  console.assert(dictWord.textContent === 'magnificent', 'Sidebar word should be updated');
  console.assert(dictDefinition.textContent === 'tráng lệ, tuyệt vời', 'Sidebar definition should be updated');

  // Check if tooltip contains the word and meaning
  const tooltip = global.document.getElementById('word-tooltip');
  console.assert(tooltip.innerHTML.includes('magnificent'), 'Tooltip should contain word');
  console.assert(tooltip.innerHTML.includes('tráng lệ, tuyệt vời'), 'Tooltip should contain definition');

  // Test 3: Web Speech API pronunciation
  speakWord('magnificent');
  console.assert(global.window.lastSpokenText === 'magnificent', 'Speech API should speak the clicked word');

  // Test 4: Save Vocabulary Word
  const saveSuccess = await saveVocabularyWord('magnificent', 'tráng lệ, tuyệt vời', 'Once when I was six years old I saw a magnificent picture.', 'The Little Prince - Chapter 1', 1);
  console.assert(saveSuccess === true, 'Saving vocabulary word should succeed');

  // Validate item is saved to localStorage
  const savedVocabList = JSON.parse(localStorage.getItem('mock_supabase_vocab') || '[]');
  console.assert(savedVocabList.length === 1, 'Saved vocab list should have 1 item');
  console.assert(savedVocabList[0].word === 'magnificent', 'Saved word should match');
  console.assert(savedVocabList[0].definition === 'tráng lệ, tuyệt vời', 'Saved definition should match');
  console.assert(savedVocabList[0].context.includes('magnificent'), 'Saved context should match');

  console.log('--- ALL INTERACTIVE READER & AUDIO PLAYER TESTS PASSED ---');
}

runTests().catch(err => {
  console.error('TEST FAIL:', err);
  process.exit(1);
});
