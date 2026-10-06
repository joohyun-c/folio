const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {recommendWithGemini} = require('./lib/gemini-recommend.cjs');
const {createData4LibraryClient, Data4LibraryError} = require('./lib/data4library.cjs');

const DIST = path.resolve(__dirname, 'dist');
const TYPES = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};

function sendJson(response, status, value) {
  response.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  response.end(JSON.stringify(value));
}

function normalizeKakao(document) {
  const isbn = String(document.isbn || '').split(/\s+/).find((part) => /^97[89]\d{10}$/.test(part)) || String(document.isbn || '').trim().split(/\s+/)[0];
  const fallback = crypto.createHash('sha256').update(String(document.url || document.title || '')).digest('hex').slice(0, 16);
  return {
    id: 'kakao:' + (isbn || fallback),
    title: String(document.title || '').replace(/<[^>]*>/g, '').trim(),
    author: Array.isArray(document.authors) && document.authors.length ? document.authors.join(', ') : '저자 정보 없음',
    description: String(document.contents || '').replace(/<[^>]*>/g, '').trim(),
    tags: [], goals: [], pages: null,
    image: /^https:\/\//.test(document.thumbnail || '') ? document.thumbnail : null,
    url: /^https:\/\//.test(document.url || '') ? document.url : 'https://search.daum.net/',
    source: 'kakao'
  };
}

function createAppServer({key = process.env.FOLIO_KAKAO_REST_KEY || '', libraryKey = process.env.FOLIO_DATA4LIBRARY_AUTH_KEY || '', geminiKey = process.env.GEMINI_API_KEY || '', fetchImpl = fetch, distDir = DIST} = {}) {
  const cache = new Map();
  const library = createData4LibraryClient({key:libraryKey,fetchImpl});
  return http.createServer(async (request, response) => {
    let url;
    try { url = new URL(request.url, 'http://localhost'); }
    catch { return sendJson(response, 400, {error:'Invalid URL'}); }

    if (url.pathname.startsWith('/api/')) {
      const origin = request.headers.origin || '';
      if (/^http:\/\/(?:localhost|127\.0\.0\.\d+):8765$/.test(origin)) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Vary', 'Origin');
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      }
      if (request.method === 'OPTIONS') {response.writeHead(204);return response.end()}
      if (url.pathname === '/api/capabilities') {
        if (request.method !== 'GET') return sendJson(response, 405, {error:'Method not allowed'});
        return sendJson(response, 200, {gemini:!!geminiKey,library:!!libraryKey});
      }
      if (url.pathname === '/api/library-books' || url.pathname === '/api/library-detail') {
        if (request.method !== 'GET') return sendJson(response, 405, {error:'Method not allowed'});
        if (origin && !response.getHeader('Access-Control-Allow-Origin')) return sendJson(response, 403, {error:'Origin not allowed'});
        try {
          if (url.pathname === '/api/library-books') {
            const result = await library.searchBooks(url.searchParams.get('query'), Number(url.searchParams.get('page') || '1'));
            return sendJson(response, 200, result);
          }
          const result = await library.getBookDetail(url.searchParams.get('isbn'));
          return sendJson(response, 200, result);
        } catch (error) {
          const status = error instanceof Data4LibraryError ? error.status : 502;
          return sendJson(response, status, {error:error instanceof Data4LibraryError ? error.message : '국내 책 검색에 연결하지 못했습니다.'});
        }
      }
      if (url.pathname === '/api/recommendations') {
        if (request.method !== 'POST') return sendJson(response, 405, {error:'Method not allowed'});
        if (origin && !response.getHeader('Access-Control-Allow-Origin')) return sendJson(response, 403, {error:'Origin not allowed'});
        if (!geminiKey) return sendJson(response, 200, {configured:false,recommendations:[]});
        let body = '';
        try {for await (const part of request) {body += part.toString('utf8');if (body.length > 50000) return sendJson(response, 413, {error:'Request too large'})}}
        catch {return sendJson(response, 400, {error:'Invalid request'})}
        let payload;
        try {payload = JSON.parse(body)} catch {return sendJson(response, 400, {error:'Invalid JSON'})}
        const result = await recommendWithGemini({key:geminiKey,profile:payload.profile,books:payload.books,fetchImpl});
        return sendJson(response, 200, result);
      }
    }
    if (!['GET','HEAD'].includes(request.method)) return sendJson(response, 405, {error:'Method not allowed'});

    if (url.pathname === '/api/books') {
      const query = (url.searchParams.get('query') || '').trim();
      const page = Number(url.searchParams.get('page') || '1');
      if (!query || query.length > 80 || !Number.isInteger(page) || page < 1 || page > 50) return sendJson(response, 400, {error:'검색어 또는 페이지가 올바르지 않습니다.'});
      if (!key) return sendJson(response, 200, {configured:false, books:[], source:'kakao'});
      const cacheKey = query + '\n' + page;
      const cached = cache.get(cacheKey);
      if (cached && cached.expires > Date.now()) return sendJson(response, 200, cached.value);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const target = new URL('https://dapi.kakao.com/v3/search/book');
        target.searchParams.set('query', query);
        target.searchParams.set('page', String(page));
        target.searchParams.set('size', '30');
        const upstream = await fetchImpl(target, {headers:{Authorization:'KakaoAK ' + key},signal:controller.signal});
        if (upstream.status === 429) return sendJson(response, 429, {configured:true, error:'국내 책 검색 요청 한도에 도달했습니다.', source:'kakao'});
        if (!upstream.ok) return sendJson(response, 502, {error:'국내 책 검색 응답 오류', status:upstream.status});
        const data = await upstream.json();
        const value = {configured:true, books:(Array.isArray(data.documents) ? data.documents : []).map(normalizeKakao).filter((book) => book.title), source:'kakao', isEnd:!!data.meta?.is_end};
        cache.set(cacheKey, {value, expires:Date.now() + 10 * 60 * 1000});
        if (cache.size > 200) cache.delete(cache.keys().next().value);
        return sendJson(response, 200, value);
      } catch {
        return sendJson(response, 502, {error:'국내 책 검색에 연결하지 못했습니다.'});
      } finally { clearTimeout(timer); }
    }

    let pathname;
    try { pathname = decodeURIComponent(url.pathname); }
    catch { return sendJson(response, 400, {error:'Invalid path'}); }
    const file = path.resolve(distDir, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (file !== distDir && !file.startsWith(distDir + path.sep)) return sendJson(response, 403, {error:'Forbidden'});
    try {
      const stat = await fs.stat(file);
      if (!stat.isFile()) return sendJson(response, 404, {error:'Not found'});
      response.writeHead(200, {'Content-Type':TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream','Content-Length':stat.size});
      if (request.method === 'HEAD') return response.end();
      response.end(await fs.readFile(file));
    } catch { sendJson(response, 404, {error:'Not found'}); }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8765);
  createAppServer().listen(port, process.env.HOST || 'localhost', () => console.log('folio: http://localhost:' + port));
}

module.exports = {createAppServer, normalizeKakao};
