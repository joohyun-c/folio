const test = require('node:test');
const assert = require('node:assert/strict');
const {recommendWithGemini, checkResult} = require('./gemini-recommend.cjs');

const book = {id:'data4library:9781234567897',title:'데이터로 일하기',author:'김도서',description:'실제 업무 사례와 데이터 분석 과정을 단계별로 설명합니다. 고객의 선택을 이해하고 팀의 의사결정에 적용하는 방법을 다룹니다.',source:'data4library'};

test('AI can only choose supplied books and quote their actual descriptions', () => {
  const candidates = [{id:book.id,description:book.description}];
  const result = checkResult({recommendations:[
    {id:'invented',reason:'데이터로 일하는 방법을 배우는 데 도움이 됩니다.',evidence:'실제 업무 사례'},
    {id:book.id,reason:'데이터 분석을 실무에 적용하는 방법을 살펴볼 수 있습니다.',evidence:'실제 업무 사례와 데이터 분석 과정을 단계별로 설명합니다.'},
    {id:book.id,reason:'중복입니다.',evidence:'실제 업무 사례'},
    {id:book.id,reason:'없는 내용을 지어냅니다.',evidence:'책에 없는 문장입니다.'}
  ]}, candidates);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, book.id);
});

test('missing key never sends book data to Gemini', async () => {
  const result = await recommendWithGemini({key:'',profile:{interests:['일과 커리어']},books:[book],fetchImpl:() => {throw Error('unexpected network call')}});
  assert.deepEqual(result, {configured:false,recommendations:[]});
});

test('Gemini request uses server key and returns only validated Korean reasons', async () => {
  let called = 0;
  const fetchImpl = async (url, options) => {
    called++;
    assert.match(url,/generativelanguage\.googleapis\.com/);
    assert.equal(options.headers['x-goog-api-key'],'private-test-key');
    const payload = JSON.parse(options.body);
    assert.equal(payload.contents[0].parts[0].text.includes(book.title),true);
    assert.match(payload.contents[0].parts[0].text,/인물과 관계/);
    assert.match(payload.contents[0].parts[0].text,/좋아한 책/);
    return {ok:true,status:200,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({recommendations:[{id:book.id,reason:'실제 업무 사례가 소개되어 있어 실무 적용을 살펴보기에 적합합니다.',evidence:'실제 업무 사례와 데이터 분석 과정을 단계별로 설명합니다.'}]})}]}}]})};
  };
  const result = await recommendWithGemini({key:'private-test-key',profile:{goals:['실무에 적용'],taste:{liked:{title:'좋아한 책',aspect:'people'}}},books:[book],fetchImpl});
  assert.equal(called,1);
  assert.equal(result.recommendations.length,1);
  assert.equal(JSON.stringify(result).includes('private-test-key'),false);
});

test('quota errors do not become invented recommendations', async () => {
  const result = await recommendWithGemini({key:'test',books:[book],fetchImpl:async()=>({ok:false,status:429})});
  assert.deepEqual(result,{configured:true,recommendations:[],error:'limit'});
});
