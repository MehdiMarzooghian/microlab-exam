(() => {
  'use strict';

  const STORAGE_PREFIX = 'microlab-exam-v3-';
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
  let toastTimer = null;

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
    if (name !== 'library' && !currentBank) name = 'library';
    if (name === 'library' && activeExam) { persistDraft(); activeExam = null; }
    document.querySelectorAll('.view').forEach(view => { view.hidden = true; });
    const target = document.getElementById(`view-${name}`);
    if (target) target.hidden = false;
    document.querySelectorAll('.nav-button').forEach(button => {
      const active = button.dataset.view === name;
      button.classList.toggle('active', active);
      button.toggleAttribute('aria-current', active);
    });
    const titles = { library:'Exam library', dashboard:currentBank?.title || 'Exam dashboard', history:'Results history', sources:'Source coverage', exam:'Exam in progress', results:'Exam result' };
    document.getElementById('page-title').textContent = titles[name] || 'MicroLab Exam';
    if (name === 'library') renderLibrary();
    if (name === 'dashboard') renderDashboard();
    if (name === 'history') renderHistory();
    if (name === 'sources') updateCoverage();
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
    const nav = event.target.closest('[data-view]');
    if (nav) { showView(nav.dataset.view); return; }
    const start = event.target.closest('[data-start-level]');
    if (start) startExam(start.dataset.startLevel);
  });
  document.getElementById('review-button').addEventListener('click', () => startExam('review'));
  document.getElementById('export-button').addEventListener('click', exportResults);

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
