/* folio: 책 검색 결과는 Open Library에서, 저장한 책은 이 브라우저에서만 관리합니다. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const ui = {
    searchInput: $('searchInput'), searchButton: $('searchButton'), moodChips: $('moodChips'),
    bookGrid: $('bookGrid'), statusText: $('statusText'), sectionTitle: $('sectionTitle'),
    shelfCount: $('shelfCount'), shelfList: $('shelfList'), quizButton: $('quizButton'),
    quizPanel: $('quizPanel'), quizMood: $('quizMood'), quizLength: $('quizLength'),
    quizSubmit: $('quizSubmit'), bookDialog: $('bookDialog'), dialogContent: $('dialogContent'),
    toast: $('toast'), feedTab: $('feedTab'), shelfTab: $('shelfTab'),
    feedView: $('feedView'), shelfView: $('shelfView'),
    authorFilters: $('authorFilters'), authorBooks: $('authorBooks'),
    authorIntro: $('authorIntro'), authorFavoriteButton: $('authorFavoriteButton'),
    personalResults: $('personalResults'), personalReset: $('personalReset')
  };
  if (Object.values(ui).some((element) => !element)) return;

  const STORAGE_KEY = 'folio.savedBooks.v1';
  const AUTHOR_STORAGE_KEY = 'folio.favoriteAuthors.v1';
  const NOTES_STORAGE_KEY = 'folio.personalNotes.v1';
  const PREFERENCE_STORAGE_KEY = 'folio.readingPreference.v1';
  const API_URL = 'https://openlibrary.org/search.json';
  const moodInfo = {
    comfort: { label: '마음이 편해지는' },
    curious: { label: '새로운 생각' },
    focus: { label: '집중하고 싶은' },
    story: { label: '이야기에 빠지는' }
  };
  const authorPaths = {
    '손원평': {
      intro: '「아몬드」가 마음에 남았다면, 같은 작가의 다른 이야기로 이어가 보세요.',
      works: [
        { title: '아몬드', note: '시작한 책', source: 'https://www.yes24.com/product/goods/38188003' },
        { title: '서른의 반격', note: '다른 인물의 목소리', source: 'https://www.yes24.com/product/goods/53580370' },
        { title: '튜브', note: '그다음 이야기', source: 'https://www.yes24.com/product/goods/110726392' }
      ]
    },
    '김호연': {
      intro: '「불편한 편의점」을 좋아했다면 후속편과 다른 장편으로 이어가 보세요.',
      works: [
        { title: '불편한 편의점', note: '시작한 책' },
        { title: '불편한 편의점 2', note: '이야기의 다음 장', source: 'https://www.yes24.com/product/goods/111088149' },
        { title: '연적', note: '같은 작가의 다른 작품' }
      ]
    },
    '이미예': {
      intro: '「달러구트 꿈 백화점」의 세계가 좋았다면 두 번째 이야기를 펼쳐 보세요.',
      works: [
        { title: '달러구트 꿈 백화점', note: '시작한 책' },
        { title: '달러구트 꿈 백화점 2', note: '이야기의 다음 장', source: 'https://www.yes24.com/product/goods/102789938' }
      ]
    }
  };
  // 첫 화면·기분별 추천·검색 오류에 쓰는 예시입니다. 실제 API 응답과 구분해 표시합니다.
  const demoBooks = [
    { id: 'demo:almond', title: '아몬드', author: '손원평', mood: 'story', source: 'demo' },
    { id: 'demo:convenience', title: '불편한 편의점', author: '김호연', mood: 'comfort', source: 'demo' },
    { id: 'demo:fish', title: '물고기는 존재하지 않는다', author: '룰루 밀러', mood: 'curious', source: 'demo' },
    { id: 'demo:habits', title: '아주 작은 습관의 힘', author: '제임스 클리어', mood: 'focus', source: 'demo' },
    { id: 'demo:dream', title: '달러구트 꿈 백화점', author: '이미예', mood: 'story', source: 'demo' },
    { id: 'demo:lessons', title: '모모', author: '미하엘 엔데', mood: 'comfort', source: 'demo' },
    { id: 'demo:namiya', title: '나미야 잡화점의 기적', author: '히가시노 게이고', mood: 'comfort', source: 'demo' },
    { id: 'demo:sapiens', title: '사피엔스', author: '유발 하라리', mood: 'curious', source: 'demo' },
    { id: 'demo:selfish-gene', title: '이기적 유전자', author: '리처드 도킨스', mood: 'curious', source: 'demo' },
    { id: 'demo:deep-work', title: '몰입 확장판', author: '황농문', mood: 'focus', source: 'demo' },
    { id: 'demo:one-thing', title: '원씽', author: '게리 켈러 · 제이 파파산', mood: 'focus', source: 'demo' },
    { id: 'demo:proof', title: '구의 증명', author: '최진영', mood: 'story', source: 'demo' }
  ];
  const linkedExamples = [
    { id: 'demo:counterattacks', title: '서른의 반격', author: '손원평', source: 'demo' },
    { id: 'demo:tube', title: '튜브', author: '손원평', source: 'demo' },
    { id: 'demo:convenience-2', title: '불편한 편의점 2', author: '김호연', source: 'demo' },
    { id: 'demo:rival', title: '연적', author: '김호연', source: 'demo' },
    { id: 'demo:dream-2', title: '달러구트 꿈 백화점 2', author: '이미예', source: 'demo' },
    { id: 'demo:wandeuki', title: '완득이', author: '김려령', source: 'demo' },
    { id: 'demo:kim-jiyoung', title: '82년생 김지영', author: '조남주', source: 'demo' },
    { id: 'demo:murderers-memory', title: '살인자의 기억법', author: '김영하', source: 'demo' }
  ];
  // 확인한 예스24 상품 판본의 표지를 보여 줍니다. 재고·가격 정보는 제공하지 않습니다.
  const yes24Catalog = {
    'demo:almond': 38188003, 'demo:convenience': 99308021,
    'demo:fish': 105526047, 'demo:habits': 69655504,
    'demo:dream': 91065309, 'demo:lessons': 125711161,
    'demo:namiya': 116586056, 'demo:sapiens': 23030284,
    'demo:selfish-gene': 4078717, 'demo:deep-work': 126160327,
    'demo:one-thing': 9349031, 'demo:proof': 118578901,
    'demo:counterattacks': 53580370, 'demo:tube': 110726392,
    'demo:convenience-2': 111088149, 'demo:rival': 20840022,
    'demo:dream-2': 102789938, 'demo:wandeuki': 2849279,
    'demo:murderers-memory': 91901136, 'demo:kim-jiyoung': 32972572
  };
  [...demoBooks, ...linkedExamples].forEach((book) => { book.yes24Id = yes24Catalog[book.id] || null; });
  const linkedMoods = { 'demo:counterattacks': 'story', 'demo:tube': 'story',
    'demo:convenience-2': 'comfort', 'demo:rival': 'story', 'demo:dream-2': 'story',
    'demo:wandeuki': 'story', 'demo:kim-jiyoung': 'story', 'demo:murderers-memory': 'story' };
  linkedExamples.forEach((book) => { book.mood = linkedMoods[book.id]; });

  const state = {
    books: demoBooks,
    saved: readSaved(),
    notes: readNotes(),
    favoriteAuthors: readFavoriteAuthors(),
    readingPreference: readReadingPreference(),
    personalCount: 3,
    activeAuthor: '손원평',
    mood: 'all',
    requestId: 0,
    controller: null,
    toastTimer: null
  };
  ui.toast.hidden = true;

  function readSaved() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((book) => book && typeof book.id === 'string' && typeof book.title === 'string').slice(0, 100);
    } catch {
      return [];
    }
  }

  function readFavoriteAuthors() {
    try {
      const parsed = JSON.parse(localStorage.getItem(AUTHOR_STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter((name) => Object.hasOwn(authorPaths, name)) : [];
    } catch { return []; }
  }

  function readNotes() {
    try {
      const parsed = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  }
  function readReadingPreference() {
    try {
      const value = localStorage.getItem(PREFERENCE_STORAGE_KEY);
      return Object.hasOwn(moodInfo, value) ? value : null;
    } catch { return null; }
  }

  function renderAuthorPath() {
    const author = state.activeAuthor;
    const path = authorPaths[author];
    ui.authorIntro.textContent = path.intro;
    ui.authorFilters.querySelectorAll('[data-author]').forEach((button) => {
      const active = button.dataset.author === author;
      button.classList.toggle('active', active);
      button.classList.toggle('favorite', state.favoriteAuthors.includes(button.dataset.author));
      button.setAttribute('aria-pressed', String(active));
    });
    const favorite = state.favoriteAuthors.includes(author);
    ui.authorFavoriteButton.textContent = favorite ? '★ 좋아하는 작가로 저장됨' : '☆ 좋아하는 작가로 저장';
    ui.authorFavoriteButton.setAttribute('aria-pressed', String(favorite));
    const fragment = document.createDocumentFragment();
    path.works.forEach((work, index) => {
      const card = create('article', 'author-work');
      card.append(create('span', 'work-index', String(index + 1).padStart(2, '0')));
      card.append(create('p', 'work-note', work.note));
      card.append(create('h3', '', work.title));
      const actions = create('div', 'work-actions');
      const search = create('button', 'text-button', '책 검색 ↗');
      search.type = 'button';
      search.dataset.searchBook = work.title;
      actions.append(search);
      if (work.source) {
        const source = create('a', 'source-link', '작품 확인');
        source.href = work.source;
        source.target = '_blank';
        source.rel = 'noopener noreferrer';
        actions.append(source);
      }
      card.append(actions);
      fragment.append(card);
    });
    ui.authorBooks.replaceChildren(fragment);
  }

  function persistSaved() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.saved));
      return true;
    } catch {
      showToast('이 기기에서 책을 저장할 수 없어요. 브라우저 저장 설정을 확인해 주세요.');
      return false;
    }
  }

  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.hidden = false;
    ui.toast.classList.add('visible');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      ui.toast.classList.remove('visible');
      ui.toast.hidden = true;
    }, 3600);
  }

  function setStatus(message) { ui.statusText.textContent = message; }

  function relatedExamples(query) {
    const term = query.trim().toLocaleLowerCase();
    return [...demoBooks, ...linkedExamples].filter((book) =>
      book.title.toLocaleLowerCase().includes(term) || book.author.toLocaleLowerCase().includes(term)
    ).slice(0, 6);
  }

  function safeWorkUrl(key) {
    const normalized = String(key || '').replace(/^\/+/, '');
    return /^works\/OL\d+W$/.test(normalized) ? `https://openlibrary.org/${normalized}` : null;
  }

  function bookUrl(book) {
    if (Number.isInteger(book.yes24Id) && book.yes24Id > 0) return `https://www.yes24.com/product/goods/${book.yes24Id}`;
    if (book.url && /^https:\/\/www\.yes24\.com\/product\/goods\/\d+$/.test(book.url)) return book.url;
    if (book.url && /^https:\/\/openlibrary\.org\//.test(book.url)) return book.url;
    if (book.isbn && /^\d{10}(\d{3})?$/.test(book.isbn)) return `https://openlibrary.org/isbn/${book.isbn}`;
    return 'https://openlibrary.org/';
  }

  function coverUrl(book) {
    if (Number.isInteger(book.yes24Id) && book.yes24Id > 0) return `https://image.yes24.com/goods/${book.yes24Id}/L`;
    if (Number.isInteger(book.coverId) && book.coverId > 0) return `https://covers.openlibrary.org/b/id/${book.coverId}-L.jpg?default=false`;
    if (book.isbn && /^\d{10}(\d{3})?$/.test(book.isbn)) return `https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg?default=false`;
    return null;
  }

  function normalizeBook(doc) {
    if (!doc || typeof doc.title !== 'string') return null;
    const url = safeWorkUrl(doc.key);
    if (!url) return null;
    const coverId = Number.isInteger(doc.cover_i) ? doc.cover_i : null;
    const isbn = Array.isArray(doc.isbn) ? doc.isbn.find((value) => /^\d{13}$/.test(value)) : null;
    const pages = Number.isInteger(doc.number_of_pages_median) ? doc.number_of_pages_median : null;
    return {
      id: doc.key.startsWith('/') ? doc.key : `/${doc.key}`,
      title: doc.title.trim(),
      author: Array.isArray(doc.author_name) && doc.author_name.length ? String(doc.author_name[0]) : '저자 정보 없음',
      year: Number.isInteger(doc.first_publish_year) ? doc.first_publish_year : null,
      coverId, isbn: isbn || null, pages, url, source: 'openlibrary'
    };
  }

  function reasonFor(book, mood, length) {
    if (book.source === 'demo') return mood !== 'all' && moodInfo[mood]
      ? `‘${moodInfo[mood].label}’ 기분을 위한 예시 추천이에요.`
      : '화면을 살펴볼 수 있도록 넣어둔 예시 책이에요.';
    if (mood && mood !== 'all') {
      const base = `‘${moodInfo[mood].label}’ 주제어로 찾은 책이에요.`;
      if (length !== 'any' && book.pages) return `${base} 등록된 분량은 약 ${book.pages}쪽이에요.`;
      return base;
    }
    return '검색어와 관련된 Open Library 등록 도서예요.';
  }

  function personalizedBooks() {
    const savedIds = new Set(state.saved.map((book) => book.id));
    const savedAuthors = new Set(state.saved.map((book) => book.author));
    const savedMoods = new Set(state.saved.map((book) => book.mood).filter(Boolean));
    const hasSignals = Boolean(state.readingPreference || state.saved.length || state.favoriteAuthors.length);
    if (!hasSignals) return [];
    return [...demoBooks, ...linkedExamples]
      .filter((book) => !savedIds.has(book.id))
      .map((book, index) => {
        let score = 0;
        const reasons = [];
        if (book.mood && book.mood === state.readingPreference) {
          score += 9; reasons.push(`선택한 ‘${moodInfo[book.mood].label}’ 취향`);
        }
        if (book.mood && savedMoods.has(book.mood)) {
          score += 3; reasons.push('저장한 책과 비슷한 기분');
        }
        if (state.favoriteAuthors.includes(book.author)) {
          score += 5; reasons.push(`좋아하는 작가 ${book.author}`);
        } else if (savedAuthors.has(book.author)) {
          score += 4; reasons.push(`저장한 ${book.author} 작가의 다른 책`);
        }
        return { book, score, reason: reasons[0], index };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, state.personalCount);
  }

  function renderPersonalRecommendations() {
    ui.personalResults.replaceChildren();
    ui.personalReset.hidden = !state.readingPreference;
    const matches = personalizedBooks();
    if (!state.readingPreference && !state.saved.length && !state.favoriteAuthors.length) {
      ui.personalResults.append(create('p', 'personal-empty', '책을 저장하거나 좋아하는 작가를 고르면 여기에 나만의 추천이 생겨요.'));
      return;
    }
    const heading = create('p', 'personal-heading', 'FOR YOUR SHELF · 나만의 추천');
    ui.personalResults.append(heading);
    if (!matches.length) {
      ui.personalResults.append(create('p', 'personal-empty', '지금 가진 예시 책에서는 맞는 책을 찾지 못했어요. 다른 기분을 골라보세요.'));
      return;
    }
    matches.forEach(({ book, reason }) => {
      const item = create('button', 'personal-book');
      item.type = 'button';
      item.setAttribute('aria-label', `${book.title} 자세히 보기`);
      item.append(createCover(book));
      const copy = create('span', 'personal-book-copy');
      copy.append(create('strong', '', book.title), create('small', '', reason));
      item.append(copy);
      item.addEventListener('click', () => showDetails(book));
      ui.personalResults.append(item);
    });
    ui.personalResults.append(create('small', 'personal-footnote', '이 기기에 저장한 선택으로 고른 예시 책이에요. 검색 기록은 사용하지 않아요.'));
  }

  function create(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function createCover(book) {
    const wrap = create('div', 'book-cover');
    const url = coverUrl(book);
    if (url) {
      const image = create('img');
      image.src = url;
      image.alt = `${book.title} 표지`;
      image.loading = 'lazy';
      image.addEventListener('error', () => {
        image.remove();
        wrap.append(create('span', 'book-cover-placeholder', book.title));
      }, { once: true });
      wrap.append(image);
    } else {
      wrap.append(create('span', 'book-cover-placeholder', book.source === 'demo' ? book.title : '표지 정보 없음'));
    }
    return wrap;
  }

  function isSaved(book) { return state.saved.some((item) => item.id === book.id); }

  function toggleSaved(book) {
    const previous = [...state.saved];
    if (isSaved(book)) {
      state.saved = state.saved.filter((item) => item.id !== book.id);
    } else {
      // 제목, 저자 등 화면을 복원하는 데 필요한 공개 책 정보만 저장합니다.
      state.saved.unshift({ id: book.id, title: book.title, author: book.author, year: book.year || null,
        coverId: book.coverId || null, isbn: book.isbn || null, yes24Id: book.yes24Id || null, pages: book.pages || null,
        url: bookUrl(book), source: book.source || 'openlibrary', mood: book.mood || null });
    }
    if (!persistSaved()) { state.saved = previous; return; }
    ui.shelfCount.textContent = String(state.saved.length);
    renderBooks();
    renderShelf();
    renderPersonalRecommendations();
    if (ui.bookDialog.open) showDetails(book);
    showToast(isSaved(book) ? '내 책장에 담았어요.' : '내 책장에서 뺐어요.');
  }

  function createCard(book, mood = 'all', length = 'any') {
    const card = create('article', 'book-card');
    const coverFrame = create('div', 'cover-frame');
    const coverButton = create('button', 'cover-button');
    coverButton.type = 'button';
    coverButton.setAttribute('aria-label', `${book.title} 자세히 보기`);
    coverButton.append(createCover(book));
    coverButton.addEventListener('click', () => showDetails(book, mood, length));
    coverFrame.append(coverButton);
    const quickSave = create('button', `cover-save${isSaved(book) ? ' saved' : ''}`, isSaved(book) ? '✓ 저장됨' : '+ 저장');
    quickSave.type = 'button';
    quickSave.setAttribute('aria-label', `${book.title} ${isSaved(book) ? '책장에서 빼기' : '책장에 저장'}`);
    quickSave.setAttribute('aria-pressed', String(isSaved(book)));
    quickSave.addEventListener('click', () => toggleSaved(book));
    coverFrame.append(quickSave);
    card.append(coverFrame);

    const body = create('div', 'book-meta');
    body.append(create('span', 'source-badge', book.source === 'demo' ? (book.yes24Id ? '큐레이션 · 표지 YES24' : '예시 책') : 'Open Library'));
    const titleButton = create('button', 'book-title', book.title);
    titleButton.type = 'button';
    titleButton.addEventListener('click', () => showDetails(book, mood, length));
    body.append(titleButton);
    body.append(create('p', 'book-author', [book.author, book.year].filter(Boolean).join(' · ')));
    if (Object.hasOwn(authorPaths, book.author)) {
      const authorLink = create('button', 'author-link', `${book.author}의 다른 책 →`);
      authorLink.type = 'button';
      authorLink.addEventListener('click', () => {
        state.activeAuthor = book.author;
        switchView('feed', false);
        renderAuthorPath();
        document.getElementById('authorTrail').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      body.append(authorLink);
    }
    body.append(create('p', 'book-reason', reasonFor(book, mood, length)));
    if (typeof state.notes[book.id] === 'string' && state.notes[book.id]) {
      body.append(create('p', 'my-note', `내 한 줄 · ${state.notes[book.id]}`));
    }
    const actions = create('div', 'card-actions');
    const save = create('button', `save-button${isSaved(book) ? ' saved' : ''}`, isSaved(book) ? '✓ 저장됨' : '+ 책장에 담기');
    save.type = 'button';
    save.setAttribute('aria-pressed', String(isSaved(book)));
    save.addEventListener('click', () => toggleSaved(book));
    actions.append(save);
    body.append(actions);
    card.append(body);
    return card;
  }

  function emptyState(title, detail) {
    const wrap = create('div', 'empty-state');
    wrap.append(create('h3', '', title), create('p', '', detail));
    return wrap;
  }

  function renderBooks(books = state.books, mood = state.mood, length = 'any') {
    ui.bookGrid.replaceChildren();
    if (!books.length) {
      ui.bookGrid.append(emptyState('책을 찾지 못했어요', '다른 제목이나 작가를 검색하거나 기분을 바꿔 보세요.'));
      return;
    }
    const fragment = document.createDocumentFragment();
    books.forEach((book) => fragment.append(createCard(book, mood, length)));
    ui.bookGrid.append(fragment);
  }

  function renderShelf() {
    ui.shelfCount.textContent = String(state.saved.length);
    ui.shelfList.replaceChildren();
    if (!state.saved.length) {
      ui.shelfList.append(emptyState('아직 담아둔 책이 없어요', '둘러보기에서 마음에 드는 책을 책장에 담아 보세요.'));
      return;
    }
    const fragment = document.createDocumentFragment();
    state.saved.forEach((book) => fragment.append(createCard(book)));
    ui.shelfList.append(fragment);
  }

  function showDetails(book, mood = 'all', length = 'any') {
    const content = ui.dialogContent;
    content.replaceChildren();
    const layout = create('div', 'dialog-layout');
    layout.append(createCover(book));
    const info = create('div', 'dialog-info');
    info.append(create('span', 'source-badge', book.source === 'demo' ? (book.yes24Id ? '큐레이션 · 표지 YES24' : '예시 책') : 'Open Library'));
    info.append(create('h2', '', book.title));
    info.append(create('p', 'book-author', [book.author, book.year].filter(Boolean).join(' · ')));
    info.append(create('p', 'book-reason', reasonFor(book, mood, length)));
    if (book.pages) info.append(create('p', 'book-pages', `등록된 분량: 약 ${book.pages}쪽`));
    const actions = create('div', 'dialog-actions');
    const save = create('button', 'primary-button', isSaved(book) ? '책장에서 빼기' : '내 책장에 담기');
    save.type = 'button';
    save.addEventListener('click', () => toggleSaved(book));
    actions.append(save);
    if (book.source !== 'demo' || book.yes24Id) {
      const link = create('a', 'text-button', book.yes24Id ? '예스24에서 판본 보기 ↗' : 'Open Library에서 보기 ↗');
      link.href = bookUrl(book);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      actions.append(link);
    }
    info.append(actions);
    const noteBox = create('div', 'personal-note');
    const noteLabel = create('label', '', '내가 기억하고 싶은 한 줄');
    const noteInput = create('textarea');
    noteInput.maxLength = 220;
    noteInput.rows = 3;
    noteInput.placeholder = '책에서 느낀 점이나 직접 찾은 문장을 적어두세요.';
    noteInput.value = typeof state.notes[book.id] === 'string' ? state.notes[book.id] : '';
    noteLabel.append(noteInput);
    noteBox.append(noteLabel, create('small', '', '이 기기에만 저장되며 공개되지 않아요.'));
    const saveNote = create('button', 'secondary-button', '한 줄 저장');
    saveNote.type = 'button';
    saveNote.addEventListener('click', () => {
      const previous = { ...state.notes };
      const value = noteInput.value.trim();
      if (value) state.notes[book.id] = value;
      else delete state.notes[book.id];
      try { localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(state.notes)); }
      catch { state.notes = previous; showToast('한 줄을 저장할 수 없어요. 브라우저 설정을 확인해 주세요.'); return; }
      renderBooks();
      renderShelf();
      showToast(value ? '나만의 한 줄을 저장했어요.' : '한 줄 기록을 지웠어요.');
    });
    noteBox.append(saveNote);
    info.append(noteBox);
    layout.append(info);
    content.append(layout);
    if (!ui.bookDialog.open) ui.bookDialog.showModal();
  }

  function switchView(view, scrollTop = true) {
    const shelf = view === 'shelf';
    ui.feedView.hidden = shelf;
    ui.shelfView.hidden = !shelf;
    ui.feedTab.classList.toggle('active', !shelf);
    ui.shelfTab.classList.toggle('active', shelf);
    if (shelf) {
      ui.feedTab.removeAttribute('aria-current');
      ui.shelfTab.setAttribute('aria-current', 'page');
      renderShelf();
    } else {
      ui.shelfTab.removeAttribute('aria-current');
      ui.feedTab.setAttribute('aria-current', 'page');
    }
    if (scrollTop) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function findBooks(query, { mood = 'all', length = 'any', title = '검색 결과' } = {}) {
    if (!query.trim()) {
      showToast('검색할 책 제목이나 작가를 입력해 주세요.');
      ui.searchInput.focus();
      return;
    }
    state.controller?.abort();
    state.controller = new AbortController();
    const currentRequest = ++state.requestId;
    ui.sectionTitle.textContent = title;
    setStatus('책을 찾고 있어요…');
    ui.bookGrid.replaceChildren(emptyState('책을 찾고 있어요', 'Open Library에서 책 정보를 불러오는 중입니다.'));
    const params = new URLSearchParams({ q: query, limit: '36', fields: 'key,title,author_name,first_publish_year,cover_i,isbn,number_of_pages_median' });
    try {
      const response = await fetch(`${API_URL}?${params}`, { signal: state.controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.docs)) throw new Error('Unexpected response');
      if (currentRequest !== state.requestId) return;
      let books = data.docs.map(normalizeBook).filter(Boolean);
      books = books.filter((book, index, list) => list.findIndex((item) => item.id === book.id) === index);
      if (length === 'short') books = books.filter((book) => book.pages && book.pages <= 250);
      if (length === 'long') books = books.filter((book) => book.pages && book.pages > 250);
      if (mood !== 'all') books = books.slice(0, 12);
      const examples = books.length ? [] : relatedExamples(query);
      if (examples.length) books = examples;
      state.books = books;
      state.mood = mood;
      renderBooks(books, mood, length);
      setStatus(examples.length ? 'Open Library에 결과가 없어 관련 예시 책을 보여드려요.'
        : books.length ? `${books.length}권을 찾았어요 · Open Library` : '조건에 맞는 책이 없어요. 다른 조건을 골라 보세요.');
    } catch (error) {
      if (error.name === 'AbortError' || currentRequest !== state.requestId) return;
      const fallback = relatedExamples(query);
      state.books = fallback;
      state.mood = mood;
      renderBooks(fallback, mood, length);
      setStatus(fallback.length ? '연결이 원활하지 않아 관련 예시 책을 보여드려요. 다시 검색해 주세요.' : '책 정보를 불러오지 못했어요. 잠시 후 다시 검색해 주세요.');
    }
  }

  function setActiveMood(mood) {
    ui.moodChips.querySelectorAll('[data-mood]').forEach((chip) => {
      const active = chip.dataset.mood === mood;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
  }

  function showMoodBooks(mood, count = 'three', title = moodInfo[mood]?.label) {
    if (!moodInfo[mood]) return;
    state.controller?.abort();
    state.requestId++;
    state.mood = mood;
    const matches = demoBooks.filter((book) => book.mood === mood);
    const books = count === 'one' ? matches.slice(0, 1) : matches;
    state.books = books;
    ui.sectionTitle.textContent = title;
    renderBooks(books, mood);
    setStatus(`${books.length}권의 예시 추천 · 실제 검색 결과와 구분해 표시합니다.`);
  }

  ui.searchButton.addEventListener('click', () => {
    setActiveMood('all');
    findBooks(ui.searchInput.value, { title: `‘${ui.searchInput.value.trim()}’ 검색 결과` });
  });
  ui.searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') ui.searchButton.click();
  });
  ui.moodChips.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-mood]');
    if (!chip) return;
    const mood = chip.dataset.mood;
    setActiveMood(mood);
    ui.searchInput.value = '';
    if (mood === 'all') {
      state.controller?.abort();
      state.requestId++;
      state.mood = 'all';
      state.books = demoBooks;
      ui.sectionTitle.textContent = '발견하는 즐거움';
      renderBooks();
      setStatus('먼저 예시 책을 둘러보세요. 검색하면 실제 책 정보를 가져옵니다.');
    } else if (moodInfo[mood]) {
      showMoodBooks(mood);
    }
  });
  ui.quizButton.addEventListener('click', () => {
    ui.quizPanel.hidden = !ui.quizPanel.hidden;
    ui.quizButton.setAttribute('aria-expanded', String(!ui.quizPanel.hidden));
    if (!ui.quizPanel.hidden) ui.quizMood.focus();
  });
  ui.quizSubmit.addEventListener('click', () => {
    const mood = ui.quizMood.value;
    const count = ui.quizLength.value;
    if (!moodInfo[mood]) return;
    const previous = state.readingPreference;
    state.readingPreference = mood;
    state.personalCount = count === 'one' ? 1 : 3;
    try { localStorage.setItem(PREFERENCE_STORAGE_KEY, mood); }
    catch { state.readingPreference = previous; showToast('취향을 저장할 수 없어요. 브라우저 저장 설정을 확인해 주세요.'); return; }
    renderPersonalRecommendations();
    ui.personalResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  ui.personalReset.addEventListener('click', () => {
    try { localStorage.removeItem(PREFERENCE_STORAGE_KEY); }
    catch { showToast('기분 선택을 지울 수 없어요. 브라우저 저장 설정을 확인해 주세요.'); return; }
    state.readingPreference = null;
    renderPersonalRecommendations();
  });
  ui.feedTab.addEventListener('click', () => switchView('feed'));
  ui.shelfTab.addEventListener('click', () => switchView('shelf'));
  ui.authorFilters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-author]');
    if (!button || !Object.hasOwn(authorPaths, button.dataset.author)) return;
    state.activeAuthor = button.dataset.author;
    renderAuthorPath();
  });
  ui.authorFavoriteButton.addEventListener('click', () => {
    const author = state.activeAuthor;
    const previous = [...state.favoriteAuthors];
    state.favoriteAuthors = state.favoriteAuthors.includes(author)
      ? state.favoriteAuthors.filter((name) => name !== author)
      : [...state.favoriteAuthors, author];
    try { localStorage.setItem(AUTHOR_STORAGE_KEY, JSON.stringify(state.favoriteAuthors)); }
    catch { state.favoriteAuthors = previous; showToast('작가를 저장할 수 없어요. 브라우저 저장 설정을 확인해 주세요.'); return; }
    renderAuthorPath();
    renderPersonalRecommendations();
    showToast(state.favoriteAuthors.includes(author) ? '좋아하는 작가로 저장했어요.' : '좋아하는 작가에서 뺐어요.');
  });
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-search-book]');
    if (!button) return;
    const title = button.dataset.searchBook;
    ui.searchInput.value = title;
    setActiveMood('all');
    switchView('feed', false);
    findBooks(title, { title: `‘${title}’ 검색 결과` });
    ui.searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.querySelectorAll('[data-open-shelf]').forEach((button) => button.addEventListener('click', () => switchView('shelf')));
  const giftFilters = document.getElementById('giftFilters');
  const giftItems = [...document.querySelectorAll('#giftItems .gift-item')];
  giftFilters?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-gift-category]');
    if (!button || !giftFilters.contains(button)) return;
    const category = button.dataset.giftCategory;
    giftFilters.querySelectorAll('[data-gift-category]').forEach((filter) => {
      const active = filter === button;
      filter.classList.toggle('active', active);
      filter.setAttribute('aria-pressed', String(active));
    });
    giftItems.forEach((item) => { item.hidden = category !== 'all' && item.dataset.giftCategory !== category; });
  });
  ui.bookDialog.addEventListener('click', (event) => { if (event.target === ui.bookDialog) ui.bookDialog.close(); });

  renderBooks();
  renderShelf();
  if (state.readingPreference) ui.quizMood.value = state.readingPreference;
  renderPersonalRecommendations();
  if (state.favoriteAuthors.length) state.activeAuthor = state.favoriteAuthors[0];
  renderAuthorPath();
  setStatus('먼저 예시 책을 둘러보세요. 검색하면 실제 책 정보를 가져옵니다.');
})();
