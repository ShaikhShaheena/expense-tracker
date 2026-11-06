// ===== 1. CATEGORIES =====
const categories = {
  expense: { Food: '🍔', Rent: '🏠', Transport: '🚗', Shopping: '🛍️', Bills: '💡', Health: '💊', Fun: '🎉', Other: '📦' },
  income:  { Salary: '💼', Freelance: '💻', Gift: '🎁', Other: '💰' }
};
const colors = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#ec4899', '#8b5cf6', '#64748b'];

// ===== 2. HELPERS =====
const $ = id => document.getElementById(id);
const aed = n => 'AED ' + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

// Sample data on first visit, so the page doesn't look empty
let transactions = load('transactions', [
  { id: 1, desc: 'Monthly salary', amount: 12000, type: 'income', category: 'Salary', date: today() },
  { id: 2, desc: 'Apartment rent', amount: 4500, type: 'expense', category: 'Rent', date: today() },
  { id: 3, desc: 'Groceries', amount: 650, type: 'expense', category: 'Food', date: today() },
  { id: 4, desc: 'Metro card', amount: 200, type: 'expense', category: 'Transport', date: today() },
  { id: 5, desc: 'Electricity bill', amount: 380, type: 'expense', category: 'Bills', date: today() }
]);
let filter = 'all';
let chart;

// ===== 3. FILL CATEGORY DROPDOWN (changes with Expense/Income) =====
function fillCategories() {
  const type = document.querySelector('input[name="type"]:checked').value;
  $('category').innerHTML = Object.entries(categories[type])
    .map(([name, icon]) => `<option value="${name}">${icon} ${name}</option>`).join('');
}
document.querySelectorAll('input[name="type"]').forEach(r => r.addEventListener('change', fillCategories));

// ===== 4. SUMMARY CARDS (animated numbers) =====
function updateCards() {
  const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  countUp('balance', income - expense);
  countUp('income', income);
  countUp('expense', expense);
}

function countUp(id, target) {
  const el = $(id);
  const start = Number(el.dataset.value || 0);
  const t0 = performance.now();
  const step = now => {
    const k = Math.min((now - t0) / 600, 1);
    el.textContent = aed(Math.round(start + (target - start) * k));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  el.dataset.value = target;
}

// ===== 5. CHART (Chart.js doughnut) =====
function updateChart() {
  const totals = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });
  const labels = Object.keys(totals);
  $('noChart').style.display = labels.length ? 'none' : 'block';
  $('chart').style.display = labels.length ? 'block' : 'none';

  const textColor = getComputedStyle(document.body).getPropertyValue('--text');
  const data = {
    labels: labels.map(l => `${categories.expense[l]} ${l}`),
    datasets: [{ data: Object.values(totals), backgroundColor: colors, borderWidth: 0, hoverOffset: 12 }]
  };

  if (chart) {
    chart.data = data;
    chart.options.plugins.legend.labels.color = textColor;
    chart.update();
    return;
  }
  chart = new Chart($('chart'), {
    type: 'doughnut',
    data,
    options: {
      cutout: '65%',
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: textColor, usePointStyle: true, padding: 15 } },
        tooltip: { callbacks: { label: ctx => ` ${aed(ctx.raw)}` } }
      }
    }
  });
}

// ===== 6. HISTORY LIST =====
function updateList() {
  const items = transactions
    .filter(t => filter === 'all' || t.type === filter)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  if (!items.length) {
    $('list').innerHTML = '<p class="empty">No transactions yet</p>';
    return;
  }
  $('list').innerHTML = items.map(t => `
    <li class="${t.type === 'income' ? 'plus' : ''}">
      <span class="cat-icon">${categories[t.type][t.category]}</span>
      <div class="item-info">
        <b>${t.desc}</b><br>
        <small>${t.category} · ${new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</small>
      </div>
      <span class="item-amount">${t.type === 'income' ? '+' : '−'} ${aed(t.amount)}</span>
      <button class="delete" data-id="${t.id}" title="Delete">🗑</button>
    </li>`).join('');
}

// ===== 7. UPDATE EVERYTHING + SAVE =====
function refresh() {
  save('transactions', transactions);
  updateCards();
  updateChart();
  updateList();
}

// ===== 8. ADD TRANSACTION =====
$('form').addEventListener('submit', e => {
  e.preventDefault();
  transactions.push({
    id: Date.now(),
    desc: $('desc').value.trim(),
    amount: Number($('amount').value),
    type: document.querySelector('input[name="type"]:checked').value,
    category: $('category').value,
    date: $('date').value
  });
  $('desc').value = '';
  $('amount').value = '';
  toast('✅ Transaction added');
  refresh();
});

// ===== 9. DELETE =====
$('list').addEventListener('click', e => {
  if (!e.target.classList.contains('delete')) return;
  const id = Number(e.target.dataset.id);
  transactions = transactions.filter(t => t.id !== id);
  toast('🗑 Transaction deleted');
  refresh();
});

// ===== 10. FILTER BUTTONS =====
document.querySelectorAll('.filters button').forEach(btn => {
  btn.addEventListener('click', () => {
    filter = btn.dataset.filter;
    document.querySelector('.filters .active').classList.remove('active');
    btn.classList.add('active');
    updateList();
  });
});

// ===== 11. EXPORT CSV (opens in Excel) =====
$('exportBtn').addEventListener('click', () => {
  if (!transactions.length) return toast('Nothing to export');
  const rows = [['Date', 'Description', 'Type', 'Category', 'Amount (AED)'],
    ...transactions.map(t => [t.date, `"${t.desc}"`, t.type, t.category, t.amount])];
  const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'expenses.csv';
  link.click();
  toast('⬇ CSV downloaded');
});

// ===== 12. CLEAR ALL =====
$('clearBtn').addEventListener('click', () => {
  if (!transactions.length) return;
  transactions = [];
  toast('All transactions cleared');
  refresh();
});

// ===== 13. DARK MODE (remembered) =====
const root = document.documentElement;
root.dataset.theme = load('theme', 'light');
$('themeBtn').textContent = root.dataset.theme === 'dark' ? '☀️' : '🌙';
$('themeBtn').addEventListener('click', () => {
  const dark = root.dataset.theme !== 'dark';
  root.dataset.theme = dark ? 'dark' : 'light';
  $('themeBtn').textContent = dark ? '☀️' : '🌙';
  save('theme', root.dataset.theme);
  updateChart(); // update legend text colour
});

// ===== 14. TOAST MESSAGE =====
let toastTimer;
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2000);
}

// ===== START =====
$('date').value = today();
fillCategories();
refresh();