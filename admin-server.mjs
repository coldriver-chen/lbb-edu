import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(rootDir, 'public');
const host = process.env.ADMIN_HOST || '127.0.0.1';
const port = Number(process.env.ADMIN_PORT || 4322);
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
const sessions = new Set();

const targets = [
  {
    id: 'literature-bionic',
    label: '文献阅读 / 光纤仿生传感',
    dir: path.join(publicDir, 'literatures', '光纤仿生传感'),
  },
  {
    id: 'literature-biomedical',
    label: '文献阅读 / 光纤生物医学传感',
    dir: path.join(publicDir, 'literatures', '光纤生物医学传感'),
  },
  {
    id: 'literature-cross',
    label: '文献阅读 / 其他交叉领域',
    dir: path.join(publicDir, 'literatures', '其他交叉领域'),
  },
  {
    id: 'meeting-formal',
    label: '组会记录 / 正式组会',
    dir: path.join(publicDir, 'group-meetings', '正式组会'),
  },
  {
    id: 'meeting-autonomous-bionic',
    label: '组会记录 / 自主组会 / 光纤仿生传感',
    dir: path.join(publicDir, 'group-meetings', '自主组会', '光纤仿生传感'),
  },
  {
    id: 'meeting-autonomous-cross',
    label: '组会记录 / 自主组会 / 其他交叉领域',
    dir: path.join(publicDir, 'group-meetings', '自主组会', '其他交叉领域'),
  },
];

const targetMap = new Map(targets.map((target) => [target.id, target]));

for (const target of targets) {
  fs.mkdirSync(target.dir, { recursive: true });
}

const send = (res, status, body, headers = {}) => {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
};

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

const getCookies = (req) => {
  const cookieHeader = req.headers.cookie || '';
  return Object.fromEntries(cookieHeader.split(';').map((item) => {
    const [key, ...value] = item.trim().split('=');
    return [key, decodeURIComponent(value.join('='))];
  }).filter(([key]) => key));
};

const isAuthed = (req) => {
  const token = getCookies(req).admin_session;
  return Boolean(token && sessions.has(token));
};

const requireAuth = (req, res) => {
  if (isAuthed(req)) return true;
  send(res, 401, { ok: false, message: '请先登录' });
  return false;
};

const safeFileName = (fileName) => {
  const baseName = path.basename(fileName || 'upload');
  return baseName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/^\.+$/, 'upload');
};

const parseContentDisposition = (header) => {
  const result = {};
  const parts = header.split(';').map((part) => part.trim());
  for (const part of parts.slice(1)) {
    const match = part.match(/^([^=]+)="?([^"]*)"?$/);
    if (match) result[match[1].toLowerCase()] = match[2];
  }
  return result;
};

const splitBuffer = (buffer, separator) => {
  const parts = [];
  let start = 0;
  let index = buffer.indexOf(separator, start);

  while (index !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + separator.length;
    index = buffer.indexOf(separator, start);
  }

  parts.push(buffer.subarray(start));
  return parts;
};

const parseMultipart = (body, contentType) => {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error('缺少上传边界');

  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const parts = splitBuffer(body, boundary);
  const fields = {};
  const files = {};

  for (let part of parts) {
    if (part.length === 0) continue;
    if (part.subarray(0, 2).toString() === '\r\n') part = part.subarray(2);
    if (part.subarray(0, 2).toString() === '--') continue;
    if (part.subarray(part.length - 2).toString() === '\r\n') part = part.subarray(0, part.length - 2);

    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) continue;

    const rawHeaders = part.subarray(0, headerEnd).toString('utf8');
    const content = part.subarray(headerEnd + 4);
    const dispositionLine = rawHeaders.split('\r\n').find((line) => line.toLowerCase().startsWith('content-disposition:'));
    if (!dispositionLine) continue;

    const disposition = parseContentDisposition(dispositionLine.slice(dispositionLine.indexOf(':') + 1).trim());
    if (!disposition.name) continue;

    if (disposition.filename !== undefined) {
      files[disposition.name] = {
        filename: disposition.filename,
        content,
      };
    } else {
      fields[disposition.name] = content.toString('utf8');
    }
  }

  return { fields, files };
};

const adminHtml = () => `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>文档上传后台</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f5f5f5; color: #333; font-family: "Microsoft YaHei", sans-serif; }
    main { width: min(760px, calc(100% - 32px)); margin: 48px auto; background: #fff; border: 1px solid #e0e0e0; padding: 28px; }
    h1 { margin: 0 0 22px; color: #003b82; font-size: 22px; border-bottom: 2px solid #003b82; padding-bottom: 12px; }
    label { display: block; margin-bottom: 16px; font-size: 14px; color: #333; }
    input, select, button { width: 100%; height: 38px; margin-top: 7px; border: 1px solid #cdd7e3; font: inherit; }
    input, select { padding: 0 10px; background: #fff; }
    input[type="file"] { padding: 7px 10px; height: auto; }
    button { background: #003b82; color: #fff; border: 0; cursor: pointer; }
    button.secondary { background: #666; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .panel[hidden] { display: none; }
    .message { min-height: 22px; margin-top: 14px; font-size: 13px; color: #003b82; }
    .hint { color: #777; font-size: 13px; line-height: 1.7; margin-top: 18px; }
    @media (max-width: 640px) { .row { grid-template-columns: 1fr; } main { margin-top: 20px; padding: 20px; } }
  </style>
</head>
<body>
  <main>
    <h1>文档上传后台</h1>

    <section id="loginPanel" class="panel">
      <form id="loginForm">
        <div class="row">
          <label>账号<input name="username" autocomplete="username" required /></label>
          <label>密码<input name="password" type="password" autocomplete="current-password" required /></label>
        </div>
        <button type="submit">登录</button>
      </form>
    </section>

    <section id="uploadPanel" class="panel" hidden>
      <form id="uploadForm">
        <label>上传到
          <select name="target" id="targetSelect" required></select>
        </label>
        <label>选择文档
          <input name="file" type="file" required />
        </label>
        <button type="submit">上传</button>
      </form>
      <button id="logoutButton" class="secondary" type="button">退出登录</button>
      <p class="hint">文件会保存到项目的 public 目录。上传后如果线上页面没有立即变化，需要重新构建并发布网站。</p>
    </section>

    <p id="message" class="message"></p>
  </main>

  <script>
    const loginPanel = document.getElementById('loginPanel');
    const uploadPanel = document.getElementById('uploadPanel');
    const loginForm = document.getElementById('loginForm');
    const uploadForm = document.getElementById('uploadForm');
    const logoutButton = document.getElementById('logoutButton');
    const targetSelect = document.getElementById('targetSelect');
    const message = document.getElementById('message');

    const setMessage = (text) => { message.textContent = text; };
    const showUpload = async () => {
      loginPanel.hidden = true;
      uploadPanel.hidden = false;
      const res = await fetch('/api/targets');
      const data = await res.json();
      targetSelect.innerHTML = data.targets.map((target) => '<option value="' + target.id + '">' + target.label + '</option>').join('');
    };

    const checkSession = async () => {
      const res = await fetch('/api/me');
      if (res.ok) showUpload();
    };

    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setMessage('');
      const form = new FormData(loginForm);
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.get('username'),
          password: form.get('password'),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message || '登录失败');
        return;
      }
      setMessage('登录成功');
      showUpload();
    });

    uploadForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setMessage('上传中...');
      const res = await fetch('/api/upload', { method: 'POST', body: new FormData(uploadForm) });
      const data = await res.json();
      setMessage(data.message || (res.ok ? '上传成功' : '上传失败'));
      if (res.ok) uploadForm.reset();
    });

    logoutButton.addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      uploadPanel.hidden = true;
      loginPanel.hidden = false;
      setMessage('已退出登录');
    });

    checkSession();
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    if (req.method === 'GET' && (url.pathname === '/admin' || url.pathname === '/admin/')) {
      send(res, 200, adminHtml());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/me') {
      if (!isAuthed(req)) {
        send(res, 401, { ok: false });
        return;
      }
      send(res, 200, { ok: true, username: adminUser });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/targets') {
      if (!requireAuth(req, res)) return;
      send(res, 200, { ok: true, targets: targets.map(({ id, label }) => ({ id, label })) });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/login') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      if (body.username !== adminUser || body.password !== adminPassword) {
        send(res, 401, { ok: false, message: '账号或密码错误' });
        return;
      }

      const token = crypto.randomBytes(32).toString('hex');
      sessions.add(token);
      send(res, 200, { ok: true, message: '登录成功' }, {
        'Set-Cookie': `admin_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/`,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/logout') {
      const token = getCookies(req).admin_session;
      if (token) sessions.delete(token);
      send(res, 200, { ok: true, message: '已退出登录' }, {
        'Set-Cookie': 'admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/upload') {
      if (!requireAuth(req, res)) return;
      const contentType = req.headers['content-type'] || '';
      if (!contentType.includes('multipart/form-data')) {
        send(res, 400, { ok: false, message: '上传格式不正确' });
        return;
      }

      const { fields, files } = parseMultipart(await readBody(req), contentType);
      const target = targetMap.get(fields.target);
      const file = files.file;

      if (!target) {
        send(res, 400, { ok: false, message: '请选择正确的目录' });
        return;
      }

      if (!file || file.content.length === 0) {
        send(res, 400, { ok: false, message: '请选择要上传的文件' });
        return;
      }

      const fileName = safeFileName(file.filename);
      const outputPath = path.join(target.dir, fileName);
      fs.mkdirSync(target.dir, { recursive: true });
      fs.writeFileSync(outputPath, file.content);
      send(res, 200, { ok: true, message: `上传成功：${target.label} / ${fileName}` });
      return;
    }

    send(res, 404, { ok: false, message: 'Not found' });
  } catch (error) {
    send(res, 500, { ok: false, message: error instanceof Error ? error.message : '服务器错误' });
  }
});

server.listen(port, host, () => {
  console.log(`Admin upload server: http://${host}:${port}/admin`);
  console.log(`Default account: ${adminUser} / ${adminPassword}`);
});
