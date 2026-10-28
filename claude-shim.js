/* Fallen House — Supabase 어댑터
   게임은 claude.ai의 window.claude.use('db'|'user'|'room') 를 씁니다.
   Vercel 같은 일반 호스팅에서는 이 파일이 같은 모양의 API를 Supabase 위에 만들어 줍니다.
   설정이 비어 있거나 연결에 실패하면 null 을 돌려줘서 게임은 혼자 하는 모드로 돌아갑니다. */
(function(){
  const cfg = window.FH_CONFIG || {};
  const ready = (async () => {
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) return null;
    try {
      const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
      let { data: { session } } = await sb.auth.getSession();
      if (!session) { const r = await sb.auth.signInAnonymously(); if (r.error) throw r.error; session = r.data.session; }
      return { sb, uid: session.user.id };
    } catch (e) { console.warn('[FH] Supabase 연결 실패, 혼자 하는 모드로 진행합니다.', e); return null; }
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
