(() => {
  'use strict';

  const STORAGE_PREFIX = 'microlab-exam-v3-';
  const FLASHCARD_STORAGE_PREFIX = 'microlab-flashcards-v1-';
  const banks = window.MICROLAB_BANKS;
  const levels = {
    easy: { label:'Easy', code:'01', note:'Core facts & recognition' },
    medium: { label:'Medium', code:'02', note:'Procedures & interpretation' },
    hard: { label:'Hard', code:'03', note:'Application & troubleshooting' }
  };
  const colors = {
    teal:['#2fa499','rgba(47,164,153,.14)'], blue:['#3f7cac','rgba(63,124,172,.13)'],
    orange:['#e8954f','rgba(232,149,79,.15)'], purple:['#8064a2','rgba(128,100,162,.14)'],
    navy:['#173f5f','rgba(23,63,95,.13)']
  };

  let currentBank = null;
  let questions = [];
  let state = null;
  let activeExam = null;
  let currentFlashDeck = null;
  let flashState = null;
  let flashcardFlipped = false;
  let toastTimer = null;

  const flashcardDecks = {
    lessons12:{ id:'lessons12', title:'Lessons 01 & 02', shortTitle:'Lessons 01–02', code:'01–02', accent:'teal', description:'Safety, scientific method, microbial ubiquity, colony morphology, and hand hygiene.', questions:banks.lessons12.questions },
    lessons34:{ id:'lessons34', title:'Lessons 03 & 04', shortTitle:'Lessons 03–04', code:'03–04', accent:'blue', description:'Microscopy, cell morphology, aseptic transfer, culture media, and pure-culture isolation.', questions:banks.lessons34.questions },
    lessons56:{ id:'lessons56', title:'Lessons 05 & 06', shortTitle:'Lessons 05–06', code:'05–06', accent:'orange', description:'Smear preparation, staining, specialized bacterial structures, flagella, and motility.', questions:banks.lessons56.questions },
    studyGuide:{ id:'studyGuide', title:'Study Guide Lab Exam 1', shortTitle:'Study Guide', code:'GUIDE', accent:'purple', description:'Flashcards limited to the objectives in the teacher-provided Study Guide Lab Exam 1.', questions:banks.studyGuide.questions },
    allLessons:{ id:'allLessons', title:'All Lessons 01–06', shortTitle:'All Lessons 01–06', code:'01–06', accent:'navy', description:'A complete flashcard deck combining the source-mapped banks from all six laboratory modules.', questions:[...banks.lessons12.questions, ...banks.lessons34.questions, ...banks.lessons56.questions] }
  };

  function initialState(){
    return { version:3, history:[], mistakes:[], drafts:{}, completed:{ easy:false, medium:false, hard:false } };
  }
  function storageKey(id){ return `${STORAGE_PREFIX}${id}`; }
  function loadState(id){
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey(id)));
      if (!parsed || parsed.version !== 3) return initialState();
      return {
        ...initialState(), ...parsed,
        completed:{ ...initialState().completed, ...(parsed.completed || {}) },
        drafts:{ ...(parsed.drafts || {}) }
      };
    } catch { return initialState(); }
  }
  function saveState(){ if (currentBank && state) localStorage.setItem(storageKey(currentBank.id), JSON.stringify(state)); }
  function initialFlashState(deck){ return { version:1, known:[], review:[], index:0, order:deck.questions.map(question => question.id) }; }
  function flashStorageKey(id){ return `${FLASHCARD_STORAGE_PREFIX}${id}`; }
  function loadFlashState(deck){
    try {
      const parsed = JSON.parse(localStorage.getItem(flashStorageKey(deck.id)));
      if (!parsed || parsed.version !== 1) return initialFlashState(deck);
      const validIds = new Set(deck.questions.map(question => question.id));
      const savedOrder = Array.isArray(parsed.order) ? parsed.order.filter(id => validIds.has(id)) : [];
      const missing = deck.questions.map(question => question.id).filter(id => !savedOrder.includes(id));
      return {
        version:1,
        known:Array.isArray(parsed.known) ? parsed.known.filter(id => validIds.has(id)) : [],
        review:Array.isArray(parsed.review) ? parsed.review.filter(id => validIds.has(id)) : [],
        index:Number.isInteger(parsed.index) ? Math.max(0, parsed.index) : 0,
        order:[...savedOrder, ...missing]
      };
    } catch { return initialFlashState(deck); }
  }
  function saveFlashState(){ if (currentFlashDeck && flashState) localStorage.setItem(flashStorageKey(currentFlashDeck.id), JSON.stringify(flashState)); }
  function escapeHTML(value){ return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char])); }
  function normalize(value){ return String(value).toLowerCase().trim().replace(/[–—]/g,'-').replace(/\s+/g,' ').replace(/[^a-z0-9×^⁻. -]/g,''); }
  function isCorrect(question, response){
    if (question.type === 'mcq') return response === question.answer;
    const given = normalize(response);
    return (question.answers || []).some(answer => normalize(answer) === given);
  }
  function showToast(message){
    const toast = document.getElementById('toast');
    toast.textContent = message; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function renderLibrary(){
    document.getElementById('collection-grid').innerHTML = Object.values(banks).map(bank => {
      const saved = loadState(bank.id);
      const completed = Object.values(saved.completed).filter(Boolean).length;
      const counts = Object.fromEntries(Object.keys(levels).map(level => [level, bank.questions.filter(question => question.level === level).length]));
      const [color, soft] = colors[bank.accent] || colors.teal;
      return `<button class="panel collection-card" data-select-bank="${bank.id}" style="--collection-color:${color};--collection-soft:${soft}">
        <span class="collection-code">${escapeHTML(bank.code)}</span>
        <span class="collection-copy"><h3>${escapeHTML(bank.title)}</h3><p>${escapeHTML(bank.description)}</p>
          <span class="collection-meta"><span class="collection-chip">${bank.questions.length} questions</span><span class="collection-chip">${counts.easy}/${counts.medium}/${counts.hard} by level</span></span>
          <span class="collection-progress">${completed}/3 levels completed · ${saved.history.length} saved attempt${saved.history.length === 1 ? '' : 's'}</span>
        </span>
      </button>`;
    }).join('');
  }

  function renderFlashcardLibrary(){
    document.getElementById('flashcard-deck-grid').innerHTML = Object.values(flashcardDecks).map(deck => {
      const saved = loadFlashState(deck);
      const known = new Set(saved.known).size;
      const remaining = Math.max(0, saved.order.length - Math.min(saved.index, saved.order.length));
      const [color, soft] = colors[deck.accent] || colors.teal;
      return `<button class="panel collection-card flashcard-deck-card" data-select-flash-deck="${deck.id}" style="--collection-color:${color};--collection-soft:${soft}">
        <span class="collection-code">${escapeHTML(deck.code)}</span>
        <span class="collection-copy"><h3>${escapeHTML(deck.title)}</h3><p>${escapeHTML(deck.description)}</p>
          <span class="collection-meta"><span class="collection-chip">${deck.questions.length} cards</span><span class="collection-chip">${known} known</span></span>
          <span class="collection-progress">${remaining ? `${remaining} cards remaining` : 'Deck completed · ready to study again'}</span>
        </span>
      </button>`;
    }).join('');
  }

  function selectFlashDeck(id){
    const deck = flashcardDecks[id];
    if (!deck) return;
    persistDraft();
    currentFlashDeck = deck;
    flashState = loadFlashState(deck);
    flashcardFlipped = false;
    showView('flashcard-study');
  }

  function currentFlashcard(){
    if (!currentFlashDeck || !flashState) return null;
    const id = flashState.order[flashState.index];
    return currentFlashDeck.questions.find(question => question.id === id) || null;
  }

  function flashcardAnswer(question){
    if (question.type === 'mcq') return question.answer;
    return question.displayAnswer || question.answers?.[0] || 'See the explanation.';
  }

  function renderFlashcard(){
    if (!currentFlashDeck || !flashState) return;
    const total = flashState.order.length;
    const knownCount = new Set(flashState.known).size;
    const reviewCount = new Set(flashState.review).size;
    const position = Math.min(flashState.index + 1, total);
    document.getElementById('flashcard-deck-label').textContent = currentFlashDeck.shortTitle;
    document.getElementById('flashcard-count').textContent = flashState.index >= total ? `${total} cards reviewed` : `Card ${position} of ${total}`;
    document.getElementById('flashcard-progress-bar').style.width = `${total ? Math.min(flashState.index, total) / total * 100 : 0}%`;
    document.getElementById('flashcard-progress-summary').innerHTML = `<span>${total} total</span><span class="known">${knownCount} known</span><span>${reviewCount} marked for review</span>`;

    const stage = document.getElementById('flashcard-stage');
    const controls = document.getElementById('flashcard-controls');
    const question = currentFlashcard();
    if (!question) {
      controls.hidden = true;
      stage.innerHTML = `<div class="panel flashcard-complete"><p class="section-kicker">Deck complete</p><h2>You reviewed all ${total} cards.</h2><p>${knownCount} marked as known · ${reviewCount} marked for another review.</p><div class="flashcard-complete-actions"><button class="secondary-button" data-flash-action="library">Choose another deck</button>${reviewCount ? '<button class="secondary-button" data-flash-action="review">Review marked cards</button>' : ''}<button class="primary-button" data-flash-action="again">Study this deck again</button></div></div>`;
      return;
    }

    controls.hidden = false;
    flashcardFlipped = false;
    const typeLabel = question.type === 'mcq' ? 'Multiple choice concept' : question.figure ? 'Figure-based concept' : 'Short-answer concept';
    stage.innerHTML = `<button class="flashcard" id="active-flashcard" aria-label="Flip flashcard to reveal answer" aria-pressed="false">
      <span class="flashcard-face flashcard-front"><span class="flashcard-label">${escapeHTML(typeLabel)} · ${escapeHTML(question.topic)}</span><h2>${escapeHTML(question.prompt)}</h2>${question.figure || ''}<span class="flashcard-hint">Click the card or press “Show answer”</span></span>
      <span class="flashcard-face flashcard-back"><span class="flashcard-label">Answer</span><span class="flashcard-answer">${escapeHTML(flashcardAnswer(question))}</span><span class="flashcard-explanation">${escapeHTML(question.explanation)}</span><span class="flashcard-source">Source: ${escapeHTML(question.source)}</span><span class="flashcard-hint">Choose whether to review this card again or mark it as known.</span></span>
    </button>`;
    document.getElementById('review-flashcard').disabled = true;
    document.getElementById('know-flashcard').disabled = true;
    document.getElementById('flip-card').textContent = 'Show answer';
    document.getElementById('active-flashcard').addEventListener('click', flipFlashcard);
  }

  function flipFlashcard(){
    const card = document.getElementById('active-flashcard');
    if (!card) return;
    flashcardFlipped = !flashcardFlipped;
    card.classList.toggle('flipped', flashcardFlipped);
    card.setAttribute('aria-pressed', flashcardFlipped);
    card.setAttribute('aria-label', flashcardFlipped ? 'Flip flashcard to show question' : 'Flip flashcard to reveal answer');
    document.getElementById('flip-card').textContent = flashcardFlipped ? 'Show question' : 'Show answer';
    document.getElementById('review-flashcard').disabled = !flashcardFlipped;
    document.getElementById('know-flashcard').disabled = !flashcardFlipped;
  }

  function markFlashcard(status){
    const question = currentFlashcard();
    if (!question || !flashcardFlipped) return;
    flashState.known = flashState.known.filter(id => id !== question.id);
    flashState.review = flashState.review.filter(id => id !== question.id);
    if (status === 'known') flashState.known.push(question.id);
    if (status === 'review') flashState.review.push(question.id);
    flashState.index += 1;
    saveFlashState();
    renderFlashcard();
  }

  function restartFlashcards(reviewOnly){
    const ids = reviewOnly ? [...new Set(flashState.review)] : currentFlashDeck.questions.map(question => question.id);
    if (!ids.length) { showToast('No cards are marked for review.'); return; }
    flashState.order = ids;
    flashState.index = 0;
    saveFlashState();
    renderFlashcard();
  }

  function selectCollection(id){
    if (!banks[id]) return;
    persistDraft();
    currentBank = banks[id];
    questions = currentBank.questions;
    state = loadState(id);
    activeExam = null;
    document.getElementById('side-collection').textContent = currentBank.shortTitle;
    document.getElementById('dashboard-collection').textContent = currentBank.title;
    document.getElementById('dashboard-copy').textContent = `${currentBank.description} Complete all three levels to unlock a review made only from questions missed in this collection.`;
    updateCoverage();
    showView('dashboard');
  }

  function updateCoverage(){
    if (!currentBank) return;
    document.getElementById('bank-size').textContent = questions.length;
    document.getElementById('topic-count').textContent = new Set(questions.map(question => question.topic)).size;
    document.getElementById('source-count').textContent = currentBank.sourceCount;
    document.getElementById('coverage-copy').textContent = `Every question in ${currentBank.title} is mapped to a reviewed source or a teacher-provided Study Guide objective.`;
    document.getElementById('source-table-body').innerHTML = currentBank.coverage.map(row => `<tr><td>${escapeHTML(row[0])}</td><td>${escapeHTML(row[1])}</td><td>${escapeHTML(row[2])}</td><td><span class="status-tag complete">Covered</span></td></tr>`).join('');
  }

  function showView(name){
    const standaloneViews = ['library', 'flashcards', 'flashcard-study'];
    if (!standaloneViews.includes(name) && !currentBank) name = 'library';
    if (name === 'flashcard-study' && !currentFlashDeck) name = 'flashcards';
    if (name === 'library' && activeExam) { persistDraft(); activeExam = null; }
    if (name === 'flashcards' && activeExam) { persistDraft(); activeExam = null; }
    document.querySelectorAll('.view').forEach(view => { view.hidden = true; });
    const target = document.getElementById(`view-${name}`);
    if (target) target.hidden = false;
    document.querySelectorAll('.nav-button').forEach(button => {
      const active = button.dataset.view === name || (name === 'flashcard-study' && button.dataset.view === 'flashcards');
      button.classList.toggle('active', active);
      button.toggleAttribute('aria-current', active);
    });
    const titles = { library:'Exam library', flashcards:'Flashcards', 'flashcard-study':currentFlashDeck?.title || 'Flashcards', dashboard:currentBank?.title || 'Exam dashboard', history:'Results history', sources:'Source coverage', exam:'Exam in progress', results:'Exam result' };
    document.getElementById('page-title').textContent = titles[name] || 'MicroLab Exam';
    if (name === 'library') { document.getElementById('side-collection').textContent = 'Choose an exam'; renderLibrary(); }
    if (name === 'flashcards') { document.getElementById('side-collection').textContent = 'Flashcard library'; renderFlashcardLibrary(); }
    if (name === 'flashcard-study') { document.getElementById('side-collection').textContent = currentFlashDeck.shortTitle; renderFlashcard(); }
    if (name === 'dashboard') { document.getElementById('side-collection').textContent = currentBank.shortTitle; renderDashboard(); }
    if (name === 'history') { document.getElementById('side-collection').textContent = currentBank.shortTitle; renderHistory(); }
    if (name === 'sources') { document.getElementById('side-collection').textContent = currentBank.shortTitle; updateCoverage(); }
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  function renderDashboard(){
    const completedCount = Object.values(state.completed).filter(Boolean).length;
    const uniqueMistakes = [...new Set(state.mistakes.map(item => item.questionId))];
    document.getElementById('attempts-stat').textContent = state.history.length;
    document.getElementById('mistakes-stat').textContent = uniqueMistakes.length;
    document.getElementById('levels-stat').textContent = `${completedCount}/3`;
    document.getElementById('progress-ring').style.setProperty('--progress', `${completedCount / 3 * 100}%`);

    document.getElementById('level-list').innerHTML = Object.entries(levels).map(([key, level]) => {
      const completed = state.completed[key];
      const draft = state.drafts[key];
      const label = draft ? 'Resume' : completed ? 'Retake' : 'Start exam';
      return `<article class="level-card ${key}">
        <div class="level-icon">${level.code}</div>
        <div class="level-copy"><strong>${level.label}</strong><div class="level-meta"><span>${level.note}</span><span>${questions.filter(question => question.level === key).length} questions</span>${completed ? '<span class="complete-mark">✓ Completed</span>' : ''}${draft ? `<span>Saved at ${Math.min(draft.index + 1, draft.questionIds.length)}/${draft.questionIds.length}</span>` : ''}</div></div>
        <button class="start-button" data-start-level="${key}">${label}</button>
      </article>`;
    }).join('');

    document.getElementById('best-scores').innerHTML = Object.keys(levels).map(key => {
      const tries = state.history.filter(item => item.level === key);
      const best = tries.length ? Math.max(...tries.map(item => item.score)) : 0;
      return `<div class="progress-row"><div class="progress-label"><span>${levels[key].label}</span><strong>${tries.length ? `${best}%` : 'Not attempted'}</strong></div><div class="progress-track"><div class="progress-bar" style="width:${best}%"></div></div></div>`;
    }).join('');

    document.getElementById('lock-row').innerHTML = Object.keys(levels).map(key => `<span class="lock-chip ${state.completed[key] ? 'done' : ''}">${state.completed[key] ? '✓' : '○'} ${levels[key].label}</span>`).join('');
    const unlocked = completedCount === 3;
    const reviewButton = document.getElementById('review-button');
    reviewButton.disabled = !unlocked || uniqueMistakes.length === 0;
    reviewButton.textContent = !unlocked ? 'Locked' : state.drafts.review ? 'Resume review' : uniqueMistakes.length ? `Review ${uniqueMistakes.length} mistake${uniqueMistakes.length === 1 ? '' : 's'}` : 'No mistakes yet';
    document.getElementById('review-copy').textContent = !unlocked
      ? 'Complete Easy, Medium, and Hard once to unlock this exam.'
      : uniqueMistakes.length
        ? 'Unlocked. This exam uses only unique questions missed in earlier attempts for this collection.'
        : 'Unlocked. Finish an exam with an incorrect answer to create a review set.';
  }

  function startExam(level){
    const saved = state.drafts[level];
    let pool;
    if (saved) {
      pool = saved.questionIds.map(id => questions.find(question => question.id === id)).filter(Boolean);
      activeExam = { level, questions:pool, index:Math.min(saved.index, Math.max(0, pool.length - 1)), responses:{ ...saved.responses }, startedAt:saved.startedAt };
    } else {
      pool = level === 'review'
        ? [...new Set(state.mistakes.map(item => item.questionId))].map(id => questions.find(question => question.id === id)).filter(Boolean)
        : questions.filter(question => question.level === level);
      activeExam = { level, questions:pool, index:0, responses:{}, startedAt:new Date().toISOString() };
    }
    if (!pool.length) { showToast('There are no saved mistakes to review yet.'); return; }
    persistDraft();
    showView('exam');
    renderQuestion();
  }

  function persistDraft(){
    if (!activeExam || !state || !currentBank) return;
    state.drafts[activeExam.level] = {
      questionIds:activeExam.questions.map(question => question.id),
      index:activeExam.index,
      responses:{ ...activeExam.responses },
      startedAt:activeExam.startedAt
    };
    saveState();
  }

  function renderQuestion(){
    const question = activeExam.questions[activeExam.index];
    const total = activeExam.questions.length;
    const saved = activeExam.responses[question.id] || '';
    document.getElementById('exam-level-label').textContent = activeExam.level === 'review' ? `${currentBank.shortTitle} · Mistake Review` : `${currentBank.shortTitle} · ${levels[activeExam.level].label}`;
    document.getElementById('question-count').textContent = `Question ${activeExam.index + 1} of ${total}`;
    document.getElementById('exam-progress-bar').style.width = `${(activeExam.index + 1) / total * 100}%`;
    const input = question.type === 'mcq'
      ? `<div class="options" role="radiogroup" aria-label="Answer choices">${question.options.map((option, index) => `<button class="option ${saved === option ? 'selected' : ''}" role="radio" aria-checked="${saved === option}" data-option="${escapeHTML(option)}"><span class="option-key">${String.fromCharCode(65 + index)}</span><span>${escapeHTML(option)}</span></button>`).join('')}</div>`
      : `<label for="short-answer" class="question-type">Your short answer</label><input class="short-input" id="short-answer" autocomplete="off" value="${escapeHTML(saved)}" placeholder="Type the finding or term"><p class="input-hint">Capitalization does not matter. Use the most specific laboratory term you know.</p>`;
    const typeLabel = question.type === 'mcq' ? 'Multiple choice' : question.figure ? 'Figure-based short answer' : 'Short answer';
    document.getElementById('question-card').innerHTML = `
      <div class="question-type">${typeLabel} · ${escapeHTML(question.topic)}</div>
      <h2>${escapeHTML(question.prompt)}</h2>${question.figure || ''}${input}
      <div class="exam-actions"><button class="ghost-button" id="exit-exam">Save & exit</button><button class="primary-button" id="next-question" ${saved ? '' : 'disabled'}>${activeExam.index === total - 1 ? 'Finish exam' : 'Next question'}</button></div>`;
    document.getElementById('exit-exam').addEventListener('click', () => {
      persistDraft(); activeExam = null; showView('dashboard'); showToast('Exam progress saved.');
    });
    const next = document.getElementById('next-question');
    if (question.type === 'mcq') {
      document.querySelectorAll('[data-option]').forEach(button => button.addEventListener('click', () => {
        activeExam.responses[question.id] = button.dataset.option;
        document.querySelectorAll('[data-option]').forEach(item => { item.classList.toggle('selected', item === button); item.setAttribute('aria-checked', item === button); });
        next.disabled = false; persistDraft();
      }));
    } else {
      const answer = document.getElementById('short-answer');
      answer.focus();
      answer.addEventListener('input', () => { activeExam.responses[question.id] = answer.value; next.disabled = !answer.value.trim(); persistDraft(); });
      answer.addEventListener('keydown', event => { if (event.key === 'Enter' && answer.value.trim()) advanceExam(); });
    }
    next.addEventListener('click', advanceExam);
  }

  function advanceExam(){
    if (activeExam.index < activeExam.questions.length - 1) {
      activeExam.index += 1; persistDraft(); renderQuestion(); window.scrollTo({ top:0, behavior:'smooth' });
    } else finishExam();
  }

  function finishExam(){
    const exam = activeExam;
    const graded = exam.questions.map(question => {
      const response = exam.responses[question.id] || '';
      return { questionId:question.id, response, correct:isCorrect(question, response) };
    });
    const correctCount = graded.filter(item => item.correct).length;
    const score = Math.round(correctCount / graded.length * 100);
    const attemptId = `attempt-${Date.now()}`;
    const completedAt = new Date().toISOString();
    graded.filter(item => !item.correct).forEach(item => state.mistakes.push({ questionId:item.questionId, attemptId, response:item.response, date:completedAt }));
    state.history.unshift({ id:attemptId, collectionId:currentBank.id, level:exam.level, score, correctCount, total:graded.length, answers:graded, startedAt:exam.startedAt, date:completedAt });
    if (exam.level !== 'review') state.completed[exam.level] = true;
    delete state.drafts[exam.level];
    saveState(); activeExam = null;
    renderResults(exam, graded, score, correctCount);
    showView('results');
  }

  function renderResults(exam, graded, score, correctCount){
    const title = score === 100 ? 'Excellent work.' : score >= 70 ? 'Solid result.' : 'Your review set is growing.';
    const details = graded.map(item => {
      const question = questions.find(candidate => candidate.id === item.questionId);
      const rightAnswer = question.type === 'mcq' ? question.answer : question.displayAnswer;
      return `<div class="result-item ${item.correct ? 'correct' : 'wrong'}"><div class="result-icon">${item.correct ? '✓' : '×'}</div><div><h4>${escapeHTML(question.prompt)}</h4><div class="result-answer">Your answer: <strong>${escapeHTML(item.response || 'No answer')}</strong>${item.correct ? '' : ` · Correct answer: <strong>${escapeHTML(rightAnswer)}</strong>`}</div><div class="explanation">${escapeHTML(question.explanation)} <span aria-hidden="true">·</span> ${escapeHTML(question.source)}</div></div></div>`;
    }).join('');
    document.getElementById('result-panel').innerHTML = `<div class="result-hero"><div class="result-score"><strong>${score}%</strong></div><h2>${title}</h2><p>${escapeHTML(currentBank.title)} · ${correctCount} of ${graded.length} correct · ${graded.length - correctCount} saved to mistake history</p></div><div class="result-details">${details}</div><div class="result-actions"><button class="secondary-button" id="view-history-result">View history</button><button class="primary-button" id="back-dashboard">Back to dashboard</button></div>`;
    document.getElementById('view-history-result').addEventListener('click', () => showView('history'));
    document.getElementById('back-dashboard').addEventListener('click', () => showView('dashboard'));
  }

  function renderHistory(){
    const list = document.getElementById('history-list');
    if (!state.history.length) {
      list.innerHTML = '<div class="empty-state"><strong>No completed exams yet</strong>Your first result in this collection will appear here after you finish an exam.</div>';
      return;
    }
    list.innerHTML = state.history.map(item => {
      const label = item.level === 'review' ? 'Mistake Review' : `${levels[item.level]?.label || item.level} Exam`;
      const date = new Intl.DateTimeFormat(undefined, { dateStyle:'medium', timeStyle:'short' }).format(new Date(item.date));
      return `<article class="history-item"><div><div class="history-name">${escapeHTML(label)}</div><div class="history-date">${escapeHTML(date)}</div></div><div class="score-badge">${item.score}%</div><div class="history-answers">${item.correctCount}/${item.total} correct · ${item.total - item.correctCount} incorrect</div></article>`;
    }).join('');
  }

  function exportResults(){
    if (!state.history.length) { showToast('Complete an exam before exporting results.'); return; }
    const payload = { exportedAt:new Date().toISOString(), app:'MicroLab Exam', collection:{ id:currentBank.id, title:currentBank.title }, results:state.history, mistakeHistory:state.mistakes };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `microlab-${currentBank.id}-results.json`; link.click();
    URL.revokeObjectURL(url); showToast('Results exported.');
  }

  document.addEventListener('click', event => {
    const select = event.target.closest('[data-select-bank]');
    if (select) { selectCollection(select.dataset.selectBank); return; }
    const flashDeck = event.target.closest('[data-select-flash-deck]');
    if (flashDeck) { selectFlashDeck(flashDeck.dataset.selectFlashDeck); return; }
    const flashAction = event.target.closest('[data-flash-action]');
    if (flashAction) {
      if (flashAction.dataset.flashAction === 'library') showView('flashcards');
      if (flashAction.dataset.flashAction === 'review') restartFlashcards(true);
      if (flashAction.dataset.flashAction === 'again') restartFlashcards(false);
      return;
    }
    const nav = event.target.closest('[data-view]');
    if (nav) { showView(nav.dataset.view); return; }
    const start = event.target.closest('[data-start-level]');
    if (start) startExam(start.dataset.startLevel);
  });
  document.getElementById('review-button').addEventListener('click', () => startExam('review'));
  document.getElementById('export-button').addEventListener('click', exportResults);
  document.getElementById('flip-card').addEventListener('click', flipFlashcard);
  document.getElementById('review-flashcard').addEventListener('click', () => markFlashcard('review'));
  document.getElementById('know-flashcard').addEventListener('click', () => markFlashcard('known'));

  function registerWebMCP(){
    const context = document.modelContext;
    if (!context?.registerTool) return;
    try {
      void Promise.resolve(context.registerTool({
        name:'read_exam_progress', title:'Read exam progress',
        description:'Read the selected exam collection, completed levels, attempt count, best scores, and unique saved mistakes.',
        inputSchema:{ type:'object', properties:{}, additionalProperties:false },
        annotations:{ readOnlyHint:true, untrustedContentHint:false },
        execute(){
          if (!currentBank || !state) return { selectedCollection:null };
          const bestScores = Object.fromEntries(Object.keys(levels).map(level => [level, Math.max(0, ...state.history.filter(item => item.level === level).map(item => item.score))]));
          return { selectedCollection:currentBank.title, completedLevels:Object.keys(levels).filter(level => state.completed[level]), attempts:state.history.length, uniqueMistakes:new Set(state.mistakes.map(item => item.questionId)).size, bestScores };
        }
      })).catch(() => {});
    } catch {}
  }

  renderLibrary();
  showView('library');
  registerWebMCP();
})();
