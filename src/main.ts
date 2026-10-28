/**
 * Apple-Style Expense Tracker — Vanilla JavaScript / TypeScript
 * Implements persistent localStorage data storage, reactive UI updates,
 * distinct tab views (Overview, Add Expense, Expense History),
 * fixed dollar prefix formatting, and RFC 4180 CSV export.
 */

import './index.css';

interface Expense {
  id: string;
  name: string;
  amount: number;
  category: 'Food' | 'Transport' | 'Utilities' | 'Others';
  date: string;
  createdAt: number;
}

type ViewName = 'overview' | 'add-expense' | 'expense-history';

const STORAGE_KEY = 'apple_expense_tracker_data';

// Initial sample records so user sees realistic data
const INITIAL_SAMPLES: Expense[] = [
  {
    id: 'exp-1',
    name: 'Whole Foods Market',
    amount: 68.45,
    category: 'Food',
    date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'exp-2',
    name: 'Metro Rail Monthly Pass',
    amount: 45.00,
    category: 'Transport',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'exp-3',
    name: 'Clean Power & Electric Co.',
    amount: 112.30,
    category: 'Utilities',
    date: new Date().toISOString().split('T')[0],
    createdAt: Date.now(),
  },
  {
    id: 'exp-4',
    name: 'Books & Workspace Supplies',
    amount: 29.99,
    category: 'Others',
    date: new Date().toISOString().split('T')[0],
    createdAt: Date.now(),
  },
];

// State
let expenses: Expense[] = [];
let activeCategoryFilter: string = 'All';
let currentView: ViewName = 'overview';
let newlyCreatedId: string | null = null;

// DOM Elements: Form
const form = document.getElementById('expense-form') as HTMLFormElement;
const itemNameInput = document.getElementById('item-name') as HTMLInputElement;
const amountInput = document.getElementById('amount') as HTMLInputElement;
const categorySelect = document.getElementById('category') as HTMLSelectElement;
const dateInput = document.getElementById('expense-date') as HTMLInputElement;

// DOM Elements: Views
const viewOverview = document.getElementById('view-overview') as HTMLElement;
const viewAddExpense = document.getElementById('view-add-expense') as HTMLElement;
const viewExpenseHistory = document.getElementById('view-expense-history') as HTMLElement;

// DOM Elements: Metrics
const totalSpentEl = document.getElementById('total-spent') as HTMLElement;
const expenseCountLabel = document.getElementById('expense-count-label') as HTMLElement;
const historyBadgeCount = document.getElementById('history-badge-count') as HTMLElement;

// DOM Elements: Category Breakdown
const barFood = document.getElementById('bar-food') as HTMLElement;
const barTransport = document.getElementById('bar-transport') as HTMLElement;
const barUtilities = document.getElementById('bar-utilities') as HTMLElement;
const barOthers = document.getElementById('bar-others') as HTMLElement;

const statFood = document.getElementById('stat-food') as HTMLElement;
const statTransport = document.getElementById('stat-transport') as HTMLElement;
const statUtilities = document.getElementById('stat-utilities') as HTMLElement;
const statOthers = document.getElementById('stat-others') as HTMLElement;

const pctFood = document.getElementById('pct-food') as HTMLElement;
const pctTransport = document.getElementById('pct-transport') as HTMLElement;
const pctUtilities = document.getElementById('pct-utilities') as HTMLElement;
const pctOthers = document.getElementById('pct-others') as HTMLElement;

// DOM Elements: Table
const tableBody = document.getElementById('expense-table-body') as HTMLElement;
const filteredCountLabel = document.getElementById('filtered-count-label') as HTMLElement;

// DOM Elements: Actions & Modals
const downloadCsvBtn = document.getElementById('download-csv-btn') as HTMLButtonElement;
const headerDownloadBtn = document.getElementById('header-download-btn') as HTMLButtonElement;
const tableDownloadBtn = document.getElementById('table-download-btn') as HTMLButtonElement;
const clearAllBtn = document.getElementById('clear-all-btn') as HTMLButtonElement;
const clearModal = document.getElementById('clear-modal') as HTMLElement;
const cancelClearBtn = document.getElementById('cancel-clear-btn') as HTMLButtonElement;
const confirmClearBtn = document.getElementById('confirm-clear-btn') as HTMLButtonElement;
const addSampleBtn = document.getElementById('add-sample-btn') as HTMLButtonElement;
const toastContainer = document.getElementById('toast-container') as HTMLElement;

// Nav shortcut buttons
const overviewAddBtn = document.getElementById('overview-add-btn') as HTMLButtonElement;
const overviewViewHistoryBtn = document.getElementById('overview-view-history-btn') as HTMLButtonElement;
const formGoHistoryBtn = document.getElementById('form-go-history-btn') as HTMLButtonElement;

// DOM Elements: Error messages
const errorItemName = document.getElementById('error-item-name') as HTMLElement;
const errorAmount = document.getElementById('error-amount') as HTMLElement;
const errorCategory = document.getElementById('error-category') as HTMLElement;

/**
 * Storage helpers
 */
function loadExpenses(): Expense[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SAMPLES));
    return [...INITIAL_SAMPLES];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    // If empty array was saved, seed initial samples so user sees real data
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SAMPLES));
    return [...INITIAL_SAMPLES];
  } catch {
    return [...INITIAL_SAMPLES];
  }
}

function saveExpenses(data: Expense[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Currency formatting
 */
function formatCurrency(num: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Date formatting
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const [year, month, day] = dateStr.split('-');
    if (year && month && day) {
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

/**
 * Toast notifications
 */
function showToast(message: string, type: 'success' | 'info' | 'error' = 'success'): void {
  const toast = document.createElement('div');
  toast.className =
    'pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#1D1D1F] text-white text-xs font-medium shadow-xl transform transition-all duration-300 translate-y-2 opacity-0';

  let iconSvg = `
    <svg class="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>`;

  if (type === 'error') {
    iconSvg = `
      <svg class="w-4 h-4 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>`;
  } else if (type === 'info') {
    iconSvg = `
      <svg class="w-4 h-4 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>`;
  }

  toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3200);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Category badge with Apple squircle icon
 */
function getCategoryBadge(category: Expense['category']): string {
  switch (category) {
    case 'Food':
      return `
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
            </svg>
          </div>
          <span class="text-xs font-medium text-[#1D1D1F]">Food</span>
        </div>`;
    case 'Transport':
      return `
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-lg bg-sky-500/15 text-sky-600 flex items-center justify-center shrink-0">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4"></rect>
              <path d="M7 17h.01"></path>
              <path d="M17 17h.01"></path>
            </svg>
          </div>
          <span class="text-xs font-medium text-[#1D1D1F]">Transport</span>
        </div>`;
    case 'Utilities':
      return `
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-lg bg-purple-500/15 text-purple-600 flex items-center justify-center shrink-0">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
          <span class="text-xs font-medium text-[#1D1D1F]">Utilities</span>
        </div>`;
    case 'Others':
    default:
      return `
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-lg bg-slate-500/15 text-slate-600 flex items-center justify-center shrink-0">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            </svg>
          </div>
          <span class="text-xs font-medium text-[#1D1D1F]">Others</span>
        </div>`;
  }
}

/**
 * Recalculate summary metrics & category breakdown
 */
function updateSummary(): void {
  const total = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const formattedTotal = formatCurrency(total);

  totalSpentEl.textContent = formattedTotal;
  const countText = `${expenses.length} transaction${expenses.length === 1 ? '' : 's'}`;
  expenseCountLabel.textContent = countText;
  if (historyBadgeCount) {
    historyBadgeCount.textContent = countText;
  }

  const catTotals = {
    Food: 0,
    Transport: 0,
    Utilities: 0,
    Others: 0,
  };

  expenses.forEach((item) => {
    if (item.category in catTotals) {
      catTotals[item.category] += item.amount;
    } else {
      catTotals.Others += item.amount;
    }
  });

  statFood.textContent = formatCurrency(catTotals.Food);
  statTransport.textContent = formatCurrency(catTotals.Transport);
  statUtilities.textContent = formatCurrency(catTotals.Utilities);
  statOthers.textContent = formatCurrency(catTotals.Others);

  const pct = (val: number) => (total > 0 ? ((val / total) * 100).toFixed(0) : '0');

  pctFood.textContent = `${pct(catTotals.Food)}%`;
  pctTransport.textContent = `${pct(catTotals.Transport)}%`;
  pctUtilities.textContent = `${pct(catTotals.Utilities)}%`;
  pctOthers.textContent = `${pct(catTotals.Others)}%`;

  barFood.style.width = total > 0 ? `${(catTotals.Food / total) * 100}%` : '0%';
  barTransport.style.width = total > 0 ? `${(catTotals.Transport / total) * 100}%` : '0%';
  barUtilities.style.width = total > 0 ? `${(catTotals.Utilities / total) * 100}%` : '0%';
  barOthers.style.width = total > 0 ? `${(catTotals.Others / total) * 100}%` : '0%';
}

/**
 * Switch view and apply darker active overlay color to pressed tab
 */
function switchView(viewName: ViewName): void {
  currentView = viewName;

  // Toggle sections
  if (viewOverview) viewOverview.classList.toggle('hidden', viewName !== 'overview');
  if (viewAddExpense) viewAddExpense.classList.toggle('hidden', viewName !== 'add-expense');
  if (viewExpenseHistory) viewExpenseHistory.classList.toggle('hidden', viewName !== 'expense-history');

  // Update tabs: the pressed tab becomes active with dark overlay and permanent white text
  const tabButtons = document.querySelectorAll<HTMLButtonElement>('.nav-tab-btn');
  tabButtons.forEach((btn) => {
    const v = btn.dataset.view;
    if (v === viewName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Re-render data
  updateSummary();
  if (viewName === 'expense-history') {
    renderTable();
  } else if (viewName === 'add-expense') {
    itemNameInput.focus();
  }

  // Smoothly scroll to top of view
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Set active category filter in the table
 */
function setActiveCategory(category: string): void {
  activeCategoryFilter = category;
  const filterButtons = document.querySelectorAll<HTMLButtonElement>('.category-filter-btn');

  filterButtons.forEach((btn) => {
    const btnFilter = btn.dataset.filter || 'All';
    if (btnFilter.toLowerCase() === category.toLowerCase()) {
      btn.classList.add('bg-white', 'text-[#1D1D1F]', 'shadow-sm');
      btn.classList.remove('text-[#86868B]');
    } else {
      btn.classList.remove('bg-white', 'text-[#1D1D1F]', 'shadow-sm');
      btn.classList.add('text-[#86868B]');
    }
  });

  renderTable();
}

/**
 * Render the expense table
 */
function renderTable(): void {
  const filtered =
    activeCategoryFilter === 'All'
      ? expenses
      : expenses.filter((item) => item.category === activeCategoryFilter);

  filteredCountLabel.textContent = `Showing ${filtered.length} of ${expenses.length} record${expenses.length === 1 ? '' : 's'}`;

  if (filtered.length === 0) {
    if (expenses.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="py-14 text-center">
            <div class="w-12 h-12 mx-auto mb-2.5 rounded-2xl bg-[#F5F5F7] flex items-center justify-center text-[#86868B]">
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M7 15h0.01M12 15h0.01M17 15h0.01M7 11h0.01M12 11h0.01M17 11h0.01M7 7h0.01M12 7h0.01M17 7h0.01" />
              </svg>
            </div>
            <h3 class="text-sm font-semibold text-[#1D1D1F]">No Expenses in History</h3>
            <p class="text-xs text-[#86868B] max-w-xs mx-auto mt-1">You haven't logged any expenses yet.</p>
            <div class="mt-4 flex items-center justify-center gap-2">
              <button id="in-table-add-btn" type="button" class="apple-btn-primary text-xs py-2 px-3.5 cursor-pointer">
                + Add First Expense
              </button>
              <button id="in-table-load-sample" type="button" class="apple-btn-secondary text-xs py-2 px-3.5 cursor-pointer">
                Load Samples
              </button>
            </div>
          </td>
        </tr>
      `;
      const inTableAdd = document.getElementById('in-table-add-btn');
      if (inTableAdd) {
        inTableAdd.addEventListener('click', () => switchView('add-expense'));
      }
      const inTableLoadBtn = document.getElementById('in-table-load-sample');
      if (inTableLoadBtn) {
        inTableLoadBtn.addEventListener('click', () => addSampleBtn.click());
      }
    } else {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="py-12 text-center">
            <h3 class="text-sm font-semibold text-[#1D1D1F]">No ${activeCategoryFilter} Expenses</h3>
            <p class="text-xs text-[#86868B] max-w-xs mx-auto mt-1">You haven't logged any expenses under ${activeCategoryFilter} yet.</p>
            <button id="in-table-show-all" type="button" class="apple-btn-secondary text-xs mt-3.5 py-1.5 px-3.5 cursor-pointer">
              Show All Expenses
            </button>
          </td>
        </tr>
      `;
      const inTableShowAll = document.getElementById('in-table-show-all');
      if (inTableShowAll) {
        inTableShowAll.addEventListener('click', () => {
          setActiveCategory('All');
        });
      }
    }
    return;
  }

  // Sort newest first
  const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt);

  tableBody.innerHTML = sorted
    .map((item) => {
      const isNew = item.id === newlyCreatedId;
      return `
      <tr class="group transition-all duration-300 ${isNew ? 'bg-blue-50/70' : 'hover:bg-black/[0.015]'}" data-id="${item.id}">
        <td class="font-medium text-[#1D1D1F] max-w-[200px] sm:max-w-xs truncate">
          <div class="flex flex-col">
            <span class="text-sm font-medium text-[#1D1D1F]">${escapeHtml(item.name)}</span>
            <span class="text-[11px] text-[#86868B] sm:hidden">${formatDate(item.date)}</span>
          </div>
        </td>
        <td>
          ${getCategoryBadge(item.category)}
        </td>
        <td class="text-xs text-[#86868B] tabular-nums whitespace-nowrap">
          ${formatDate(item.date)}
        </td>
        <td class="text-right font-semibold text-[#1D1D1F] tabular-nums whitespace-nowrap text-sm sm:text-base">
          ${formatCurrency(item.amount)}
        </td>
        <td class="text-center">
          <button
            type="button"
            class="delete-btn opacity-40 group-hover:opacity-100 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition-all text-[#86868B] cursor-pointer"
            data-id="${item.id}"
            title="Delete this expense"
            aria-label="Delete ${escapeHtml(item.name)}"
          >
            <svg class="w-4 h-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </td>
      </tr>
    `;
    })
    .join('');

  if (newlyCreatedId) {
    setTimeout(() => {
      newlyCreatedId = null;
    }, 2500);
  }
}

/**
 * Handle new expense submission
 */
function handleLogExpense(e: SubmitEvent): void {
  e.preventDefault();

  errorItemName.classList.add('hidden');
  errorAmount.classList.add('hidden');
  errorCategory.classList.add('hidden');

  const itemName = itemNameInput.value.trim();
  const rawAmount = parseFloat(amountInput.value);
  const category = categorySelect.value as Expense['category'];
  const dateVal = dateInput.value || new Date().toISOString().split('T')[0];

  let hasError = false;

  if (!itemName) {
    errorItemName.classList.remove('hidden');
    itemNameInput.focus();
    hasError = true;
  }

  if (isNaN(rawAmount) || rawAmount <= 0) {
    errorAmount.classList.remove('hidden');
    if (!hasError) amountInput.focus();
    hasError = true;
  }

  if (!category || !['Food', 'Transport', 'Utilities', 'Others'].includes(category)) {
    errorCategory.classList.remove('hidden');
    if (!hasError) categorySelect.focus();
    hasError = true;
  }

  if (hasError) return;

  const newExpense: Expense = {
    id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: itemName,
    amount: Math.round(rawAmount * 100) / 100,
    category,
    date: dateVal,
    createdAt: Date.now(),
  };

  expenses.unshift(newExpense);
  saveExpenses(expenses);
  newlyCreatedId = newExpense.id;

  updateSummary();

  form.reset();
  dateInput.value = new Date().toISOString().split('T')[0];

  showToast(`Logged "$${newExpense.amount.toFixed(2)}" for ${newExpense.name}`);

  // Automatically switch to Expense History so the user immediately sees the newly logged expense!
  switchView('expense-history');
}

/**
 * Delete expense handler
 */
function handleDeleteExpense(id: string): void {
  const target = expenses.find((item) => item.id === id);
  if (!target) return;

  expenses = expenses.filter((item) => item.id !== id);
  saveExpenses(expenses);

  updateSummary();
  renderTable();

  showToast(`Deleted "${target.name}"`, 'info');
}

/**
 * Download CSV handler
 */
function handleDownloadCsv(): void {
  if (expenses.length === 0) {
    showToast('No logged expenses to export', 'error');
    return;
  }

  const headers = ['ID', 'Item Name', 'Category', 'Amount ($)', 'Date'];
  const rows = expenses.map((exp) => [
    `"${exp.id}"`,
    `"${exp.name.replace(/"/g, '""')}"`,
    `"${exp.category}"`,
    exp.amount.toFixed(2),
    `"${exp.date}"`,
  ]);

  const csvString = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const tempLink = document.createElement('a');
  const timestamp = new Date().toISOString().split('T')[0];
  tempLink.setAttribute('href', url);
  tempLink.setAttribute('download', `Expense_Tracker_Export_${timestamp}.csv`);
  document.body.appendChild(tempLink);
  tempLink.click();
  document.body.removeChild(tempLink);
  URL.revokeObjectURL(url);

  showToast(`Exported ${expenses.length} transaction${expenses.length === 1 ? '' : 's'} to CSV`);
}

/**
 * Initialize event listeners
 */
function init(): void {
  expenses = loadExpenses();

  const today = new Date().toISOString().split('T')[0];
  dateInput.value = today;

  // View navigation tabs
  const tabButtons = document.querySelectorAll<HTMLButtonElement>('.nav-tab-btn');
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view as ViewName;
      if (view) {
        switchView(view);
      }
    });
  });

  // Shortcut view navigation buttons
  if (overviewAddBtn) {
    overviewAddBtn.addEventListener('click', () => switchView('add-expense'));
  }
  if (overviewViewHistoryBtn) {
    overviewViewHistoryBtn.addEventListener('click', () => switchView('expense-history'));
  }
  if (formGoHistoryBtn) {
    formGoHistoryBtn.addEventListener('click', () => switchView('expense-history'));
  }

  form.addEventListener('submit', handleLogExpense);

  tableBody.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const deleteBtn = target.closest('.delete-btn') as HTMLElement;
    if (deleteBtn && deleteBtn.dataset.id) {
      handleDeleteExpense(deleteBtn.dataset.id);
    }
  });

  const filterButtons = document.querySelectorAll<HTMLButtonElement>('.category-filter-btn');
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter || 'All';
      setActiveCategory(filter);
    });
  });

  downloadCsvBtn.addEventListener('click', handleDownloadCsv);
  headerDownloadBtn.addEventListener('click', handleDownloadCsv);
  if (tableDownloadBtn) {
    tableDownloadBtn.addEventListener('click', handleDownloadCsv);
  }

  clearAllBtn.addEventListener('click', () => {
    if (expenses.length === 0) {
      showToast('No expenses to clear', 'info');
      return;
    }
    clearModal.classList.remove('hidden');
  });

  cancelClearBtn.addEventListener('click', () => {
    clearModal.classList.add('hidden');
  });

  confirmClearBtn.addEventListener('click', () => {
    expenses = [];
    saveExpenses(expenses);
    updateSummary();
    renderTable();
    clearModal.classList.add('hidden');
    showToast('All expenses have been cleared', 'info');
  });

  clearModal.addEventListener('click', (e) => {
    if (e.target === clearModal) {
      clearModal.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!clearModal.classList.contains('hidden')) {
        clearModal.classList.add('hidden');
      }
    }
  });

  addSampleBtn.addEventListener('click', () => {
    expenses = [...INITIAL_SAMPLES];
    saveExpenses(expenses);
    setActiveCategory('All');
    updateSummary();
    renderTable();
    showToast('Sample expenses restored');
  });

  // Default view is Overview
  switchView('overview');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
