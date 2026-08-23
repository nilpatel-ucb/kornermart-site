(function () {
  const TZ = 'America/Denver';
  const QUESTIONS = [
    { key: 'transportation', label: 'Transportation to/from work', flag: 'N' },
    { key: 'over_21', label: '21 years of age or older', flag: 'N' },
    { key: 'work_authorization', label: 'Can present proof of legal right to work', flag: 'N' },
    { key: 'drug_test', label: 'Willing to submit to a controlled-substance test', flag: 'N' },
    { key: 'essential_functions', label: 'Able to perform essential functions', flag: 'N', notes: 'essential_functions_notes' },
    { key: 'convicted', label: 'Convicted of a criminal offense (other than minor traffic)', flag: 'Y', notes: 'conviction_notes' },
    { key: 'extra_skills', label: 'Additional skills that suit this work', notes: 'extra_skills_notes' },
    { key: 'currently_employed', label: 'Currently employed', notes: 'employment_details' }
  ];

  const prefs = {
    stats: localStorage.getItem('km-dash-stats') !== 'off',
    compact: localStorage.getItem('km-dash-density') === 'compact'
  };

  let client = null;
  let apps = [];
  let selectedId = null;
  let sortKey = 'applied';
  let sortDir = 'desc';
  let toastTimer;

  function $(id) { return document.getElementById(id); }
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
  }
  function yn(v) {
    if (v === 'Y') return 'Yes';
    if (v === 'N') return 'No';
    return v ? String(v) : '—';
  }
  function statusClass(s) {
    const x = (s || 'New').toLowerCase();
    if (x === 'interview') return 'interview';
    if (x === 'reviewed') return 'reviewed';
    if (x === 'archived') return 'archived';
    return 'new';
  }
  function pill(status) {
    const s = status || 'New';
    return `<span class="pill ${statusClass(s)}">${esc(s)}</span>`;
  }
  function refCode(id) {
    return 'KM-' + String(id || '').replace(/-/g, '').slice(-4).toUpperCase();
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ });
  }
  function fmtDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ });
  }
  function relTime(iso) {
    if (!iso) return '';
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return min + ' min ago';
    const hr = Math.round(min / 60);
    if (hr < 24) return hr + ' hour' + (hr === 1 ? '' : 's') + ' ago';
    const d = Math.round(hr / 24);
    if (d === 1) return 'yesterday';
    if (d < 14) return d + ' days ago';
    return fmtDate(iso);
  }
  function positionsOf(row) {
    return Array.isArray(row.positions) ? row.positions.filter(Boolean) : [];
  }
  function displayName(row) {
    return row.full_name || [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ') || 'Applicant';
  }
  function primaryRole(row) {
    return positionsOf(row)[0] || 'Open role';
  }
  function extraRoles(row) {
    const n = positionsOf(row).length - 1;
    if (n > 0) return '+ ' + n + ' more role' + (n === 1 ? '' : 's');
    return positionsOf(row).length ? 'single role' : '';
  }
  function hoursFor(row) {
    const types = new Set();
    const jobs = typeof KM_JOBS !== 'undefined' ? KM_JOBS : [];
    positionsOf(row).forEach(p => {
      const title = String(p).replace(/^Other:\s*/i, '').trim();
      const job = jobs.find(j => j.title === p || j.title.toLowerCase() === title.toLowerCase());
      if (job && job.type) types.add(job.type);
    });
    return [...types].join(', ') || '—';
  }
  function addressOf(row) {
    return [row.address_line1, row.address_line2, [row.city, row.state].filter(Boolean).join(', '), row.zip]
      .filter(Boolean).join(', ') || '—';
  }

  function applyPrefs() {
    document.body.classList.toggle('hide-stats', !prefs.stats);
    document.body.classList.toggle('compact', prefs.compact);
    $('toggleStats').textContent = prefs.stats ? 'Hide stats' : 'Show stats';
    $('toggleStats').classList.toggle('on', !prefs.stats);
    $('toggleDensity').textContent = prefs.compact ? 'Comfortable rows' : 'Compact rows';
    $('toggleDensity').classList.toggle('on', prefs.compact);
  }

  function filteredList() {
    const q = $('search').value.trim().toLowerCase();
    const store = $('filterStore').value;
    const role = $('filterRole').value;
    const status = $('filterStatus').value;
    let list = apps.filter(r => {
      if (store && r.location_name !== store) return false;
      if (status && (r.status || 'New') !== status) return false;
      if (role && !positionsOf(r).includes(role)) return false;
      if (q) {
        const blob = [displayName(r), r.email, positionsOf(r).join(' '), r.location_name].join(' ').toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
    const val = r => {
      if (sortKey === 'name') return displayName(r).toLowerCase();
      if (sortKey === 'role') return primaryRole(r).toLowerCase();
      if (sortKey === 'store') return (r.location_name || '').toLowerCase();
      return r.created_at || '';
    };
    list.sort((a, b) => {
      const av = val(a), bv = val(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }

  function fillFilters() {
    const stores = [...new Set(apps.map(r => r.location_name).filter(Boolean))].sort();
    const roles = [...new Set(apps.flatMap(positionsOf))].sort();
    const storeEl = $('filterStore');
    const roleEl = $('filterRole');
    const curS = storeEl.value, curR = roleEl.value;
    storeEl.innerHTML = '<option value="">All stores</option>' + stores.map(s => `<option>${esc(s)}</option>`).join('');
    roleEl.innerHTML = '<option value="">All positions</option>' + roles.map(s => `<option>${esc(s)}</option>`).join('');
    if (stores.includes(curS)) storeEl.value = curS;
    if (roles.includes(curR)) roleEl.value = curR;
  }

  function updateStats() {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    $('statTotal').textContent = apps.length;
    $('statWeek').textContent = apps.filter(r => new Date(r.created_at).getTime() >= weekAgo).length;
    $('statInterview').textContent = apps.filter(r => r.status === 'Interview').length;
    $('statResume').textContent = apps.filter(r => r.resume_path).length;
  }

  function qRow(label, value, flagWhen, notes) {
    const ans = yn(value);
    let klass = '';
    if (ans === 'Yes' || ans === 'No') {
      klass = (flagWhen && value === flagWhen) ? 'flag' : 'yes';
    }
    return `<div class="q-row"><span>${esc(label)}</span><span class="pill ${klass}">${esc(ans)}</span></div>
      ${notes ? `<div class="note-blurb">${esc(notes)}</div>` : ''}`;
  }

  function renderDetail(row) {
    const el = $('detail');
    if (!row) {
      el.innerHTML = '<div class="card"><div class="block empty">Select an application to review it.</div></div>';
      return;
    }
    const name = displayName(row);
    const roles = positionsOf(row);
    const st = row.status || 'New';
    const fileName = row.resume_filename || 'resume';
    const hasResume = !!row.resume_path;
    const fileKind = /\.pdf$/i.test(fileName) ? 'PDF' : (/\.docx?$/i.test(fileName) ? 'DOC' : 'FILE');
    const qs = QUESTIONS.map(q => qRow(q.label, row[q.key], q.flag, row[q.notes])).join('');
    const contactQ = (row.currently_employed === 'Y' || row.contact_employer)
      ? qRow('May we contact current employer', row.contact_employer, null, row.contact_employer_details)
      : '';
    el.innerHTML = `
      <div class="card">
        <div class="hero">
          <div class="ref">${esc(refCode(row.id))} ${pill(st)}</div>
          <h2>${esc(name)}</h2>
          <div class="meta">${esc(primaryRole(row))}${row.location_name ? ' · ' + esc(row.location_name) : ''}</div>
        </div>
        <div class="actions">
          ${st === 'Interview' ? '' : '<button class="btn btn-red" type="button" data-act="interview">Move to interview</button>'}
          <a class="btn btn-navy" href="mailto:${encodeURIComponent(row.email || '')}?subject=${encodeURIComponent('KornerMart — ' + primaryRole(row))}">Email</a>
          ${st === 'Archived' ? '' : '<button class="btn btn-outline" type="button" data-act="archive">Archive</button>'}
        </div>
        <div class="facts">
          <div><label>Phone</label><p>${row.phone ? `<a href="tel:${esc(row.phone)}">${esc(row.phone)}</a>` : '—'}</p></div>
          <div><label>Email</label><p>${row.email ? `<a href="mailto:${esc(row.email)}">${esc(row.email)}</a>` : '—'}</p></div>
          <div><label>Address</label><p>${esc(addressOf(row))}</p></div>
          <div><label>Submitted</label><p>${esc(fmtDateTime(row.created_at))} MT</p></div>
        </div>
      </div>
      <div class="card">
        <div class="block">
          <h3>Positions</h3>
          <div class="roles">${roles.length ? roles.map(p => `<span class="pill role">${esc(p)}</span>`).join('') : '<span class="pill role">—</span>'}</div>
          <div class="kv">
            <div><span>Preferred store</span><b>${esc(row.preferred_location || row.location_name || '—')}</b></div>
            <div><span>Availability</span><b>${esc(hoursFor(row))}</b></div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="block">
          <div class="resume-head">
            <h3>Resume</h3>
            <div class="head-actions">
              <button class="btn btn-outline" type="button" data-act="open-resume" ${hasResume ? '' : 'disabled'}>Open full</button>
              <button class="btn btn-navy" type="button" data-act="dl-resume" ${hasResume ? '' : 'disabled'}>Download ${fileKind === 'PDF' ? 'PDF' : 'file'}</button>
            </div>
          </div>
          ${hasResume ? `<div class="resume-preview">
            <div class="resume-file"><div class="ico">${esc(fileKind)}</div>
              <div><b>${esc(fileName)}</b><div style="color:var(--ink-soft);font-size:12px">${fileKind === 'PDF' ? 'Styled preview · not a live PDF' : 'Word / other file · use Download'}</div></div>
            </div>
            <div class="resume-sheet">
              <div class="nm">${esc(name)}</div>
              <div class="sec">EXPERIENCE</div><div class="bar s"></div><div class="bar m"></div>
              <div class="sec">EDUCATION</div><div class="bar l"></div>
              <div class="sec">SKILLS</div><div class="bar m"></div>
            </div>
          </div>` : '<div class="resume-empty">No resume uploaded.</div>'}
        </div>
      </div>
      <div class="card">
        <div class="block">
          <h3>Application questions</h3>
          ${qs}${contactQ}
          <div class="prose">
            <h4>Education, training and experience</h4>
            <p>${esc(row.education || '—')}</p>
          </div>
          <p class="cert">${row.terms_accepted ? 'Applicant certified that the information is true and complete and accepted the Terms &amp; Conditions.' : 'Certification not recorded.'}${row.marketing_opt_in ? ' Opted in to promotional emails.' : ''}</p>
        </div>
      </div>`;
  }

  function renderList() {
    const list = filteredList();
    $('listCount').textContent = list.length + ' of ' + apps.length + ' applications';
    const body = $('rows');
    const empty = $('empty');
    if (!list.length) {
      body.innerHTML = '';
      empty.classList.remove('hidden');
      renderDetail(null);
      return;
    }
    empty.classList.add('hidden');
    if (!list.some(r => r.id === selectedId)) selectedId = list[0].id;
    body.innerHTML = list.map(r => {
      const name = displayName(r);
      const isNew = (r.status || 'New') === 'New';
      return `<tr class="${r.id === selectedId ? 'selected' : ''}" data-id="${esc(r.id)}">
        <td><div class="person"><div class="av">${esc(initials(name))}</div>
          <div><b>${esc(name)}${isNew ? '<i class="dot" title="New"></i>' : ''}</b>
          <small>${esc(r.email || '')}</small></div></div></td>
        <td><div>${esc(primaryRole(r))}<span class="role-sub">${esc(extraRoles(r))}</span></div></td>
        <td>${esc(r.location_name || '—')}</td>
        <td class="when"><b>${esc(fmtDate(r.created_at))}</b><small>${esc(relTime(r.created_at))}</small></td>
        <td>${pill(r.status)}</td>
      </tr>`;
    }).join('');
    renderDetail(apps.find(r => r.id === selectedId) || list[0]);
  }

  async function setStatus(id, status) {
    const { error } = await client.from('applications').update({ status }).eq('id', id);
    if (error) { toast(error.message || 'Could not update status.'); return; }
    const row = apps.find(r => r.id === id);
    if (row) row.status = status;
    updateStats();
    renderList();
  }

  async function openResume(row, download) {
    if (!row.resume_path) { toast('No resume on file.'); return; }
    const options = download ? { download: row.resume_filename || 'resume' } : undefined;
    const { data, error } = await client.storage.from('resumes').createSignedUrl(row.resume_path, 3600, options);
    if (error || !data || !data.signedUrl) {
      toast((error && error.message) || 'Resume could not be opened.');
      return;
    }
    if (download) {
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = row.resume_filename || 'resume';
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      window.open(data.signedUrl, '_blank', 'noopener');
    }
  }

  function exportCsv() {
    const list = filteredList();
    const cols = ['full_name', 'email', 'phone', 'status', 'positions', 'location_name', 'created_at', 'resume_filename'];
    const lines = [cols.join(',')];
    list.forEach(r => {
      const obj = {
        full_name: displayName(r),
        email: r.email || '',
        phone: r.phone || '',
        status: r.status || 'New',
        positions: positionsOf(r).join('; '),
        location_name: r.location_name || '',
        created_at: r.created_at || '',
        resume_filename: r.resume_filename || ''
      };
      lines.push(cols.map(c => '"' + String(obj[c]).replace(/"/g, '""') + '"').join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kornermart-applications.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function loadApps() {
    const { data, error } = await client.from('applications').select('*').order('created_at', { ascending: false });
    if (error) { toast(error.message || 'Could not load applications.'); return; }
    apps = data || [];
    fillFilters();
    updateStats();
    renderList();
  }

  function showApp(session) {
    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');
    const email = session.user.email || '';
    $('whoEmail').textContent = email;
    $('whoAv').textContent = initials(email.split('@')[0].replace(/[._-]/g, ' '));
    applyPrefs();
    loadApps();
  }
  function showLogin() {
    $('login').classList.remove('hidden');
    $('app').classList.add('hidden');
    apps = [];
    selectedId = null;
  }
  function loginError(msg) {
    const err = $('loginErr');
    err.textContent = msg;
    err.classList.add('show');
  }

  function bind() {
    $('loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      $('loginErr').classList.remove('show');
      const btn = $('loginBtn');
      btn.disabled = true;
      btn.textContent = 'Signing in…';
      const { data, error } = await client.auth.signInWithPassword({
        email: $('email').value.trim(),
        password: $('password').value
      });
      btn.disabled = false;
      btn.textContent = 'Sign in';
      if (error) {
        loginError(error.message === 'Invalid login credentials'
          ? 'That email or password is not recognized. Staff accounts are created in the Supabase dashboard.'
          : (error.message || 'Sign in failed.'));
        return;
      }
      showApp(data.session);
    });

    $('signOut').addEventListener('click', async () => {
      await client.auth.signOut();
      showLogin();
    });

    $('rows').addEventListener('click', e => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      selectedId = tr.dataset.id;
      const row = apps.find(r => r.id === selectedId);
      if (row && (row.status || 'New') === 'New') setStatus(selectedId, 'Reviewed');
      else renderList();
    });

    $('detail').addEventListener('click', e => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const row = apps.find(r => r.id === selectedId);
      if (!row) return;
      if (btn.dataset.act === 'interview') setStatus(row.id, 'Interview');
      if (btn.dataset.act === 'archive') setStatus(row.id, 'Archived');
      if (btn.dataset.act === 'open-resume') openResume(row, false);
      if (btn.dataset.act === 'dl-resume') openResume(row, true);
    });

    ['search', 'filterStore', 'filterRole', 'filterStatus'].forEach(id => {
      $(id).addEventListener('input', renderList);
      $(id).addEventListener('change', renderList);
    });

    $('resetBtn').addEventListener('click', () => {
      $('search').value = '';
      $('filterStore').value = '';
      $('filterRole').value = '';
      $('filterStatus').value = '';
      renderList();
    });

    document.querySelectorAll('th[data-key]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        else { sortKey = key; sortDir = key === 'applied' ? 'desc' : 'asc'; }
        document.querySelectorAll('th[data-key]').forEach(x => {
          x.classList.toggle('active', x === th);
          x.querySelector('.arrow').textContent = x === th ? (sortDir === 'asc' ? '↑' : '↓') : '↕';
        });
        renderList();
      });
    });

    $('exportBtn').addEventListener('click', exportCsv);
    $('toggleStats').addEventListener('click', () => {
      prefs.stats = !prefs.stats;
      localStorage.setItem('km-dash-stats', prefs.stats ? 'on' : 'off');
      applyPrefs();
    });
    $('toggleDensity').addEventListener('click', () => {
      prefs.compact = !prefs.compact;
      localStorage.setItem('km-dash-density', prefs.compact ? 'compact' : 'comfortable');
      applyPrefs();
    });
  }

  async function init() {
    bind();
    if (typeof supabase === 'undefined' || !supabase.createClient) {
      loginError('Could not load the application service.');
      return;
    }
    if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') {
      loginError('supabase-config.js did not load.');
      return;
    }
    client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await client.auth.getSession();
    if (data.session) showApp(data.session);
    client.auth.onAuthStateChange(ev => {
      if (ev === 'SIGNED_OUT') showLogin();
    });
  }

  init();
})();
