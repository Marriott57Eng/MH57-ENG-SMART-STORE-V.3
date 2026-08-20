const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(data); } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// Just fetch a few known open URLs or use DuckDuckGo HTML search to extract image URLs
async function searchImage(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + ' filetype:jpg')}`;
  const html = await fetchJson(url);
  // DuckDuckGo image results usually have src="//external-content.duckduckgo.com/iu/?u=..."
  const match = html.match(/u=([^&"']+)/);
  if (match) {
    return decodeURIComponent(match[1]);
  }
  return null;
}

async function run() {
  const queries = [
    'ทินเนอร์ 3A แกลลอน',
    'ท่อ PPR สีเขียว',
    'สายไฟ THW Yazaki',
    'หลอดไฟ LED T8 Philips',
    'สายฉีดชำระ สแตนเลส',
    'ยาแนวจระเข้',
    'Smoke Detector Siga',
    'มือจับประตู สแตนเลส',
    'สายแลน Link CAT6'
  ];
  for (const q of queries) {
    const img = await searchImage(q);
    console.log(`${q}: ${img}`);
  }
}
run();
