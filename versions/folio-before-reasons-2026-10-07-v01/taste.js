(() => {
  'use strict';
  const ASPECTS = {
    people: {label:'인물과 관계', korean:'인물 관계 소설', english:'character driven relationships', pattern:/인물|주인공|가족|우정|친구|관계|character|family|friendship|relationship/i},
    comfort: {label:'따뜻한 위로', korean:'따뜻한 위로 소설', english:'heartwarming comforting fiction', pattern:/위로|다정|따뜻|치유|힐링|comfort|heartwarm|healing/i},
    ideas: {label:'새로운 시각', korean:'새로운 관점 인문', english:'new perspectives ideas', pattern:/새로운 관점|새롭게 바라|재해석|통념|질문|다른 시각|new perspective|rethink|reframe|challenge conventional/i},
    workflow: {label:'일하는 방식·습관', korean:'업무 생산성 습관', english:'work productivity habits', pattern:/일하는 방식|습관|생산성|우선순위|시간 관리|집중|몰입|productivity|habit|work routine|time management|prioriti[sz]|deep work/i},
    practical: {label:'일에 쓰는 사례', korean:'실무 사례 비즈니스', english:'practical case studies business', pattern:/사례|실무|실전|현장|실습|case stud(?:y|ies)|practical|real.world|hands.on/i},
    suspense: {label:'긴장감 있는 전개', korean:'추리 스릴러 소설', english:'thriller mystery suspense', pattern:/긴장|반전|추리|미스터리|스릴러|범인|suspense|thriller|mystery|twist/i},
    short: {label:'짧은 분량', korean:'짧은 책', english:'short books', pattern:/짧은|단편|short stor|short read|brief/i},
    dark: {label:'어두운 분위기', korean:'어두운 소설', english:'dark fiction', pattern:/어두운|잔혹|폭력|공포|호러|dark|violent|horror/i}
  };
  function normalizeEntry(value) {
    const title = typeof value?.title === 'string' ? value.title.trim().slice(0, 80) : '';
    const aspect = Object.hasOwn(ASPECTS, value?.aspect) ? value.aspect : '';
    return title && aspect ? {title, aspect} : null;
  }
  function normalizeTaste(value) {
    return {liked:normalizeEntry(value?.liked), disliked:normalizeEntry(value?.disliked)};
  }
  function hasTaste(value) {
    const taste = normalizeTaste(value);
    return !!(taste.liked || taste.disliked);
  }
  function evaluateBook(book, value) {
    const taste = normalizeTaste(value);
    const title = String(book?.title || '').trim().toLocaleLowerCase();
    const description = String(book?.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const tags = Array.isArray(book?.tags) ? book.tags.map(String) : [];
    const fiction = tags.some((tag) => /^(소설|fiction|novel|literary fiction)(?:\b|\s|\/|$)/i.test(tag.trim()));
    const work = tags.some((tag) => /일과 커리어|경제|business|economics|management|marketing|sales|finance|technology|computers|data|career|self.help/i.test(tag));
    const result = {score:0, liked:null, disliked:null, excluded:false};
    for (const [kind, entry] of Object.entries(taste)) {
      if (!entry) continue;
      if (title === entry.title.toLocaleLowerCase()) {result.excluded=true;continue}
      if (book?.source === 'example') continue;
      if (['people','comfort','suspense','dark'].includes(entry.aspect) && !fiction) continue;
      if (['workflow','practical'].includes(entry.aspect) && !work) continue;
      const aspect = ASPECTS[entry.aspect];
      let evidence = '';
      if (entry.aspect === 'short' && Number(book?.pages) > 0 && Number(book.pages) <= 250) evidence = `${book.pages}쪽`;
      else evidence = description.match(aspect.pattern)?.[0] || '';
      if (!evidence) continue;
      result[kind] = {title:entry.title, aspect:aspect.label, evidence};
      result.score += kind === 'liked' ? 30 : -35;
    }
    return result;
  }
  const api = {ASPECTS, normalizeTaste, hasTaste, evaluateBook};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.FolioTaste = api;
})();
