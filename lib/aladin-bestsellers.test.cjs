const test=require('node:test');
const assert=require('node:assert/strict');
const {parseBestsellers,bestsellerUrl,parseProductDescription}=require('./aladin-bestsellers.cjs');

test('weekly bestseller page yields ranked Korean books with publication dates',()=>{
  const html=`<div class="ss_book_box" itemId="123"><img src="https://image.aladin.co.kr/product/1/cover200/a.jpg" class="front_cover i_cover"><li><a href="https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=123" class="bo3">새로운 &amp; 이야기</a></li><li><a href="/Search/wSearchResult.aspx?AuthorSearch=Writer@1">김작가</a> (지은이) | 출판사 | 2026년 10월</li></div><div class="ss_book_box" itemId="456"><img src="https://image.aladin.co.kr/product/2/cover200/b.jpg" class="front_cover"><li><a href="https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=456" class="bo3">두 번째 책</a></li><li><a href="/Search/wSearchResult.aspx?AuthorSearch=Writer@2">박작가</a> (지은이) | 출판사 | 2025년 2월</li></div>`;
  const books=parseBestsellers(html);
  assert.equal(books.length,2);
  assert.deepEqual(books.map((book)=>book.bestsellerRank),[1,2]);
  assert.equal(books[0].title,'새로운 & 이야기');
  assert.equal(books[0].publishedDate,'2026-10');
  assert.equal(books[0].source,'aladin');
  assert.match(bestsellerUrl('mystery'),/CID=50926$/);
  assert.equal(bestsellerUrl('unknown'),null);
});

test('public product introduction is decoded without treating page content as instructions',()=>{
  assert.equal(parseProductDescription('<meta name="description" content="소설의 인물이 낯선 세계에서 돌아오는 이야기를 다룹니다. &amp; 가족과의 관계도 소개합니다." />'),'소설의 인물이 낯선 세계에서 돌아오는 이야기를 다룹니다. & 가족과의 관계도 소개합니다.');
  assert.equal(parseProductDescription('<meta name="description" content="short" />'),'');
});
