// ── CONFIGURAZIONE ──────────────────────────────────────────────
var CONFIG = {
  domain: '',
  apiKey: ''
};

// ── STATO ───────────────────────────────────────────────────────
var currentTab   = 'agente';
var allTickets   = [];
var companiesMap = {};
var agentsMap    = {};
var isLoading    = false;
var chartInstance = null;

// ── INIT ────────────────────────────────────────────────────────
window.onload = function() {
  loadSettings();
  showTab('agente');
};

function loadSettings() {
  var saved = localStorage.getItem('fd_config');
  if (saved) {
    var s = JSON.parse(saved);
    CONFIG.domain = s.domain || '';
    CONFIG.apiKey  = s.apiKey  || '';
  }
}

function saveSettings() {
  var domain = document.getElementById('inp_domain').value.trim();
  var apiKey  = document.getElementById('inp_apikey').value.trim();
  if (!domain || !apiKey) { alert('Compila tutti i campi.'); return; }
  CONFIG.domain = domain;
  CONFIG.apiKey  = apiKey;
  companiesMap  = {};
  agentsMap     = {};
  localStorage.setItem('fd_config', JSON.stringify(CONFIG));
  alert('Impostazioni salvate!');
}

// ── NAVIGAZIONE ─────────────────────────────────────────────────
function showTab(tab) {
  currentTab = tab;
  ['agente','cliente','categoria','impostazioni'].forEach(function(t) {
    var el = document.getElementById('tab-' + t);
    if (el) el.classList.remove('active');
  });
  var active = document.getElementById('tab-' + tab);
  if (active) active.classList.add('active');

  var mc = document.getElementById('mainContent');
  if (tab === 'impostazioni') {
    mc.innerHTML = renderImpostazioni();
    document.getElementById('inp_domain').value = CONFIG.domain;
    document.getElementById('inp_apikey').value  = CONFIG.apiKey;
    return;
  }
  mc.innerHTML = renderReportPage(tab);
  loadReport();
}

// ── DATE DEFAULT (mese corrente) ─────────────────────────────────
function defaultDates() {
  var now = new Date();
  var y = now.getFullYear();
  var m = String(now.getMonth() + 1).padStart(2, '0');
  var d = String(now.getDate()).padStart(2, '0');
  return { from: y + '-' + m + '-01', to: y + '-' + m + '-' + d };
}

// ── RENDER PAGINE ────────────────────────────────────────────────
function renderReportPage(tab) {
  var dates  = defaultDates();
  var titles = {
    agente:    '&#128100; Ticket chiusi per Agente',
    cliente:   '&#127970; Ticket chiusi per Cliente',
    categoria: '&#127991;&#65039; Ticket chiusi per Categoria'
  };
  return '<div class="card">' +
    '<h2>' + titles[tab] + '</h2>' +
    '<div class="filter-bar">' +
      '<label>Dal</label>' +
      '<input type="date" id="dateFrom" value="' + dates.from + '">' +
      '<label>Al</label>' +
      '<input type="date" id="dateTo" value="' + dates.to + '">' +
      '<button class="btn-load" id="btnLoad" onclick="loadReport()">Carica</button>' +
    '</div>' +
    '<div class="status-bar" id="statusBar"></div>' +
    '<div id="reportTable"></div>' +
  '</div>';
}

function renderImpostazioni() {
  return '<div class="card">' +
    '<h2>Impostazioni</h2>' +
    '<div class="settings-group">' +
      '<label>Dominio Freshdesk</label>' +
      '<input type="text" id="inp_domain" placeholder="es. azienda.freshdesk.com">' +
    '</div>' +
    '<div class="settings-group">' +
      '<label>API Key</label>' +
      '<input type="password" id="inp_apikey" placeholder="La tua API key">' +
    '</div>' +
    '<button class="btn-load" onclick="saveSettings()">Salva</button>' +
  '</div>';
}

// ── CARICAMENTO ──────────────────────────────────────────────────
function loadReport() {
  if (isLoading) return;
  var fromEl = document.getElementById('dateFrom');
  var toEl   = document.getElementById('dateTo');
  if (!fromEl || !toEl) return;
  var from = fromEl.value;
  var to   = toEl.value;
  if (!from || !to) { setStatus('Seleziona le date.', 'error'); return; }
  if (!CONFIG.domain || !CONFIG.apiKey) {
    setStatus('Inserisci dominio e API key nelle Impostazioni.', 'error'); return;
  }
  isLoading   = true;
  allTickets  = [];
  var btn = document.getElementById('btnLoad');
  if (btn) btn.disabled = true;
  document.getElementById('reportTable').innerHTML = '';

  if (Object.keys(companiesMap).length > 0 && Object.keys(agentsMap).length > 0) {
    setStatus('<span class="spinner"></span> Caricamento ticket...', '');
    fetchAllTickets(from, to, 1);
  } else {
    companiesMap = {};
    agentsMap    = {};
    setStatus('<span class="spinner"></span> Caricamento aziende...', '');
    fetchAllCompanies(1, from, to);
  }
}

function authHeader() {
  return 'Basic ' + btoa(CONFIG.apiKey + ':X');
}

// ── FETCH AZIENDE ────────────────────────────────────────────────
function fetchAllCompanies(page, from, to) {
  fetch('https://' + CONFIG.domain + '/api/v2/companies?per_page=100&page=' + page,
    { headers: { 'Authorization': authHeader() } })
  .then(function(r) { return r.json(); })
  .then(function(list) {
    list.forEach(function(c) { companiesMap[c.id] = c.name; });
    if (list.length === 100) {
      fetchAllCompanies(page + 1, from, to);
    } else {
      setStatus('<span class="spinner"></span> Caricamento agenti...', '');
      fetchAllAgents(1, from, to);
    }
  })
  .catch(function() { fetchAllAgents(1, from, to); });
}

// ── FETCH AGENTI ─────────────────────────────────────────────────
function fetchAllAgents(page, from, to) {
  fetch('https://' + CONFIG.domain + '/api/v2/agents?per_page=100&page=' + page,
    { headers: { 'Authorization': authHeader() } })
  .then(function(r) { return r.json(); })
  .then(function(list) {
    list.forEach(function(a) {
      agentsMap[a.id] = a.contact ? a.contact.name : ('Agente #' + a.id);
    });
    if (list.length === 100) {
      fetchAllAgents(page + 1, from, to);
    } else {
      setStatus('<span class="spinner"></span> Caricamento ticket...', '');
      fetchAllTickets(from, to, 1);
    }
  })
  .catch(function() { fetchAllTickets(from, to, 1); });
}

// ── FETCH TICKET ─────────────────────────────────────────────────
function fetchAllTickets(from, to, page) {
  var url = 'https://' + CONFIG.domain + '/api/v2/tickets?' +
    'updated_since=' + from + 'T00:00:00Z' +
    '&order_by=updated_at&order_type=desc' +
    '&per_page=100&page=' + page +
    '&include=requester,stats';

  fetch(url, { headers: { 'Authorization': authHeader() } })
  .then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status + ' — verifica API key e dominio.');
    return r.json();
  })
  .then(function(tickets) {
    var filtered = tickets.filter(function(t) {
      var ra = t.stats && t.stats.resolved_at ? t.stats.resolved_at : null;
      if (!ra) return false;
      var rd = ra.split('T')[0];
      return rd >= from && rd <= to;
    });
    allTickets = allTickets.concat(filtered);
    if (tickets.length === 100) {
      setStatus('<span class="spinner"></span> Caricamento... (' + allTickets.length + ' trovati)', '');
      fetchAllTickets(from, to, page + 1);
    } else {
      isLoading = false;
      var btn = document.getElementById('btnLoad');
      if (btn) btn.disabled = false;
      renderTable();
    }
  })
  .catch(function(err) {
    isLoading = false;
    var btn = document.getElementById('btnLoad');
    if (btn) btn.disabled = false;
    setStatus('Errore: ' + err.message, 'error');
  });
}

// ── RENDER PRINCIPALE ────────────────────────────────────────────
function renderTable() {
  var total = allTickets.length;
  setStatus(total + ' ticket chiusi trovati.', 'ok');

  if (total === 0) {
    document.getElementById('reportTable').innerHTML =
      '<div class="empty">Nessun ticket trovato nel periodo selezionato.</div>';
    return;
  }

  var grouped = {};

  if (currentTab === 'agente') {
    allTickets.forEach(function(t) {
      var key = t.responder_id
        ? (agentsMap[t.responder_id] || 'Agente #' + t.responder_id)
        : 'Non assegnato';
      grouped[key] = (grouped[key] || 0) + 1;
    });
    renderGroupedTable(grouped, 'Agente');

  } else if (currentTab === 'cliente') {
    allTickets.forEach(function(t) {
      var key = 'Non assegnato';
      if (t.company_id && companiesMap[t.company_id]) {
        key = companiesMap[t.company_id];
      } else if (t.requester && t.requester.company_name) {
        key = t.requester.company_name;
      } else if (t.requester && t.requester.name) {
        key = t.requester.name;
      }
      grouped[key] = (grouped[key] || 0) + 1;
    });
    renderGroupedTable(grouped, 'Cliente');

  } else if (currentTab === 'categoria') {
    allTickets.forEach(function(t) {
      var cf     = t.custom_fields || {};
      var cat    = cf.cf_categoria || 'Non categorizzato';
      var subcat = cf.cf_tipo      || 'Nessuna';
      if (!grouped[cat]) grouped[cat] = { _total: 0 };
      grouped[cat]._total++;
      grouped[cat][subcat] = (grouped[cat][subcat] || 0) + 1;
    });
    renderCategoriaTable(grouped);
  }
}

// ── TABELLA SEMPLICE (agente / cliente) ──────────────────────────
function renderGroupedTable(grouped, colName) {
  var rows = Object.keys(grouped).map(function(k) {
    return { name: k, count: grouped[k] };
  }).sort(function(a, b) { return b.count - a.count; });

  var chartHtml = '<div class="card" style="margin-bottom:14px;">' +
    '<h2>Grafico</h2>' +
    '<div style="position:relative;height:260px;">' +
      '<canvas id="barChart"></canvas>' +
    '</div></div>';

  var tableHtml = '<table class="report-table"><thead><tr>' +
    '<th>' + colName + '</th><th>Ticket chiusi</th>' +
    '</tr></thead><tbody>';

  rows.forEach(function(r) {
    var isNA       = (r.name === 'Non assegnato' || r.name === 'Sconosciuto');
    var rowStyle   = isNA ? ' style="opacity:0.45;font-style:italic;"' : '';
    var badgeStyle = isNA ? ' style="background:#555;"' : '';
    tableHtml += '<tr' + rowStyle + '><td>' + escHtml(r.name) + '</td>' +
      '<td><span class="badge"' + badgeStyle + '>' + r.count + '</span></td></tr>';
  });
  tableHtml += '</tbody></table>';

  document.getElementById('reportTable').innerHTML = chartHtml + tableHtml;

  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  chartInstance = new Chart(document.getElementById('barChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: rows.map(function(r) { return r.name; }),
      datasets: [{
        label: 'Ticket chiusi',
        data:   rows.map(function(r) { return r.count; }),
        backgroundColor: rows.map(function(r) {
          return (r.name === 'Non assegnato' || r.name === 'Sconosciuto')
            ? 'rgba(100,100,100,0.5)' : 'rgba(230,57,70,0.75)';
        }),
        borderColor: rows.map(function(r) {
          return (r.name === 'Non assegnato' || r.name === 'Sconosciuto')
            ? '#666' : '#e63946';
        }),
        borderWidth: 1,
        borderRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#aaa', font: { size: 11 } }, grid: { color: '#1e1e1e' } },
        y: { beginAtZero: true, ticks: { color: '#aaa', stepSize: 1, font: { size: 11 } }, grid: { color: '#2a2a2a' } }
      }
    }
  });
}

// ── TABELLA GERARCHICA + GRAFICO ORIZZONTALE (categoria) ─────────
function renderCategoriaTable(grouped) {
  var chartLabels = [];
  var chartData   = [];

  var cats = Object.keys(grouped).sort(function(a, b) {
    return grouped[b]._total - grouped[a]._total;
  });

  var tableHtml = '<table class="report-table"><thead><tr>' +
    '<th>Categoria / Tipo</th><th>Ticket chiusi</th>' +
    '</tr></thead><tbody>';

  cats.forEach(function(cat) {
    var catObj = grouped[cat];
    tableHtml += '<tr style="background:#1e1e1e;"><td><strong>' +
      escHtml(cat) + '</strong></td>' +
      '<td><span class="badge">' + catObj._total + '</span></td></tr>';

    var subs = Object.keys(catObj).filter(function(k) { return k !== '_total'; });
    subs.sort(function(a, b) { return catObj[b] - catObj[a]; });

    subs.forEach(function(sub) {
      tableHtml += '<tr><td style="padding-left:28px;color:#aaa;">&#8627; ' +
        escHtml(sub) + '</td>' +
        '<td><span class="badge badge-sub">' + catObj[sub] + '</span></td></tr>';
      if (!(cat === 'Non categorizzato' && sub === 'Nessuna')) {
        chartLabels.push(cat + ' - ' + sub);
        chartData.push(catObj[sub]);
      }
    });
  });
  tableHtml += '</tbody></table>';

  var chartHeight = Math.max(260, chartLabels.length * 34);
  var chartHtml = '<div class="card" style="margin-bottom:14px;">' +
    '<h2>Grafico Categoria - Tipo</h2>' +
    '<div style="position:relative;height:' + chartHeight + 'px;">' +
      '<canvas id="barChart"></canvas>' +
    '</div></div>';

  document.getElementById('reportTable').innerHTML = chartHtml + tableHtml;

  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  chartInstance = new Chart(document.getElementById('barChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: chartLabels,
      datasets: [{
        label: 'Ticket chiusi',
        data:  chartData,
        backgroundColor: 'rgba(230,57,70,0.75)',
        borderColor:     '#e63946',
        borderWidth: 1,
        borderRadius: 5
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { color: '#aaa', stepSize: 1, font: { size: 11 } }, grid: { color: '#2a2a2a' } },
        y: { ticks: { color: '#ddd', font: { size: 11 } }, grid: { color: '#1e1e1e' } }
      }
    }
  });
}

// ── UTILITY ─────────────────────────────────────────────────────
function setStatus(msg, type) {
  var el = document.getElementById('statusBar');
  if (!el) return;
  el.innerHTML = msg;
  el.className = 'status-bar' + (type ? ' ' + type : '');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
