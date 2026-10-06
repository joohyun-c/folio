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
