/* ═══════════════════════════════════════════════════════════
   Personal Finance Parser — app.js
   All processing is client-side; no data leaves the browser.
   ═══════════════════════════════════════════════════════════ */

// ── Category definitions ──────────────────────────────────
const CATEGORIES = [
  {
    key: 'income',
    label: 'Income',
    icon: '💵',
    color: '#34d399',
    keywords: [
      'payroll','salary','direct deposit','payment received','transfer in',
      'zelle from','venmo','paycheck','wages','deposit'
    ]
  },
  {
    key: 'groceries',
    label: 'Groceries',
    icon: '🛒',
    color: '#60a5fa',
    keywords: [
      'walmart','kroger','safeway','whole foods','trader joe','aldi','publix',
      'costco','target','food lion','giant','meijer','sprouts','fresh market',
      'market basket','heb','stop & shop','winco','weis','winn dixie','supermarket',
      'grocery','market','lidl','hy-vee'
    ]
  },
  {
    key: 'dining',
    label: 'Dining & Food',
    icon: '🍽',
    color: '#f97316',
    keywords: [
      'restaurant','cafe','coffee','mcdonald','starbucks','subway','chipotle',
      'domino','pizza','taco bell','wendy','burger king','chick-fil','dunkin',
      'panera','doordash','uber eats','grubhub','instacart','deliveroo','sushi',
      'thai','chinese','italian','diner','grill','bbq','eatery','bistro','bakery',
      'deli','steakhouse','seafood','ramen','noodle','buffet','bar & grill'
    ]
  },
  {
    key: 'transport',
    label: 'Transport',
    icon: '🚗',
    color: '#a78bfa',
    keywords: [
      'uber','lyft','taxi','gas station','shell','bp','exxon','chevron','mobil',
      'speedway','circle k','wawa','marathon','sunoco','76 gas','parking','toll',
      'metro','transit','bus','train','amtrak','southwest','delta','american air',
      'united air','jetblue','flight','airline','auto','car wash','zipcar'
    ]
  },
  {
    key: 'utilities',
    label: 'Utilities',
    icon: '💡',
    color: '#fbbf24',
    keywords: [
      'electric','water bill','gas bill','internet','comcast','xfinity','at&t',
      'verizon','t-mobile','sprint','spectrum','cox','frontier','centurylink',
      'hulu','netflix','disney','spotify','apple music','youtube premium',
      'utility','sewage','trash','waste management','pge','con ed','duke energy'
    ]
  },
  {
    key: 'healthcare',
    label: 'Healthcare',
    icon: '🏥',
    color: '#f43f5e',
    keywords: [
      'cvs','walgreens','rite aid','pharmacy','medical','hospital','clinic',
      'doctor','dentist','vision','optometrist','health','insurance','urgent care',
      'labcorp','quest diagnostics','prescription','rx','therapy','chiropractor'
    ]
  },
  {
    key: 'shopping',
    label: 'Shopping',
    icon: '🛍',
    color: '#ec4899',
    keywords: [
      'amazon','ebay','etsy','best buy','home depot','lowes','ikea','wayfair',
      'macy','nordstrom','gap','old navy','h&m','zara','nike','adidas','apple store',
      'microsoft','gamestop','hobby lobby','bed bath','tj maxx','marshalls',
      'ross','dollar tree','dollar general','five below','overstock','newegg'
    ]
  },
  {
    key: 'entertainment',
    label: 'Entertainment',
    icon: '🎬',
    color: '#06b6d4',
    keywords: [
      'movie','cinema','theater','amc','regal','netflix','hulu','hbo','twitch',
      'steam','playstation','xbox','nintendo','concert','ticketmaster','eventbrite',
      'bowling','arcade','golf','gym','planet fitness','la fitness','anytime fitness',
      'spotify','pandora','audible','kindle','museum','zoo','aquarium','escape room'
    ]
  },
  {
    key: 'housing',
    label: 'Housing',
    icon: '🏠',
    color: '#84cc16',
    keywords: [
      'rent','mortgage','hoa','lease','landlord','property','airbnb','vrbo',
      'hotel','motel','inn','hilton','marriott','holiday inn','repair','maintenance',
      'plumber','electrician','home insurance','renters insurance','pest control'
    ]
  },
  {
    key: 'finance',
    label: 'Finance & Fees',
    icon: '🏦',
    color: '#64748b',
    keywords: [
      'fee','interest','charge','atm fee','overdraft','monthly service',
      'transfer fee','wire transfer','tax','irs','loan','mortgage payment',
      'credit card payment','minimum payment','finance charge'
    ]
  },
  {
    key: 'other',
    label: 'Other',
    icon: '📦',
    color: '#94a3b8',
    keywords: []
  }
];

// ── Helpers ───────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const fmtDate = s => {
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const monthKey = s => {
  const d = new Date(s);
  return isNaN(d) ? s : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
};
const monthLabel = key => {
  const [y, m] = key.split('-');
  return new Date(+y, +m-1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

function categorize(description) {
  const desc = description.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.key === 'other') continue;
    if (cat.keywords.some(k => desc.includes(k))) return cat.key;
  }
  return 'other';
}

function getCat(key) {
  return CATEGORIES.find(c => c.key === key) || CATEGORIES[CATEGORIES.length-1];
}

// ── State ─────────────────────────────────────────────────
let allTx = [];
let filteredTx = [];
let currentPage = 1;
const PAGE_SIZE = 25;
let sortCol = 'date';
let sortDir = -1; // -1 desc, 1 asc

let chartCategory = null;
let chartMonthly = null;
let chartDaily = null;

// ── CSV Parsing ───────────────────────────────────────────
function detectColumns(headers) {
  const h = headers.map(s => s.toLowerCase().trim().replace(/['"]/g, ''));
  const idx = {};

  // Date
  idx.date = h.findIndex(s => s.includes('date'));
  // Description
  idx.description = h.findIndex(s =>
    s.includes('description') || s.includes('memo') ||
    s.includes('payee') || s.includes('name') || s.includes('merchant') || s === 'details'
  );
  // Amount — prefer 'amount', fall back to debit/credit
  idx.amount = h.findIndex(s => s === 'amount' || s === 'transaction amount');
  idx.debit  = h.findIndex(s => s.includes('debit') || s.includes('withdrawal'));
  idx.credit = h.findIndex(s => s.includes('credit') || s.includes('deposit'));
  // Category (optional)
  idx.category = h.findIndex(s => s === 'category' || s === 'type');

  return idx;
}

function parseAmount(raw) {
  if (!raw) return null;
  const cleaned = raw.toString().replace(/[^0-9.\-+]/g, '');
  return cleaned === '' ? null : parseFloat(cleaned);
}

function parseCSV(text) {
  // Remove BOM if present
  text = text.replace(/^\uFEFF/, '');

  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV appears to be empty or has only one row.');

  // Simple CSV split respecting quoted fields
  const splitLine = line => {
    const cols = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    return cols;
  };

  const headers = splitLine(lines[0]);
  const idx = detectColumns(headers);

  if (idx.date === -1) throw new Error('Could not find a Date column. Make sure your CSV has a "Date" header.');
  if (idx.description === -1) throw new Error('Could not find a Description column.');
  if (idx.amount === -1 && idx.debit === -1 && idx.credit === -1)
    throw new Error('Could not find an Amount column.');

  const transactions = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.every(c => !c)) continue;

    const dateRaw = cols[idx.date] || '';
    const descRaw = (cols[idx.description] || '').replace(/^"|"$/g, '');

    let amount;
    if (idx.amount !== -1) {
      amount = parseAmount(cols[idx.amount]);
    } else {
      const debit  = parseAmount(cols[idx.debit]);
      const credit = parseAmount(cols[idx.credit]);
      if (debit != null)  amount = -Math.abs(debit);
      if (credit != null) amount = Math.abs(credit);
    }

    if (!dateRaw || amount == null || isNaN(amount)) continue;

    const suppliedCat = idx.category !== -1 ? (cols[idx.category] || '').toLowerCase().trim() : '';
    const catKey = suppliedCat && getCat(suppliedCat) ? suppliedCat : categorize(descRaw);

    transactions.push({
      date: dateRaw,
      description: descRaw,
      amount,
      category: catKey
    });
  }

  if (transactions.length === 0) throw new Error('No valid transactions found. Check your CSV format.');
  return transactions;
}

// ── Sample Data ───────────────────────────────────────────
function generateSampleData() {
  const entries = [
    ['2024-01-05', 'Payroll - Acme Corp', 3800],
    ['2024-01-06', 'Whole Foods Market', -89.43],
    ['2024-01-07', 'Starbucks', -6.75],
    ['2024-01-08', 'Netflix', -15.99],
    ['2024-01-09', 'Shell Gas Station', -52.10],
    ['2024-01-10', 'Amazon Purchase', -34.99],
    ['2024-01-11', 'CVS Pharmacy', -22.50],
    ['2024-01-13', 'Chipotle Mexican Grill', -13.25],
    ['2024-01-14', 'Walmart Supercenter', -103.67],
    ['2024-01-15', 'AT&T Wireless', -85.00],
    ['2024-01-18', 'Uber Ride', -18.40],
    ['2024-01-20', 'Planet Fitness', -24.99],
    ['2024-01-21', 'Dominos Pizza', -28.99],
    ['2024-01-22', 'AMC Theaters', -32.50],
    ['2024-01-25', 'Rent Payment', -1450.00],
    ['2024-01-26', 'Comcast Internet', -79.99],
    ['2024-01-28', 'Target', -56.78],
    ['2024-01-30', 'Spotify Premium', -9.99],
    ['2024-02-01', 'Payroll - Acme Corp', 3800],
    ['2024-02-02', 'Kroger Grocery', -74.21],
    ['2024-02-03', 'McDonald\'s', -8.47],
    ['2024-02-05', 'Exxon Mobil', -48.30],
    ['2024-02-07', 'Best Buy', -149.99],
    ['2024-02-09', 'DoorDash Order', -31.60],
    ['2024-02-10', 'Walgreens Pharmacy', -17.85],
    ['2024-02-12', 'Lyft Ride', -22.15],
    ['2024-02-14', 'Applebee\'s Restaurant', -45.00],
    ['2024-02-15', 'Rent Payment', -1450.00],
    ['2024-02-17', 'Verizon Wireless', -90.00],
    ['2024-02-18', 'Trader Joe\'s', -67.43],
    ['2024-02-20', 'IKEA', -213.00],
    ['2024-02-22', 'Hulu Subscription', -17.99],
    ['2024-02-24', 'Uber Eats', -24.99],
    ['2024-02-26', 'Steam Game Purchase', -59.99],
    ['2024-02-28', 'Bank Service Fee', -12.00],
    ['2024-03-01', 'Payroll - Acme Corp', 3800],
    ['2024-03-03', 'Publix Supermarket', -91.55],
    ['2024-03-05', 'Panera Bread', -14.75],
    ['2024-03-07', 'BP Gas Station', -55.90],
    ['2024-03-09', 'Amazon Prime', -14.99],
    ['2024-03-11', 'Dentist Office', -120.00],
    ['2024-03-12', 'Chipotle', -12.80],
    ['2024-03-14', 'Costco Wholesale', -187.33],
    ['2024-03-15', 'Rent Payment', -1450.00],
    ['2024-03-17', 'Comcast Internet', -79.99],
    ['2024-03-19', 'Uber', -14.50],
    ['2024-03-21', 'Apple Store', -199.00],
    ['2024-03-23', 'Regal Cinema', -27.50],
    ['2024-03-25', 'Nordstrom', -88.00],
    ['2024-03-27', 'Spotify', -9.99],
    ['2024-03-29', 'Starbucks', -7.25],
    ['2024-03-30', 'Electric Bill - Duke Energy', -95.40]
  ];

  return entries.map(([date, description, amount]) => ({
    date, description, amount,
    category: amount > 0 ? 'income' : categorize(description)
  }));
}

// ── Initialize app after data is loaded ──────────────────
function loadData(transactions) {
  allTx = transactions;
  filteredTx = [...allTx];
  currentPage = 1;

  buildFilters();
  updateStats();
  buildCharts();
  renderTable();
  buildCategoryCards();
  enableTabs();
  switchTab('overview');
}

function enableTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.disabled = false);
}

// ── Stats ─────────────────────────────────────────────────
function updateStats() {
  const tx = filteredTx;
  const income   = tx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expenses = tx.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  $('totalIncome').textContent   = fmt(income);
  $('totalExpenses').textContent = fmt(Math.abs(expenses));
  const net = income + expenses;
  const netEl = $('netBalance');
  netEl.textContent = fmt(net);
  netEl.style.color = net >= 0 ? 'var(--green)' : 'var(--red)';
  $('txCount').textContent = tx.length;
}

// ── Charts ────────────────────────────────────────────────
const CHART_DEFAULTS = {
  color: '#e2e8f0',
  font: { family: "'Segoe UI', system-ui, sans-serif", size: 12 }
};

function buildCharts() {
  buildCategoryChart();
  buildMonthlyChart();
  buildDailyChart();
}

function buildCategoryChart() {
  const expenses = filteredTx.filter(t => t.amount < 0);
  const byCategory = {};
  expenses.forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + Math.abs(t.amount);
  });

  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([k]) => {
    const cat = getCat(k);
    return `${cat.icon} ${cat.label}`;
  });
  const data   = sorted.map(([, v]) => +v.toFixed(2));
  const colors = sorted.map(([k]) => getCat(k).color);

  if (chartCategory) chartCategory.destroy();
  chartCategory = new Chart($('categoryChart'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#181c27', borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#e2e8f0', font: CHART_DEFAULTS.font, padding: 12, boxWidth: 14 } },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)}` }
        }
      }
    }
  });
}

function buildMonthlyChart() {
  const expenses = filteredTx.filter(t => t.amount < 0);
  const byMonth = {};
  expenses.forEach(t => {
    const mk = monthKey(t.date);
    byMonth[mk] = (byMonth[mk] || 0) + Math.abs(t.amount);
  });

  const keys   = Object.keys(byMonth).sort();
  const labels = keys.map(monthLabel);
  const data   = keys.map(k => +byMonth[k].toFixed(2));

  if (chartMonthly) chartMonthly.destroy();
  chartMonthly = new Chart($('monthlyChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Expenses',
        data,
        backgroundColor: 'rgba(79,142,247,.7)',
        borderColor: '#4f8ef7',
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed.y)}` } }
      },
      scales: {
        x: { ticks: { color: '#8b95a8' }, grid: { color: '#2a3044' } },
        y: { ticks: { color: '#8b95a8', callback: v => '$'+v }, grid: { color: '#2a3044' } }
      }
    }
  });
}

function buildDailyChart() {
  const expenses = filteredTx.filter(t => t.amount < 0);
  const byDay = {};
  expenses.forEach(t => { byDay[t.date] = (byDay[t.date] || 0) + Math.abs(t.amount); });

  const days  = Object.keys(byDay).sort();
  const data  = days.map(d => +byDay[d].toFixed(2));

  if (chartDaily) chartDaily.destroy();
  chartDaily = new Chart($('dailyChart'), {
    type: 'line',
    data: {
      labels: days.map(d => fmtDate(d)),
      datasets: [{
        label: 'Spending',
        data,
        borderColor: '#7c5ef7',
        backgroundColor: 'rgba(124,94,247,.12)',
        fill: true,
        tension: .35,
        pointRadius: days.length > 60 ? 0 : 3,
        pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed.y)}` } }
      },
      scales: {
        x: { ticks: { color: '#8b95a8', maxTicksLimit: 12 }, grid: { color: '#2a3044' } },
        y: { ticks: { color: '#8b95a8', callback: v => '$'+v }, grid: { color: '#2a3044' } }
      }
    }
  });
}

// ── Filters ───────────────────────────────────────────────
function buildFilters() {
  // Categories
  const catSel = $('categoryFilter');
  catSel.innerHTML = '<option value="">All Categories</option>';
  const usedCats = [...new Set(allTx.map(t => t.category))];
  usedCats.sort().forEach(k => {
    const cat = getCat(k);
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = `${cat.icon} ${cat.label}`;
    catSel.appendChild(opt);
  });

  // Months
  const monSel = $('monthFilter');
  monSel.innerHTML = '<option value="">All Months</option>';
  const months = [...new Set(allTx.map(t => monthKey(t.date)))].sort();
  months.forEach(mk => {
    const opt = document.createElement('option');
    opt.value = mk;
    opt.textContent = monthLabel(mk);
    monSel.appendChild(opt);
  });
}

function applyFilters() {
  const search = $('searchInput').value.toLowerCase();
  const cat    = $('categoryFilter').value;
  const mon    = $('monthFilter').value;

  filteredTx = allTx.filter(t => {
    if (search && !t.description.toLowerCase().includes(search)) return false;
    if (cat && t.category !== cat) return false;
    if (mon && monthKey(t.date) !== mon) return false;
    return true;
  });

  currentPage = 1;
  renderTable();
}

// ── Table ─────────────────────────────────────────────────
function sortTx() {
  filteredTx.sort((a, b) => {
    let va = a[sortCol], vb = b[sortCol];
    if (sortCol === 'amount') { va = +va; vb = +vb; }
    if (va < vb) return -1 * sortDir;
    if (va > vb) return  1 * sortDir;
    return 0;
  });
}

function renderTable() {
  sortTx();
  const start = (currentPage - 1) * PAGE_SIZE;
  const page  = filteredTx.slice(start, start + PAGE_SIZE);

  const tbody = $('txBody');
  tbody.innerHTML = '';

  if (page.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:32px">No transactions match your filters.</td></tr>';
    $('pagination').innerHTML = '';
    return;
  }

  page.forEach(t => {
    const cat = getCat(t.category);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(t.date)}</td>
      <td>${escHtml(t.description)}</td>
      <td><span class="badge" style="background:${cat.color}22;color:${cat.color}">${cat.icon} ${cat.label}</span></td>
      <td class="right ${t.amount >= 0 ? 'amount-pos' : 'amount-neg'}">${fmt(t.amount)}</td>
    `;
    tbody.appendChild(tr);
  });

  renderPagination();
}

function renderPagination() {
  const total = Math.ceil(filteredTx.length / PAGE_SIZE);
  const pag = $('pagination');
  pag.innerHTML = '';
  if (total <= 1) return;

  const addBtn = (label, page, active, disabled) => {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (active ? ' active' : '');
    btn.textContent = label;
    btn.disabled = disabled;
    btn.addEventListener('click', () => { currentPage = page; renderTable(); });
    pag.appendChild(btn);
  };

  addBtn('«', 1, false, currentPage === 1);
  addBtn('‹', currentPage - 1, false, currentPage === 1);

  const start = Math.max(1, currentPage - 2);
  const end   = Math.min(total, start + 4);
  for (let p = start; p <= end; p++) addBtn(p, p, p === currentPage, false);

  addBtn('›', currentPage + 1, false, currentPage === total);
  addBtn('»', total, false, currentPage === total);
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Category Cards ────────────────────────────────────────
function buildCategoryCards() {
  const expenses = allTx.filter(t => t.amount < 0);
  const byCategory = {};
  expenses.forEach(t => {
    if (!byCategory[t.category]) byCategory[t.category] = { total: 0, count: 0 };
    byCategory[t.category].total += Math.abs(t.amount);
    byCategory[t.category].count++;
  });

  const maxTotal = Math.max(...Object.values(byCategory).map(v => v.total));
  const sorted = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total);

  const grid = $('categoryCards');
  grid.innerHTML = '';

  sorted.forEach(([key, { total, count }]) => {
    const cat = getCat(key);
    const pct = maxTotal > 0 ? (total / maxTotal * 100).toFixed(1) : 0;

    const card = document.createElement('div');
    card.className = 'cat-card';
    card.innerHTML = `
      <div class="cat-card-bar" style="background:${cat.color}"></div>
      <div class="cat-header">
        <span class="cat-icon">${cat.icon}</span>
        <span class="cat-name" contenteditable="true" data-key="${key}">${cat.label}</span>
      </div>
      <div class="cat-amount" style="color:${cat.color}">${fmt(total)}</div>
      <div class="cat-count">${count} transaction${count !== 1 ? 's' : ''}</div>
      <div class="cat-bar-bg">
        <div class="cat-bar-fill" style="width:${pct}%;background:${cat.color}"></div>
      </div>
    `;

    // Editable category name
    const nameEl = card.querySelector('.cat-name');
    nameEl.addEventListener('blur', () => {
      const newLabel = nameEl.textContent.trim();
      if (newLabel) {
        const catDef = CATEGORIES.find(c => c.key === key);
        if (catDef) catDef.label = newLabel;
        // Re-render badge in table if it's visible
        renderTable();
        buildCategoryCards();
      }
    });
    nameEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
    });

    grid.appendChild(card);
  });
}

// ── Export ────────────────────────────────────────────────
function exportCSV() {
  const rows = [['Date','Description','Category','Amount']];
  filteredTx.forEach(t => {
    const cat = getCat(t.category);
    rows.push([t.date, `"${t.description}"`, cat.label, t.amount]);
  });
  const csv  = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'transactions_export.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Tab switching ─────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  document.querySelectorAll('.tab-content').forEach(sec => {
    sec.classList.toggle('active', sec.id === `tab-${name}`);
  });
}

// ── Event listeners ───────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!btn.disabled) switchTab(btn.dataset.tab);
  });
});

// Sort headers
document.querySelectorAll('thead th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    if (sortCol === th.dataset.sort) {
      sortDir *= -1;
    } else {
      sortCol = th.dataset.sort;
      sortDir = -1;
    }
    currentPage = 1;
    renderTable();
  });
});

// Filters
$('searchInput').addEventListener('input', applyFilters);
$('categoryFilter').addEventListener('change', applyFilters);
$('monthFilter').addEventListener('change', applyFilters);

// Export
$('exportCsv').addEventListener('click', exportCSV);

// File input
$('fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

// Drag & drop
const dz = $('dropZone');
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
dz.addEventListener('drop', e => {
  e.preventDefault();
  dz.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});
dz.addEventListener('click', () => $('fileInput').click());

// Sample data
$('loadSample').addEventListener('click', e => {
  e.preventDefault();
  loadData(generateSampleData());
});

function handleFile(file) {
  if (!file.name.endsWith('.csv')) {
    showError('Please upload a .csv file.');
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const tx = parseCSV(ev.target.result);
      hideError();
      loadData(tx);
    } catch (err) {
      showError(err.message);
    }
  };
  reader.readAsText(file);
}

function showError(msg) {
  const el = $('parseError');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideError() {
  $('parseError').classList.add('hidden');
}
