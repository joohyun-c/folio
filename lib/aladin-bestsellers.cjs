const CATEGORIES = Object.freeze({
  fiction:'50917', korean:'50917', japanese:'50918', english:'50919',
  mystery:'50926', fantasy:'50928', scifi:'50930', romance:'50935',
  career:'336', economy:'170', science:'987', humanities:'656', travel:'1196'
});

function decode(text) {
  return String(text || '').replace(/<[^>]*>/g, ' ').replace(/&(?:amp|quot|apos|lt|gt|nbsp|#\d+|#x[\da-f]+);/gi, (entity) => {
    const named = {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '};
    const value = entity.slice(1,-1).toLowerCase();
    if (named[value]) return named[value];
    if (value.startsWith('#')) {
      const point = value[1] === 'x' ? parseInt(value.slice(2),16) : parseInt(value.slice(1),10);
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
    }
    return entity;
  }).replace(/\s+/g,' ').trim();
}

function parseBestsellers(html, category='fiction') {
  if (!CATEGORIES[category]) return [];
  const blocks = String(html).split(/<div\s+class="ss_book_box"\s+itemId="(\d+)"\s*>/i);
  const books = [];
  for (let index=1; index<blocks.length-1 && books.length<30; index+=2) {
    const id=blocks[index], body=blocks[index+1];
    const titleMatch=body.match(/<a\s+href="(https:\/\/www\.aladin\.co\.kr\/shop\/wproduct\.aspx\?ItemId=\d+)"\s+class="bo3"[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleMatch) continue;
    const title=decode(titleMatch[2]);
    const author=decode(body.match(/<a\s+href="[^"<>]*AuthorSearch=[^"<>]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1]);
    const cover=body.match(/<img\s+src="(https:\/\/image\.aladin\.co\.kr\/product\/[^"<>]+)"[^>]*class="front_cover/i)?.[1] || '';
    const date=body.match(/\|\s*(20\d{2})년\s*(\d{1,2})월/);
    if (!title || !author) continue;
    const topic={career:'일과 커리어',economy:'경제',science:'과학',humanities:'인문·사회',travel:'여행'}[category] || '소설';
    books.push({id:'aladin:'+id,title,author,description:'',tags:[topic],goals:[],pages:null,image:cover,url:titleMatch[1],source:'aladin',bestsellerRank:books.length+1,publishedDate:date?date[1]+'-'+date[2].padStart(2,'0'):''});
  }
  return books;
}

function bestsellerUrl(category) {
  if (!CATEGORIES[category]) return null;
  return `https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=Bestseller&BranchType=1&CID=${CATEGORIES[category]}`;
}

function parseProductDescription(html) {
  const raw=String(html).match(/<meta\s+name="description"\s+content="([^"]{50,3000})"\s*\/?\s*>/i)?.[1] || '';
  return decode(raw).slice(0,700);
}

module.exports={CATEGORIES,parseBestsellers,bestsellerUrl,parseProductDescription};
