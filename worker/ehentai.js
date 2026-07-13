export async function searchEhentai(q) {
  const searchUrl = `https://e-hentai.org/?f_search=${encodeURIComponent(q)}`;
  const resp = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    signal: AbortSignal.timeout(15000),
  });

  const html = await resp.text();
  const results = [];

  // Match each table row in the search results
  const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = html.match(rowRegex) || [];

  for (const row of rows) {
    if (results.length >= 10) break;

    // Extract gallery URL (gid and token)
    const urlMatch = row.match(/\/g\/(\d+)\/([a-f0-9]+)\//);
    if (!urlMatch) continue;

    const gid = urlMatch[1];
    const token = urlMatch[2];
    const galleryUrl = `https://e-hentai.org/g/${gid}/${token}/`;

    // Extract title
    const titleMatch = row.match(/<div class="glink">([^<]+)<\/div>/);
    const title = titleMatch ? titleMatch[1].trim() : '';
    if (!title) continue;

    // Extract thumbnail
    const thumbMatch = row.match(/<img[^>]*(?:data-src|src)="(https?:\/\/[^"]+)"/);
    const thumbnail = thumbMatch ? thumbMatch[1] : '';

    results.push({ title, url: galleryUrl, thumbnail, gid, token });
  }

  return results;
}

export async function fetchEhentaiGallery(gid, token) {
  const payload = {
    method: "gdata",
    gidlist: [[gid, token]],
    namespace: 1
  };

  const resp = await fetch('https://api.e-hentai.org/api.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)
  });

  const data = await resp.json();
  if (data.gmetadata && data.gmetadata.length > 0) {
    return data.gmetadata[0];
  } else {
    throw new Error('Gallery not found in API response');
  }
}
