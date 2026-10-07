const test = require('node:test');
const assert = require('node:assert/strict');
const {normalizeTaste, evaluateBook} = require('../dist/taste.js');

test('a stated reason changes book order only when the candidate has verifiable evidence', () => {
  const candidate = {title:'새 소설',description:'두 가족의 관계를 따라가는 이야기입니다.',tags:['소설'],pages:320};
  const liked = evaluateBook(candidate,{liked:{title:'내가 읽은 책',aspect:'people'}});
  const unlike = evaluateBook(candidate,{liked:{title:'내가 읽은 책',aspect:'practical'}});
  assert.equal(liked.score,30);
  assert.equal(liked.liked.evidence,'가족');
  assert.equal(unlike.score,0);
});

test('disliked reason lowers matching books, source book is not recommended again', () => {
  const candidate = {title:'다른 책',description:'공포와 긴장감이 있는 이야기입니다.',tags:['소설']};
  assert.equal(evaluateBook(candidate,{disliked:{title:'이전 책',aspect:'dark'}}).score,-35);
  assert.equal(evaluateBook({...candidate,title:'이전 책'},{disliked:{title:'이전 책',aspect:'dark'}}).excluded,true);
});

test('untrusted and incomplete taste values are discarded', () => {
  assert.deepEqual(normalizeTaste({liked:{title:'  책  ',aspect:'unknown'},disliked:{title:'',aspect:'short'}}),{liked:null,disliked:null});
  assert.equal(evaluateBook({title:'제목',description:'소개 없음'},{}).score,0);
  assert.equal(evaluateBook({title:'편집 예시',source:'example',description:'folio 편집 태그: 마음과 관계'},{liked:{title:'아몬드',aspect:'people'}}).score,0);
  assert.equal(evaluateBook({title:'업무서',tags:['Business'],description:'조직 안의 관계를 설명합니다.'},{liked:{title:'아몬드',aspect:'people'}}).score,0);
  assert.equal(evaluateBook({title:'무역 스페인어',tags:['Foreign Language Study'],description:'현장 실무 표현을 배웁니다.'},{liked:{title:'원씽',aspect:'practical'}}).score,0);
  assert.equal(evaluateBook({title:'데이터로 일하기',tags:['Business'],description:'실무 사례를 살펴봅니다.'},{liked:{title:'원씽',aspect:'practical'}}).score,30);
  assert.equal(evaluateBook({title:'업무 설계',tags:['Business'],description:'일하는 방식과 우선순위를 다룹니다.'},{liked:{title:'원씽',aspect:'workflow'}}).score,30);
});
