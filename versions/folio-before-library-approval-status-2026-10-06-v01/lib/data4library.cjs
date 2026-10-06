const crypto = require('node:crypto');

const BASE_URL = 'https://data4library.kr/api/';
const SOURCE = 'data4library';

class Data4LibraryError extends Error {
  constructor(code, status = 502) {
    super(code === 'RATE_LIMIT' ? '도서 검색 요청 한도에 도달했습니다.' : code === 'TIMEOUT' ? '도서 검색 응답 시간이 초과됐습니다.' : code === 'INVALID_INPUT' ? '검색어 또는 ISBN이 올바르지 않습니다.' : '도서관 정보나루에 연결하지 못했습니다.');
    this.name = 'Data4LibraryError';
    this.code = code;
    this.status = status;
  }
}

function clean(value) {
  return String(value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.protocol = 'https:';
    return url.href;
  } catch { return null; }
}

function normalizeBook(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = clean(raw.bookname);
  if (!title) return null;
  const isbn = clean(raw.isbn13 || raw.isbn).replace(/[^0-9X]/gi, '');
  const fallback = crypto.createHash('sha256').update([title, clean(raw.authors), clean(raw.publisher)].join('\n')).digest('hex').slice(0, 16);
  return {
    id: 'data4library:' + (isbn || fallback),
    title,
    author: clean(raw.authors) || '저자 정보 없음',
    description: clean(raw.description),
    tags: [], goals: [], pages: null,
    image: safeUrl(raw.bookImageURL),
    url: safeUrl(raw.bookDtUrl) || 'https://www.data4library.kr/',
    source: SOURCE,
    isbn: isbn || null,
    publisher: clean(raw.publisher),
    publicationYear: clean(raw.publication_year)
  };
}

function createData4LibraryClient({key = process.env.FOLIO_DATA4LIBRARY_AUTH_KEY || '', fetchImpl = globalThis.fetch, timeoutMs = 8000, ttlMs = 10 * 60 * 1000} = {}) {
  const authKey = String(key).trim();
  const cache = new Map();
  const pending = new Map();

  async function request(endpoint, params) {
    const cacheKey = endpoint + ':' + JSON.stringify(params);
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.value;
    if (pending.has(cacheKey)) return pending.get(cacheKey);
    const task = (async () => {
      const url = new URL(endpoint, BASE_URL);
      for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));
      url.searchParams.set('authKey', authKey);
      url.searchParams.set('format', 'json');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, {signal: controller.signal, headers: {Accept: 'application/json'}});
        if (response.status === 429) throw new Data4LibraryError('RATE_LIMIT', 429);
        if (!response.ok) throw new Data4LibraryError('UPSTREAM_ERROR');
        const body = await response.json();
        if (!body || typeof body.response !== 'object' || body.response === null) throw new Data4LibraryError('UPSTREAM_ERROR');
        const value = body.response;
        cache.set(cacheKey, {value, expires: Date.now() + ttlMs});
        if (cache.size > 200) cache.delete(cache.keys().next().value);
        return value;
      } catch (error) {
        if (error instanceof Data4LibraryError) throw error;
        throw new Data4LibraryError(controller.signal.aborted ? 'TIMEOUT' : 'UPSTREAM_ERROR');
      } finally { clearTimeout(timer); }
    })();
    pending.set(cacheKey, task);
    try { return await task; }
    finally { pending.delete(cacheKey); }
  }

  async function searchBooks(query, page = 1, pageSize = 30) {
    const keyword = String(query ?? '').trim();
    if (!keyword || keyword.length > 80 || !Number.isInteger(page) || page < 1 || page > 50 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Data4LibraryError('INVALID_INPUT', 400);
    if (!authKey) return {configured: false, books: [], source: SOURCE, isEnd: true, total: 0};
    const response = await request('srchBooks', {keyword, pageNo: page, pageSize});
    const docs = Array.isArray(response.docs) ? response.docs : [];
    const books = docs.map((entry) => normalizeBook(entry?.doc || entry)).filter(Boolean);
    const total = Number(response.numFound);
    const count = Number.isFinite(total) && total >= 0 ? total : null;
    return {configured: true, books, source: SOURCE, isEnd: count === null ? docs.length < pageSize : page * pageSize >= count, total: count};
  }

  async function getBookDetail(isbn13) {
    const isbn = String(isbn13 ?? '').replace(/[\s-]/g, '');
    if (!/^97[89]\d{10}$/.test(isbn)) throw new Data4LibraryError('INVALID_INPUT', 400);
    if (!authKey) return {configured: false, book: null, source: SOURCE};
    const response = await request('srchDtlList', {isbn13: isbn, loaninfoYN: 'N'});
    const first = Array.isArray(response.detail) ? response.detail[0] : response.detail;
    return {configured: true, book: normalizeBook(first?.book || first), source: SOURCE};
  }

  return {searchBooks, getBookDetail};
}

module.exports = {createData4LibraryClient, normalizeBook, Data4LibraryError};
