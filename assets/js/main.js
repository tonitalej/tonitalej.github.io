const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------- Theme ---------- */

function setupTheme() {
  const btn = $('[data-theme-toggle]');
  if (!btn) return;
  const label = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    btn.setAttribute('aria-label', `Switch to ${next} theme`);
  };
  label();
  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* not persisted */
    }
    label();
    window.dispatchEvent(new Event('themechange'));
  });
}

/* ---------- Header: scrolled state, progress bar, mobile menu, active section ---------- */

function setupHeader() {
  const header = $('[data-header]');
  const progress = $('[data-progress]');
  const nav = $('[data-nav]');
  const menuBtn = $('[data-menu-toggle]');
  if (!header) return;

  const onScroll = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 10);
    if (progress) {
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    }
  };
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });

  const closeMenu = () => {
    nav?.classList.remove('is-open');
    menuBtn?.setAttribute('aria-expanded', 'false');
    menuBtn?.setAttribute('aria-label', 'Open menu');
  };
  menuBtn?.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  nav?.addEventListener('click', (e) => {
    if (e.target.closest('a')) closeMenu();
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav?.classList.contains('is-open')) {
      closeMenu();
      menuBtn?.focus();
    }
  });

  // Highlight the nav link of the section in view (home page only).
  const links = $$('.nav-link[data-section]');
  const sections = links.map((l) => document.getElementById(l.dataset.section)).filter(Boolean);
  if (sections.length === 0) return;
  const hero = $('.hero');
  if (hero) sections.push(hero);
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const l of links) {
          const on = l.dataset.section === entry.target.id;
          l.classList.toggle('is-active', on);
          if (on) l.setAttribute('aria-current', 'location');
          else l.removeAttribute('aria-current');
        }
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  sections.forEach((s) => io.observe(s));
}

/* ---------- Reveal on scroll ---------- */

function setupReveal() {
  const items = $$('.reveal, .osi');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  items.forEach((el) => io.observe(el));
}

/* ---------- Typed roles ---------- */

function setupTyped() {
  const el = $('[data-typed]');
  if (!el) return;
  let words;
  try {
    words = JSON.parse(el.dataset.typed);
  } catch {
    return;
  }
  if (reducedMotion || words.length < 2) return;
  let w = 0;
  let shown = words[0].length;
  let deleting = true;
  const tick = () => {
    if (deleting) {
      shown--;
      if (shown === 0) {
        deleting = false;
        w = (w + 1) % words.length;
      }
    } else {
      shown++;
    }
    el.textContent = words[w].slice(0, shown);
    const full = !deleting && shown === words[w].length;
    if (full) deleting = true;
    setTimeout(tick, full ? 1900 : deleting ? 38 : 75);
  };
  setTimeout(tick, 2200);
}

/* ---------- Network topology animation ---------- */

function setupNetwork() {
  const canvas = $('[data-network]');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let w = 0;
  let h = 0;
  let dpr = 1;
  let nodes = [];
  let packets = [];
  let running = false;
  let visible = true;
  let raf = 0;
  let colors = readColors();
  const pointer = { x: -9999, y: -9999 };
  const LINK = 150;

  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    return { node: cs.getPropertyValue('--net-node').trim(), link: cs.getPropertyValue('--net-link').trim() };
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(24, Math.min(90, Math.round((w * h) / 15000)));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() < 0.12 ? 3.2 : 1.6 + Math.random() * 1.2,
    }));
    packets = [];
    if (!running) draw();
  }

  function spawnPacket() {
    const a = nodes[Math.floor(Math.random() * nodes.length)];
    let best = null;
    let bestD = LINK;
    for (const b of nodes) {
      if (b === a) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < bestD && Math.random() < 0.6) {
        best = b;
        bestD = d;
      }
    }
    if (best) packets.push({ a, b: best, t: 0, speed: 0.008 + Math.random() * 0.012 });
  }

  function step() {
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;
      const dx = n.x - pointer.x;
      const dy = n.y - pointer.y;
      const d = Math.hypot(dx, dy);
      if (d < 120 && d > 0) {
        n.x += (dx / d) * 0.6;
        n.y += (dy / d) * 0.6;
      }
    }
    if (packets.length < 14 && Math.random() < 0.08) spawnPacket();
    packets = packets.filter((p) => (p.t += p.speed) < 1);
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < LINK) {
          ctx.strokeStyle = `rgba(${colors.link}, ${0.22 * (1 - d / LINK)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
    for (const n of nodes) {
      const near = Math.hypot(n.x - pointer.x, n.y - pointer.y) < 160;
      ctx.fillStyle = `rgba(${colors.node}, ${near ? 0.95 : 0.55})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of packets) {
      const x = p.a.x + (p.b.x - p.a.x) * p.t;
      const y = p.a.y + (p.b.y - p.a.y) * p.t;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 8);
      g.addColorStop(0, `rgba(${colors.node}, 0.95)`);
      g.addColorStop(1, `rgba(${colors.node}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function loop() {
    step();
    draw();
    raf = requestAnimationFrame(loop);
  }

  function update() {
    const shouldRun = !reducedMotion && visible && document.visibilityState === 'visible';
    if (shouldRun && !running) {
      running = true;
      raf = requestAnimationFrame(loop);
    } else if (!shouldRun && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  }

  const hero = canvas.parentElement;
  hero.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
  });
  hero.addEventListener('pointerleave', () => {
    pointer.x = pointer.y = -9999;
  });
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    update();
  }).observe(canvas);
  document.addEventListener('visibilitychange', update);
  addEventListener('themechange', () => {
    colors = readColors();
    if (!running) draw();
  });
  resize();
  update();
}

/* ---------- Photo tilt ---------- */

function setupTilt() {
  const frame = $('[data-tilt]');
  if (!frame || reducedMotion || matchMedia('(hover: none)').matches) return;
  frame.addEventListener('pointermove', (e) => {
    const r = frame.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    frame.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
  });
  frame.addEventListener('pointerleave', () => {
    frame.style.transform = '';
  });
}

/* ---------- Count-up stats ---------- */

function setupCounters() {
  const els = $$('[data-count]');
  if (reducedMotion || els.length === 0) return;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      io.unobserve(entry.target);
      const el = entry.target;
      const target = Number(el.dataset.count);
      const start = performance.now();
      const dur = 1100;
      const frame = (now) => {
        const t = Math.min(1, (now - start) / dur);
        el.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
        if (t < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }
  });
  els.forEach((el) => io.observe(el));
}

/* ---------- Project filters ---------- */

function setupFilters() {
  const group = $('[data-filters]');
  const cards = $$('[data-projects] .project-card');
  if (!group) return;
  group.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    const tag = btn.dataset.filter;
    for (const b of $$('[data-filter]', group)) {
      const on = b === btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    }
    for (const card of cards) {
      const tags = card.dataset.tags.split(',');
      card.classList.toggle('is-hidden', tag !== 'all' && !tags.includes(tag));
      card.classList.add('is-visible');
    }
  });
}

/* ---------- Live GitHub data (stars, last update) ---------- */

async function setupGitHub() {
  const cards = $$('[data-repo]');
  if (cards.length === 0) return;
  const user = 'tonitalej';
  const key = 'gh-repos-v1';
  let repos = null;
  try {
    const cached = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (cached && Date.now() - cached.at < 60 * 60 * 1000) repos = cached.repos;
  } catch {
    /* ignore */
  }
  if (!repos) {
    try {
      const res = await fetch(`https://api.github.com/users/${user}/repos?per_page=100`, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      repos = data.map((r) => ({ name: r.name, stars: r.stargazers_count, pushed: r.pushed_at }));
      try {
        sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), repos }));
      } catch {
        /* ignore */
      }
    } catch {
      return; // Offline or rate-limited: the static cards are complete without this.
    }
  }
  const byName = new Map(repos.map((r) => [r.name.toLowerCase(), r]));
  for (const card of cards) {
    const repo = byName.get(card.dataset.repo.toLowerCase());
    const meta = $('[data-repo-meta]', card);
    if (!repo || !meta) continue;
    const stars = $('[data-stars]', meta);
    if (repo.stars > 0) $('span', stars).textContent = String(repo.stars);
    else stars.hidden = true;
    const updated = $('[data-updated]', meta);
    $('span', updated).textContent = timeAgo(new Date(repo.pushed));
    updated.title = `Last push ${new Date(repo.pushed).toLocaleDateString()}`;
    meta.hidden = false;
  }
}

function timeAgo(date) {
  const s = (Date.now() - date.getTime()) / 1000;
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, secs] of units) {
    if (s >= secs) return rtf.format(-Math.floor(s / secs), unit);
  }
  return 'just now';
}

/* ---------- Copy email ---------- */

function setupCopy() {
  for (const btn of $$('[data-copy]')) {
    const label = $('[data-copy-label]', btn);
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        label.textContent = 'Copied!';
      } catch {
        label.textContent = btn.dataset.copy;
      }
      setTimeout(() => (label.textContent = 'Copy email'), 2000);
    });
  }
}

/* ---------- Interactive terminal ---------- */

function setupTerminal() {
  const root = $('[data-terminal]');
  if (!root) return;
  const body = $('[data-terminal-body]', root);
  const form = $('[data-terminal-form]', root);
  const input = $('input', form);
  let info = {};
  try {
    info = JSON.parse(root.dataset.info || '{}');
  } catch {
    /* ignore */
  }
  const history = [];
  let hIndex = 0;

  // Each line is an array of [text, className?] segments, rendered as text nodes only.
  const print = (...segments) => {
    const p = document.createElement('p');
    for (const seg of segments) {
      const [text, cls] = Array.isArray(seg) ? seg : [seg];
      if (cls) {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = text;
        p.append(span);
      } else {
        p.append(document.createTextNode(text));
      }
    }
    body.append(p);
    body.scrollTop = body.scrollHeight;
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, reducedMotion ? 0 : ms));

  const commands = {
    help() {
      print(['Available commands:', 't-accent']);
      const list = [
        ['whoami', 'who is Toni?'],
        ['about', 'a short bio'],
        ['skills', 'what I work with'],
        ['projects', 'things I have built'],
        ['contact', 'how to reach me'],
        ['ping <host>', 'test a connection'],
        ['traceroute', 'trace the route to me'],
        ['theme', 'toggle light / dark'],
        ['date', 'current date and time'],
        ['clear', 'clear the screen'],
      ];
      for (const [c, d] of list) print(['  ' + c.padEnd(14), 't-violet'], d);
    },
    whoami() {
      print(`${info.name} — ${info.role}`);
    },
    about() {
      print(info.about || '');
    },
    skills() {
      for (const g of info.skills || []) {
        print([g.title, 't-accent']);
        print('  ' + g.items.join(' · '));
      }
    },
    projects() {
      for (const p of info.projects || []) {
        print(['▸ ' + p.title, 't-accent'], '  github.com/' + info.github + '/' + p.repo);
      }
      print(['Scroll to Projects for details.', 'muted']);
    },
    contact() {
      print(['email    ', 't-violet'], info.email);
      print(['github   ', 't-violet'], 'github.com/' + info.github);
      print(['linkedin ', 't-violet'], info.linkedin.replace('https://www.', ''));
    },
    async ping(args) {
      const host = (args[0] || 'tonitalej.github.io').slice(0, 60);
      print(`PING ${host}: 56 data bytes`);
      for (let i = 0; i < 4; i++) {
        await wait(450);
        const ms = (12 + Math.random() * 18).toFixed(1);
        print(`64 bytes from ${host}: icmp_seq=${i} ttl=57 time=${ms} ms`);
      }
      print(['--- 4 packets transmitted, 4 received, 0% packet loss ---', 't-accent']);
    },
    async traceroute() {
      const hops = ['your-router.local', 'isp-gateway', 'beirut-ix', 'github-edge', 'tonitalej.github.io'];
      print('traceroute to tonitalej.github.io, 30 hops max');
      for (let i = 0; i < hops.length; i++) {
        await wait(350);
        print(` ${i + 1}  ${hops[i].padEnd(22)} ${(4 + i * 6 + Math.random() * 4).toFixed(1)} ms`);
      }
      print(['Destination reached. Say hi via `contact`.', 't-accent']);
    },
    theme() {
      $('[data-theme-toggle]')?.click();
      print(`Theme set to ${document.documentElement.dataset.theme}.`);
    },
    date() {
      print(new Date().toString());
    },
    clear() {
      body.textContent = '';
    },
    sudo() {
      print(['Nice try. This incident will be reported. 😄', 't-warn']);
    },
    ls() {
      print('about.txt  skills/  projects/  contact.txt');
    },
    exit() {
      print('There is no escape. Try `help`.');
    },
  };
  commands.cat = (args) => {
    const f = (args[0] || '').replace(/\/$/, '');
    if (f === 'about.txt') return commands.about();
    if (f === 'contact.txt') return commands.contact();
    if (f === 'skills') return commands.skills();
    if (f === 'projects') return commands.projects();
    print(`cat: ${f || '(missing file)'}: No such file or directory`);
  };

  let busy = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const raw = input.value.trim().slice(0, 200);
    input.value = '';
    print(['toni@joun:~$ ', 'prompt'], raw);
    if (!raw) return;
    history.push(raw);
    hIndex = history.length;
    const [name, ...args] = raw.split(/\s+/);
    const cmd = commands[name.toLowerCase()];
    if (!cmd) {
      print(`command not found: ${name}. Type `, ['help', 't-accent'], ' for a list.');
      return;
    }
    busy = true;
    try {
      await cmd(args);
    } finally {
      busy = false;
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' && hIndex > 0) {
      input.value = history[--hIndex];
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      hIndex = Math.min(history.length, hIndex + 1);
      input.value = history[hIndex] || '';
      e.preventDefault();
    } else if (e.key === 'Tab') {
      const match = Object.keys(commands).find((c) => c.startsWith(input.value) && input.value);
      if (match) {
        input.value = match;
        e.preventDefault();
      }
    }
  });
  body.addEventListener('click', () => input.focus({ preventScroll: true }));
}

/* ---------- Boot ---------- */

setupTheme();
setupHeader();
setupReveal();
setupTyped();
setupNetwork();
setupTilt();
setupCounters();
setupFilters();
setupCopy();
setupTerminal();
setupGitHub();
