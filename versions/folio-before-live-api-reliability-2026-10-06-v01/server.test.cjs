const test = require('node:test');
const assert = require('node:assert/strict');
const {createAppServer} = require('./server.cjs');

async function withServer(options, run) {
  const server = createAppServer(options);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await run('http://127.0.0.1:' + server.address().port); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('without a key, domestic books report their unavailable state without leaking a credential', async () => {
  await withServer({key:'', fetchImpl:() => { throw Error('must not call Kakao'); }}, async (origin) => {
    const response = await fetch(origin + '/api/books?query=' + encodeURIComponent('소설'));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {configured:false,books:[],source:'kakao'});
  });
});

test('Kakao results use the next page, normalize book details, and remain on the server side', async () => {
  let calls = 0;
  const mockFetch = async (url, options) => {
    calls++;
    assert.equal(url.searchParams.get('query'), '한국 소설');
    assert.equal(url.searchParams.get('page'), '2');
    assert.equal(options.headers.Authorization, 'KakaoAK test-credential');
    return {ok:true,json:async () => ({meta:{is_end:false},documents:[{title:'테스트 소설',authors:['작가'],contents:'책 소개',isbn:'1234567890 9781234567897',thumbnail:'https://example.com/cover.jpg',url:'https://example.com/book'}]})};
  };
  await withServer({key:'test-credential',fetchImpl:mockFetch}, async (origin) => {
    const address = origin + '/api/books?query=' + encodeURIComponent('한국 소설') + '&page=2';
    const first = await fetch(address);
    const body = await first.json();
    assert.equal(body.configured, true);
    assert.equal(body.books[0].id, 'kakao:9781234567897');
    assert.equal(body.books[0].title, '테스트 소설');
    assert.equal(body.books[0].source, 'kakao');
    assert.equal(JSON.stringify(body).includes('test-credential'), false);
    await fetch(address);
    assert.equal(calls, 1);
  });
});

test('only dist files are served', async () => {
  await withServer({key:''}, async (origin) => {
    assert.equal((await fetch(origin + '/')).status, 200);
    assert.equal((await fetch(origin + '/server.cjs')).status, 404);
    assert.equal((await fetch(origin + '/api/books?query=')).status, 400);
  });
});

test('the existing local page can read the proxy without opening it to other origins', async () => {
  await withServer({key:''}, async (origin) => {
    const address = origin + '/api/books?query=' + encodeURIComponent('소설');
    const local = await fetch(address, {headers:{Origin:'http://localhost:8765'}});
    assert.equal(local.headers.get('access-control-allow-origin'), 'http://localhost:8765');
    const external = await fetch(address, {headers:{Origin:'https://example.com'}});
    assert.equal(external.headers.get('access-control-allow-origin'), null);
  });
});

test('a Kakao quota response stops the request without treating it as a paid result', async () => {
  await withServer({key:'test-credential',fetchImpl:async () => ({status:429,ok:false})}, async (origin) => {
    const response = await fetch(origin + '/api/books?query=' + encodeURIComponent('소설'));
    assert.equal(response.status, 429);
    assert.deepEqual(await response.json(), {configured:true,error:'국내 책 검색 요청 한도에 도달했습니다.',source:'kakao'});
  });
});

test('library books and AI capabilities stay unavailable without keys', async () => {
  await withServer({libraryKey:'',geminiKey:'',fetchImpl:()=>{throw Error('must not call upstream')}},async (origin)=>{
    const capabilities=await (await fetch(origin+'/api/capabilities')).json();
    assert.deepEqual(capabilities,{gemini:false,library:false,googleBooks:false});
    const books=await (await fetch(origin+'/api/library-books?query='+encodeURIComponent('한국 소설'))).json();
    assert.equal(books.configured,false);
    const ai=await (await fetch(origin+'/api/recommendations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile:{},books:[]})})).json();
    assert.deepEqual(ai,{configured:false,recommendations:[]});
  });
});

test('Google Books searches Korean volumes without exposing the server key', async () => {
  let calls=0;
  await withServer({booksKey:'private-books-key',fetchImpl:async(url)=>{
    calls++;
    assert.equal(url.hostname,'www.googleapis.com');
    assert.equal(url.searchParams.get('key'),'private-books-key');
    assert.equal(url.searchParams.get('langRestrict'),'ko');
    assert.equal(url.searchParams.get('startIndex'),'30');
    return {ok:true,status:200,json:async()=>({totalItems:35,items:[{id:'volume-1',volumeInfo:{title:'일하는 사람의 책',authors:['김작가'],description:'<b>일하는 방식</b>을 분석합니다.',imageLinks:{thumbnail:'http://books.google.com/cover.jpg'},infoLink:'https://books.google.com/book'}}]})};
  }},async(origin)=>{
    const address=origin+'/api/google-books?query='+encodeURIComponent('일과 커리어')+'&page=2';
    const response=await fetch(address);
    const body=await response.json();
    assert.equal(body.books[0].source,'google');
    assert.equal(body.books[0].title,'일하는 사람의 책');
    assert.equal(body.books[0].description,'일하는 방식을 분석합니다.');
    assert.equal(body.books[0].image,'https://books.google.com/cover.jpg');
    assert.equal(JSON.stringify(body).includes('private-books-key'),false);
    await fetch(address);
    assert.equal(calls,1);
  });
});

test('library search returns Korean books through the server without exposing its key', async () => {
  await withServer({libraryKey:'private-library-key',fetchImpl:async(url)=>{
    assert.equal(url.searchParams.get('authKey'),'private-library-key');
    return {ok:true,status:200,json:async()=>({response:{numFound:1,docs:[{doc:{bookname:'한국 소설',authors:'김작가',isbn13:'9781234567897',description:'한 도시에서 벌어지는 가족의 이야기를 따라갑니다.'}}]}})};
  }},async(origin)=>{
    const response=await fetch(origin+'/api/library-books?query='+encodeURIComponent('한국 소설'));
    const body=await response.json();
    assert.equal(body.books[0].source,'data4library');
    assert.equal(body.books[0].title,'한국 소설');
    assert.equal(JSON.stringify(body).includes('private-library-key'),false);
  });
});
