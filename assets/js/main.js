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

/* ---------- Header: scrolled state, mobile menu, active section ---------- */

function setupHeader() {
  const header = $('[data-header]');
  const nav = $('[data-nav]');
  const menuBtn = $('[data-menu-toggle]');
  if (!header) return;

  const onScroll = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 10);
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
setupFilters();
setupCopy();
setupTerminal();
setupGitHub();
