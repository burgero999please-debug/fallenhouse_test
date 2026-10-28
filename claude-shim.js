/* Fallen House — Supabase 어댑터
   게임은 claude.ai의 window.claude.use('db'|'user'|'room') 를 씁니다.
   Vercel 같은 일반 호스팅에서는 이 파일이 같은 모양의 API를 Supabase 위에 만들어 줍니다.
   설정이 비어 있거나 연결에 실패하면 null 을 돌려줘서 게임은 혼자 하는 모드로 돌아갑니다. */
(function(){
  const cfg = window.FH_CONFIG || {};
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } };
  /* 게임 스크립트는 로그인한 뒤에 실행합니다. 다른 계정으로 바뀌면 이 기기에 남은 이전 캐릭터 임시 저장을 지웁니다. */
  function runGame(uid) {
    if (uid && LS('fh-uid') !== uid) { LS('qz7-camp', null); LS('fh-uid', uid); }
    const src = document.getElementById('fhGame'); if (!src || src.dataset.ran) return; src.dataset.ran = '1';
    const s = document.createElement('script'); s.textContent = src.textContent; document.body.appendChild(s);
  }
  const KO = m => /Invalid login/i.test(m) ? '이메일 또는 비밀번호가 맞지 않아요.' : /already registered|already been registered/i.test(m) ? '이미 가입된 이메일이에요. 로그인해 주세요.' : /Password should be/i.test(m) ? '비밀번호는 6자 이상이어야 해요.' : /Email not confirmed/i.test(m) ? '메일함의 인증 링크를 먼저 눌러 주세요.' : /rate limit/i.test(m) ? '잠시 뒤에 다시 시도해 주세요.' : /valid email|invalid format/i.test(m) ? '이메일 형식을 확인해 주세요.' : m;
  function gate(sb, offline) {
    return new Promise(done => {
      const css = `#fhAuth{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:#0f1211;color:#e8e4da;font:15px/1.5 "IBM Plex Sans KR",system-ui,sans-serif;padding:16px;overflow:auto}
#fhAuth .bx{width:min(380px,100%);display:flex;flex-direction:column;gap:12px}#fhAuth h1{font:400 34px/1 "Italiana",serif;letter-spacing:.18em;margin:0 0 4px}#fhAuth .sub{color:#9aa0a3;font-size:13px;margin:0 0 10px}
#fhAuth .big{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;background:none;border:1px solid #3a403e;color:#e8e4da;padding:14px 16px;font:inherit;cursor:pointer}#fhAuth .big b{font-size:17px}#fhAuth .big small{color:#9aa0a3;font-size:12px}#fhAuth .big:hover,#fhAuth .big.pri{border-color:#2fa597}#fhAuth .big.pri{background:#15302c}
#fhAuth label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#9aa0a3}#fhAuth input{font:inherit;color:#e8e4da;background:#171b1a;border:1px solid #3a403e;padding:10px 12px}
#fhAuth .go{background:#1f8f83;color:#fff;border:0;padding:12px;font:inherit;font-weight:600;cursor:pointer}#fhAuth .go:disabled{opacity:.6}#fhAuth .msg{min-height:20px;font-size:13px;color:#e0a43a;margin:0}#fhAuth .lnk{background:none;border:0;color:#9aa0a3;text-decoration:underline;cursor:pointer;font:inherit;font-size:12px;align-self:flex-start;padding:0}#fhAuth h2{font-size:18px;margin:0}`;
      const el = document.createElement('div'); el.id = 'fhAuth'; document.body.appendChild(el);
      const home = () => {
        el.innerHTML = `<style>${css}</style><div class="bx"><h1>FALLEN HOUSE</h1><p class="sub">좀비 아포칼립스 생존 · 테스트 서버</p>
          ${offline ? `<p class="msg">서버 설정(config.js)이 비어 있거나 서버에 연결하지 못했어요. 계정 없이 이 기기에서만 해 볼 수 있어요.</p><button class="big pri" data-go="solo"><b>이 기기에서만 해 보기</b><small>진행은 이 브라우저에만 저장돼요</small></button>`
          : `<button class="big pri" data-go="up"><b>처음 시작하기</b><small>이메일로 계정을 만들고 새 생존자로 시작해요</small></button><button class="big" data-go="in"><b>로그인</b><small>이미 계정이 있어요 · 폰·컴퓨터 어디서든 같은 생존자</small></button>`}</div>`;
        el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => b.dataset.go === 'solo' ? (el.remove(), done(null)) : form(b.dataset.go));
      };
      const form = mode => {
        const up = mode === 'up';
        el.innerHTML = `<style>${css}</style><form class="bx" novalidate><h1>FALLEN HOUSE</h1><h2>${up ? '처음 시작하기' : '로그인'}</h2>
          <label>이메일<input type="email" name="em" autocomplete="email" required></label><label>비밀번호 (6자 이상)<input type="password" name="pw" autocomplete="${up ? 'new-password' : 'current-password'}" minlength="6" required></label>
          ${up ? '<label>비밀번호 확인<input type="password" name="pw2" autocomplete="new-password" minlength="6" required></label>' : ''}
          <button class="go" type="submit">${up ? '계정 만들고 시작' : '로그인'}</button><p class="msg" role="status"></p>
          ${up ? '' : '<button type="button" class="lnk" data-reset>비밀번호를 잊었어요</button>'}<button type="button" class="lnk" data-back>← 처음 화면으로</button></form>`;
        const f = el.querySelector('form'), msg = el.querySelector('.msg'), go = el.querySelector('.go'); f.em.focus();
        el.querySelector('[data-back]').onclick = home;
        const rs = el.querySelector('[data-reset]'); if (rs) rs.onclick = async () => { const em = f.em.value.trim(); if (!em) { msg.textContent = '이메일을 먼저 적어 주세요.'; return; } const r = await sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + location.pathname }); msg.textContent = r.error ? KO(r.error.message) : '비밀번호 재설정 메일을 보냈어요.'; };
        f.onsubmit = async e => { e.preventDefault(); const em = f.em.value.trim(), pw = f.pw.value;
          if (!em || pw.length < 6) { msg.textContent = '이메일과 6자 이상 비밀번호를 적어 주세요.'; return; }
          if (up && pw !== f.pw2.value) { msg.textContent = '비밀번호 확인이 달라요.'; return; }
          go.disabled = true; msg.textContent = '';
          try {
            const r = up ? await sb.auth.signUp({ email: em, password: pw, options: { emailRedirectTo: location.origin + location.pathname } }) : await sb.auth.signInWithPassword({ email: em, password: pw });
            if (r.error) { msg.textContent = KO(r.error.message); return; }
            if (!r.data.session) { form('in'); el.querySelector('.msg').textContent = '메일함에서 인증 링크를 누른 뒤 로그인해 주세요.'; return; }
            el.remove(); done(r.data.session);
          } catch (err) { msg.textContent = '연결에 실패했어요. 잠시 뒤 다시 시도해 주세요.'; } finally { go.disabled = false; }
        };
      };
      home();
    });
  }
  const ready = (async () => {
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) { await gate(null, true); runGame(null); return null; }
    try {
      const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      sb.auth.onAuthStateChange(async ev => { if (ev !== 'PASSWORD_RECOVERY') return; const pw = prompt('새 비밀번호 (6자 이상)'); if (pw && pw.length >= 6) { const r = await sb.auth.updateUser({ password: pw }); alert(r.error ? '바꾸지 못했어요: ' + r.error.message : '비밀번호를 바꿨어요.'); } });
      let { data: { session } } = await sb.auth.getSession();
      if (session && session.user.is_anonymous) { await sb.auth.signOut(); session = null; }
      if (!session) session = await gate(sb);
      window.FH_AUTH = Object.freeze({ email: session.user.email || '', signOut: async () => { await sb.auth.signOut(); LS('qz7-camp', null); location.reload(); } });
      runGame(session.user.id);
      return { sb, uid: session.user.id };
    } catch (e) { console.warn('[FH] Supabase 연결 실패', e); await gate(null, true); runGame(null); return null; }
  })();

  const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
  const collOf = p => p.split('/').slice(0, -1).join('/');
  const idOf = p => p.split('/').pop();
  const snapDoc = (path, row) => ({ id: idOf(path), exists: !!row, data: () => clone(row ? row.data : undefined) });
  const err = (code, message) => Object.assign(new Error(message || code), { code });

  /* ---------- db ---------- */
  function makeDb(sb, uid) {
    function doc(path) {
      return {
        id: idOf(path),
        async get() { const { data, error } = await sb.from('fh_docs').select('data').eq('path', path).maybeSingle(); if (error) throw err('upstream_error', error.message); return snapDoc(path, data); },
        async set(obj) { const { error } = await sb.from('fh_docs').upsert({ path, coll: collOf(path), data: clone(obj), owner: uid, updated_at: new Date().toISOString() }); if (error) throw err(/row-level|permission/i.test(error.message) ? 'invalid_argument' : 'upstream_error', error.message); },
        async update(obj) { const cur = await this.get(); return this.set(Object.assign(cur.exists ? cur.data() : {}, obj)); },
        async delete() { const { error } = await sb.from('fh_docs').delete().eq('path', path); if (error) throw err('upstream_error', error.message); },
        async acquire(o) { const { data, error } = await sb.rpc('fh_acquire_lease', { p_path: path, p_ttl_ms: (o && o.ttlMs) || 5000 }); if (error) throw err('upstream_error', error.message); return { acquired: !!data }; },
        onSnapshot(cb, onErr) {
          let alive = true;
          this.get().then(s => alive && cb(s)).catch(e => onErr && onErr(e));
          const ch = sb.channel('doc:' + path + ':' + Math.random().toString(36).slice(2))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'fh_docs', filter: 'path=eq.' + path }, p => { if (!alive) return; cb(snapDoc(path, p.eventType === 'DELETE' ? null : p.new)); })
            .subscribe();
          return () => { alive = false; sb.removeChannel(ch); };
        }
      };
    }
    function collection(coll) {
      const q = { order: null, lim: 200 };
      const api = {
        doc: id => doc(coll + '/' + id),
        orderBy(f, dir) { q.order = [f, dir || 'asc']; return api; },
        limit(n) { q.lim = n; return api; },
        where() { return api; },
        async get() { return build(await fetchAll()); },
        onSnapshot(cb, onErr) {
          let alive = true; const map = new Map();
          const emit = () => alive && cb(build([...map.entries()].map(([path, data]) => ({ path, data }))));
          fetchAll().then(rows => { rows.forEach(r => map.set(r.path, r.data)); emit(); }).catch(e => onErr && onErr(e));
          const ch = sb.channel('coll:' + coll + ':' + Math.random().toString(36).slice(2))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'fh_docs', filter: 'coll=eq.' + coll }, p => {
              if (p.eventType === 'DELETE') map.delete(p.old.path); else map.set(p.new.path, p.new.data); emit(); })
            .subscribe();
          return () => { alive = false; sb.removeChannel(ch); };
        }
      };
      async function fetchAll() { const { data, error } = await sb.from('fh_docs').select('path,data').eq('coll', coll).order('updated_at', { ascending: false }).limit(500); if (error) throw err('upstream_error', error.message); return data || []; }
      function build(rows) {
        let docs = rows.map(r => snapDoc(r.path, r));
        if (q.order) { const [f, dir] = q.order, s = dir === 'desc' ? -1 : 1; docs.sort((a, b) => { const x = (a.data() || {})[f] ?? 0, y = (b.data() || {})[f] ?? 0; return x > y ? s : x < y ? -s : 0; }); }
        docs = docs.slice(0, q.lim); return { docs, size: docs.length, empty: !docs.length };
      }
      return api;
    }
    return { doc, collection };
  }

  /* ---------- user ---------- */
  function makeUser(sb, uid) {
    /* 관리자 = fh_admins 표에 계정 ID가 등록된 사람 (README의 '관리자 등록' 참고) */
    let adm = null; const isAdmin = () => adm || (adm = sb.from('fh_admins').select('uid').eq('uid', uid).maybeSingle().then(r => !!(r.data && !r.error)).catch(() => false));
    return { id: async () => uid, me: async () => ({ id: uid, name: '' }), profiles: async ids => Object.fromEntries((ids || []).map(i => [i, { id: i, name: '' }])), isOwner: () => isAdmin(), canEdit: () => isAdmin(), can: async () => null };
  }

  /* ---------- room (broadcast + presence) ---------- */
  function makeRoom(sb, uid) {
    const myPeer = 'p' + Math.random().toString(36).slice(2, 12);
    function open(name) {
      const ch = sb.channel('fh-room-' + name, { config: { broadcast: { self: true }, presence: { key: myPeer } } });
      const subs = {}, peerCbs = [], connCbs = []; let me = {}, peers = [], prev = new Map(), connected = false, left = false;
      ch.on('broadcast', { event: '*' }, ({ event, payload }) => {
        const p = payload || {}; const msg = { topic: event, data: p.d, by: p.by || null, peer: p.peer || '', isMe: p.by === uid, sameTab: p.peer === myPeer, kind: 'viewer', guest: false };
        (subs[event] || []).slice().forEach(f => { try { f(msg); } catch (e) { console.error(e); } });
      });
      ch.on('presence', { event: 'sync' }, () => {
        const st = ch.presenceState(); const next = new Map();
        for (const key in st) { const m = st[key][st[key].length - 1] || {}; next.set(key, Object.freeze({ peer: key, by: m.by || null, isMe: m.by === uid, sameTab: key === myPeer, kind: 'viewer', guest: false, presence: Object.freeze(clone(m.p || {})), updatedAt: Date.now() })); }
        const joined = [...next.keys()].filter(k => !prev.has(k)).map(k => next.get(k));
        const gone = [...prev.keys()].filter(k => !next.has(k)).map(k => prev.get(k));
        const updated = [...next.keys()].filter(k => prev.has(k) && JSON.stringify(prev.get(k).presence) !== JSON.stringify(next.get(k).presence)).map(k => next.get(k));
        prev = next; peers = Object.freeze([...next.values()]);
        const change = { peers, joined, left: gone, updated };
        peerCbs.slice().forEach(f => { try { f(change); } catch (e) { console.error(e); } });
      });
      ch.subscribe(status => { connected = status === 'SUBSCRIBED'; if (connected) ch.track({ by: uid, p: me }); connCbs.forEach(f => f(connected)); });
      let trackT = null;
      return {
        name,
        async emit(topic, data) { if (left) throw err('invalid_argument', 'left'); if (!connected) return; await ch.send({ type: 'broadcast', event: topic, payload: { d: clone(data), by: uid, peer: myPeer } }); },
        on(topic, fn) { (subs[topic] = subs[topic] || []).push(fn); return () => { subs[topic] = (subs[topic] || []).filter(x => x !== fn); }; },
        async presence(patch) { for (const k in patch) { if (patch[k] === null) delete me[k]; else me[k] = clone(patch[k]); } clearTimeout(trackT); trackT = setTimeout(() => { if (connected) ch.track({ by: uid, p: me }); }, 120); },
        peers: () => peers,
        onPeers(fn) { peerCbs.push(fn); if (peers.length) setTimeout(() => fn({ peers, joined: peers, left: [], updated: [] }), 0); return () => { const i = peerCbs.indexOf(fn); if (i >= 0) peerCbs.splice(i, 1); }; },
        connected: () => connected,
        onConnection(fn) { connCbs.push(fn); setTimeout(() => fn(connected), 0); return () => { const i = connCbs.indexOf(fn); if (i >= 0) connCbs.splice(i, 1); }; },
        async leave() { left = true; await sb.removeChannel(ch); }
      };
    }
    const lobby = open('lobby'); const rooms = {};
    lobby.join = async name => { if (!/^[a-z0-9][a-z0-9_.-]{0,47}$/.test(name)) throw err('invalid_argument', 'room name'); if (!rooms[name]) { const r = open(name); const lv = r.leave; r.leave = async () => { delete rooms[name]; await lv(); }; rooms[name] = r; } return rooms[name]; };
    return lobby;
  }

  let cache = {};
  window.claude = Object.freeze({
    use: async name => {
      if (cache[name] !== undefined) return cache[name];
      const c = await ready; if (!c) return (cache[name] = null);
      if (name === 'db') return (cache[name] = Object.freeze(makeDb(c.sb, c.uid)));
      if (name === 'user') return (cache[name] = Object.freeze(makeUser(c.sb, c.uid)));
      if (name === 'room') return (cache[name] = makeRoom(c.sb, c.uid));
      return (cache[name] = null);
    }
  });
})();
