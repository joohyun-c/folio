const test = require('node:test');
const assert = require('node:assert/strict');
const {createData4LibraryClient, normalizeBook, Data4LibraryError} = require('./data4library.cjs');

test('normalizes Korean book fields without unsafe URLs', () => {
  const book = normalizeBook({bookname: '  채식주의자  ', authors: '한강', isbn13: '9788936433598', bookImageURL: 'http://images.example.test/cover.jpg', bookDtUrl: 'javascript:alert(1)', description: '<b>책 소개</b>'});
  assert.equal(book.id, 'data4library:9788936433598');
  assert.equal(book.title, '채식주의자');
  assert.equal(book.description, '책 소개');
  assert.equal(book.image, 'https://images.example.test/cover.jpg');
  assert.equal(book.url, 'https://www.data4library.kr/');
});

test('search and detail use documented JSON endpoints, cache, and hide the key from results', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const detail = url.pathname.endsWith('srchDtlList');
    return {ok: true, status: 200, json: async () => ({response: detail
      ? {detail: [{book: {bookname: '채식주의자', authors: '한강', isbn13: '9788936433598', description: '소설'}}]}
      : {numFound: 1, docs: [{doc: {bookname: '채식주의자', authors: '한강', isbn13: '9788936433598'}}]}})};
  };
  const client = createData4LibraryClient({key: 'secret-key', fetchImpl});
  const result = await client.searchBooks('채식주의자');
  await client.searchBooks('채식주의자');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].pathname, '/api/srchBooks');
  assert.equal(calls[0].searchParams.get('keyword'), '채식주의자');
  assert.equal(calls[0].searchParams.get('format'), 'json');
  assert.equal(calls[0].searchParams.get('authKey'), 'secret-key');
  assert.equal(result.books[0].title, '채식주의자');
  assert.equal(result.isEnd, true);
  assert.equal(JSON.stringify(result).includes('secret-key'), false);
  const detail = await client.getBookDetail('9788936433598');
  assert.equal(calls[1].pathname, '/api/srchDtlList');
  assert.equal(calls[1].searchParams.get('loaninfoYN'), 'N');
  assert.equal(detail.book.description, '소설');
});

test('missing key skips fetch and upstream errors never expose credentials', async () => {
  const missing = createData4LibraryClient({key: '', fetchImpl: () => { throw Error('unexpected fetch'); }});
  assert.equal((await missing.searchBooks('역사')).configured, false);
  const client = createData4LibraryClient({key: 'private-key', fetchImpl: async () => ({ok: false, status: 403})});
  await assert.rejects(client.searchBooks('역사'), (error) => error instanceof Data4LibraryError && error.status === 502 && !error.message.includes('private-key'));
});

test('request times out', async () => {
  const client = createData4LibraryClient({key: 'test-key', timeoutMs: 10, fetchImpl: (_, {signal}) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Error('aborted'))))});
  await assert.rejects(client.searchBooks('역사'), (error) => error.code === 'TIMEOUT');
});
