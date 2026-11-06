const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

// Hàm tải 1 file
async function downloadFile(url, folder, baseDomain) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== baseDomain) return null; // Chỉ tải cùng domain

    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    let filePath = parsed.pathname;
    if (filePath.endsWith('/') || filePath === '') filePath = '/index.html';

    const fullPath = path.join(folder, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(fullPath, res.data);
    console.log(`✅ Tải: ${filePath}`);
    return { path: fullPath, contentType: res.headers['content-type'] || '' };
  } catch (err) {
    console.log(`❌ Lỗi: ${url} - ${err.message}`);
    return null;
  }
}

// Hàm crawl BFS
async function crawl(baseUrl, folder) {
  const baseDomain = new URL(baseUrl).hostname;
  const visited = new Set();
  const downloaded = new Set();
  const queue = [baseUrl];

  while (queue.length > 0) {
    const currentUrl = queue.shift();
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    const result = await downloadFile(currentUrl, folder, baseDomain);
    if (!result) continue;

    // Nếu là HTML, tìm link con
    if (result.contentType.includes('text/html')) {
      const content = fs.readFileSync(result.path, 'utf-8');
      const $ = cheerio.load(content);
      const tags = { a: 'href', link: 'href', script: 'src', img: 'src' };

      for (const [tag, attr] of Object.entries(tags)) {
        $(tag).each((_, el) => {
          const src = $(el).attr(attr);
          if (src) {
            try {
              const fullUrl = new URL(src, currentUrl).href;
              if (!visited.has(fullUrl) && !queue.includes(fullUrl)) {
                queue.push(fullUrl);
              }
            } catch (e) {}
          }
        });
      }
    }
  }
  return folder;
}

// Hàm nén thư mục thành ZIP
function zipFolder(folder, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve(zipPath));
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(folder, false);
    archive.finalize();
  });
}

// Endpoint API
app.post('/api/crawl', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Thiếu URL' });

  let targetUrl = url;
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) targetUrl = 'https://' + targetUrl;

  try {
    const domain = new URL(targetUrl).hostname.replace('www.', '');
    const folderName = `src_${domain}_${Date.now()}`;
    const folderPath = path.join(DOWNLOAD_DIR, folderName);
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);

    await crawl(targetUrl, folderPath);

    const zipName = `fullsrc_${domain}.zip`;
    const zipPath = path.join(DOWNLOAD_DIR, zipName);
    await zipFolder(folderPath, zipPath);

    // Xoá thư mục tạm sau khi nén
    fs.rmSync(folderPath, { recursive: true, force: true });

    res.json({ download: `/downloads/${zipName}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Phục vụ file ZIP
app.use('/downloads', express.static(DOWNLOAD_DIR));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Web Crawler running on port ${PORT}`);
});
