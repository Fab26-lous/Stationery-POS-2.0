const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbz-GigCJQ4CuWoi-o0_AgX7afavQC3sNcaK2lQDfbj8ngMJmwzMgkvbgean06uqFsiBaA/exec';

const stores = {
  store1: { name: 'One Stop', users: { Cashier: 'Glam2025' } },
  store2: { name: 'Golden', users: { Cashier2: 'Glam2025' } }
};

let currentStore = null;
let currentUser = null;
let products = [];
let currentSales = [];
let allStoreProducts = [];
let adjustmentItems = [];
let purchaseItems = [];

function setStatus(message) { document.getElementById('sync-status').textContent = message; }
function storeName() { return stores[currentStore]?.name || ''; }

async function apiGet(action, params = {}) {
  const url = new URL(API_BASE_URL);
  
  // Add action parameter
  url.searchParams.append('action', action);
  
  // Add all other parameters
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      url.searchParams.append(k, v);
    }
  });
  
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });
    
    // Check if response is ok
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API GET Error:', error);
    return { ok: false, error: error.message };
  }
}
async function apiPost(payload) {
  try {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API POST Error:', error);
    return { ok: false, error: error.message };
  }
}

function checkLogin() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const error = document.getElementById('login-error');
  let validStore = null;
  for (const storeId in stores) {
    if (stores[storeId].users[username] === password) validStore = storeId;
  }
  if (!validStore) { error.textContent = 'Invalid username or password'; return; }
  currentStore = validStore;
  currentUser = username;
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('store-selection').style.display = 'block';
}

function selectStore(storeId) {
  if (storeId !== currentStore) return alert('You are not authorized for this store');
  document.getElementById('store-selection').style.display = 'none';
  document.getElementById('pos-container').style.display = 'block';
  document.getElementById('store-name').textContent = stores[storeId].name + ' POS';
  loadProducts();
}

async function loadProducts() {
  try {
    setStatus('Loading products...');
    const res = await apiGet('products', { store: storeName() });
    if (!res.ok) throw new Error(res.error || 'Failed to load products');
    products = res.data.map(p => ({
      id: p.productId,
      name: p.productName,
      prices: { ct: Number(p.priceCt) || 0, dz: Number(p.priceDz) || 0, pc: Number(p.pricePc) || 0 },
      stock: Number(p.stock) || 0,
      stockStore1: Number(p.stockOneStop) || 0,
      stockStore2: Number(p.stockGolden) || 0,
      countingUnit: p.countingUnit || 'pc'
    }));
    populateDatalist();
    setStatus(`Loaded ${products.length} products`);
  } catch (error) {
    console.error(error);
    setStatus('Sync failed');
    alert('Failed to load product feed from Apps Script');
  }
}

function populateDatalist() {
  const dl = document.getElementById('item-list');
  dl.innerHTML = '';
  products.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.name;
    dl.appendChild(opt);
  });
}

function updatePrice() {
  const itemName = document.getElementById('item').value.trim().toLowerCase();
  const unit = document.getElementById('unit').value;
  const product = products.find(p => p.name.toLowerCase() === itemName);
  document.getElementById('price').value = product ? (product.prices[unit] || 0) : '';
  calculateTotal();
}

function calculateTotal() {
  const quantity = parseFloat(document.getElementById('quantity').value) || 0;
  const price = parseFloat(document.getElementById('price').value) || 0;
  const discount = parseFloat(document.getElementById('discount').value) || 0;
  const extra = parseFloat(document.getElementById('extra').value) || 0;
  const total = (quantity * price) - discount + extra;
  document.getElementById('total').value = total.toFixed(2);
  return total;
}

['quantity','price','discount','extra'].forEach(id => document.getElementById(id)?.addEventListener('input', calculateTotal));
document.getElementById('item')?.addEventListener('input', updatePrice);
document.getElementById('unit')?.addEventListener('change', updatePrice);

document.getElementById('sale-form')?.addEventListener('submit', function(e) {
  e.preventDefault();
  const item = document.getElementById('item').value.trim();
  if (!item) return alert('Please select an item');
  const sale = {
    item,
    unit: document.getElementById('unit').value,
    quantity: parseFloat(document.getElementById('quantity').value) || 0,
    price: parseFloat(document.getElementById('price').value) || 0,
    discount: parseFloat(document.getElementById('discount').value) || 0,
    extra: parseFloat(document.getElementById('extra').value) || 0,
    paymentMethod: document.getElementById('payment-method').value,
    total: calculateTotal(),
    timestamp: new Date().toISOString()
  };
  currentSales.push(sale);
  updateSalesTable();
  resetForm();
});

function resetForm() {
  document.getElementById('sale-form').reset();
  document.getElementById('price').value = '';
  document.getElementById('total').value = '';
}

function updateSalesTable() {
  const tbody = document.querySelector('#sales-table tbody');
  tbody.innerHTML = '';
  let grandTotal = 0;
  currentSales.forEach((sale, index) => {
    grandTotal += sale.total;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${index+1}</td><td>${sale.item}</td><td>${sale.unit}</td><td>${sale.quantity}</td><td>${sale.price.toFixed(2)}</td><td>${sale.discount.toFixed(2)}</td><td>${sale.extra.toFixed(2)}</td><td>${sale.total.toFixed(2)}</td><td>${sale.paymentMethod}</td><td><button onclick="removeSale(${index})">×</button></td>`;
    tbody.appendChild(tr);
  });
  if (currentSales.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="7" style="text-align:right"><strong>Grand Total</strong></td><td><strong>${grandTotal.toFixed(2)}</strong></td><td colspan="2"></td>`;
    tbody.appendChild(tr);
  }
  document.getElementById('submit-all-btn').style.display = currentSales.length ? 'inline-block' : 'none';
  document.getElementById('clear-all-btn').style.display = currentSales.length ? 'inline-block' : 'none';
}

function removeSale(index) { currentSales.splice(index, 1); updateSalesTable(); }
function clearAllSales() { if (confirm('Clear all items?')) { currentSales = []; updateSalesTable(); } }

async function submitAllSales() {
  if (!currentSales.length) return alert('No items to submit');
  try {
    setStatus('Submitting sales...');
    const res = await apiPost({ action: 'sales', store: storeName(), cashier: currentUser, items: currentSales });
    if (!res.ok) throw new Error(res.error || 'Sales submit failed');
    currentSales = [];
    updateSalesTable();
    setStatus(`Sales synced: ${res.inserted}`);
    alert(`Submitted ${res.inserted} sales line(s)`);
    loadProducts();
  } catch (error) {
  console.error(error);
  setStatus('Sales sync failed');
  alert('Sales submission failed: ' + error.message);
}
}

async function showStockLevels() {
  const res = await apiGet('stock');
  if (!res.ok) return alert('Could not load stock');
  allStoreProducts = res.data;
  populateStockTable(allStoreProducts);
  document.getElementById('stock-modal').style.display = 'flex';
  document.getElementById('stock-search').oninput = function() {
    const term = this.value.toLowerCase().trim();
    populateStockTable(allStoreProducts.filter(p => !term || String(p.productName).toLowerCase().includes(term)));
  };
}
function hideStockLevels() { document.getElementById('stock-modal').style.display = 'none'; }
function populateStockTable(list) {
  const tbody = document.getElementById('stock-table-body');
  tbody.innerHTML = '';
  let outCount = 0, lowCount = 0;
  list.forEach(p => {
    const one = Number(p.stockOneStop) || 0;
    const two = Number(p.stockGolden) || 0;
    let label = 'OK', cls = 'status-ok';
    if (one <= 0 && two <= 0) { label = 'OUT'; cls = 'status-out'; outCount++; }
    else if (one <= 5 || two <= 5) { label = 'LOW'; cls = 'status-low'; lowCount++; }
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.productName}</td><td>${one}</td><td>${two}</td><td class="${cls}">${label}</td>`;
    tbody.appendChild(tr);
  });
  document.getElementById('stock-summary').textContent = `Products: ${list.length} | Out: ${outCount} | Low: ${lowCount}`;
}

function showStockAdjustment() {
  adjustmentItems = [];
  document.getElementById('adjustment-store-name').textContent = storeName();
  updateAdjustmentTable();
  document.getElementById('stock-adjustment-modal').style.display = 'flex';
}
function hideStockAdjustment() { document.getElementById('stock-adjustment-modal').style.display = 'none'; }
function addItemToAdjustment() {
  const name = document.getElementById('adjustment-search').value.trim();
  const p = products.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!p) return alert('Product not found');
  if (adjustmentItems.some(x => x.name === p.name)) return alert('Already added');
  adjustmentItems.push({ name: p.name, unit: 'pc', adjustmentType: 'add', quantity: 0 });
  document.getElementById('adjustment-search').value = '';
  updateAdjustmentTable();
}
function updateAdjustmentTable() {
  const tbody = document.getElementById('adjustment-table-body');
  tbody.innerHTML = '';
  if (!adjustmentItems.length) {
    tbody.innerHTML = '<tr><td colspan="5">No items added yet</td></tr>';
  } else {
    adjustmentItems.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${item.name}</td><td><select onchange="adjustmentItems[${index}].unit=this.value"><option value="pc" ${item.unit==='pc'?'selected':''}>pc</option><option value="dz" ${item.unit==='dz'?'selected':''}>dz</option><option value="ct" ${item.unit==='ct'?'selected':''}>ct</option></select></td><td><select onchange="adjustmentItems[${index}].adjustmentType=this.value"><option value="add" ${item.adjustmentType==='add'?'selected':''}>Add</option><option value="remove" ${item.adjustmentType==='remove'?'selected':''}>Remove</option><option value="set" ${item.adjustmentType==='set'?'selected':''}>Set</option></select></td><td><input type="number" step="any" value="${item.quantity}" onchange="adjustmentItems[${index}].quantity=Number(this.value||0)"></td><td><button onclick="removeAdjustmentItem(${index})">Remove</button></td>`;
      tbody.appendChild(tr);
    });
  }
  document.getElementById('adjustment-summary').textContent = `Items to adjust: ${adjustmentItems.length}`;
}
function removeAdjustmentItem(index) { adjustmentItems.splice(index,1); updateAdjustmentTable(); }
function clearAdjustments() { adjustmentItems = []; updateAdjustmentTable(); }
async function submitStockAdjustment() {
  if (!adjustmentItems.length) return alert('No adjustment items');
  try {
    setStatus('Submitting adjustments...');
    const res = await apiPost({ action: 'adjustments', store: storeName(), items: adjustmentItems, timestamp: new Date().toISOString() });
    if (!res.ok) throw new Error(res.error || 'Adjustment submit failed');
    alert(`Submitted ${res.inserted} adjustment(s)`);
    adjustmentItems = [];
    updateAdjustmentTable();
    hideStockAdjustment();
    setStatus(`Adjustments synced: ${res.inserted}`);
    loadProducts();
  } catch (error) {
    console.error(error);
    setStatus('Adjustment sync failed');
    alert('Adjustment submission failed');
  }
}

function showExpenseModal() { document.getElementById('expense-modal').style.display = 'flex'; }
function hideExpenseModal() { document.getElementById('expense-modal').style.display = 'none'; }
async function submitExpense() {
  try {
    const payload = {
      action: 'cashout',
      store: storeName(),
      cashoutType: 'Operating_Expense',
      category: document.getElementById('expense-category').value,
      description: document.getElementById('expense-description').value,
      amount: Number(document.getElementById('expense-amount').value || 0),
      paymentMethod: document.getElementById('expense-payment').value,
      timestamp: new Date().toISOString()
    };
    const res = await apiPost(payload);
    if (!res.ok) throw new Error(res.error || 'Expense submit failed');
    alert('Expense recorded');
    hideExpenseModal();
    setStatus('Expense synced');
  } catch (error) {
    console.error(error);
    setStatus('Expense sync failed');
    alert('Expense submission failed');
  }
}

function showPurchaseModal() {
  purchaseItems = [];
  document.getElementById('purchase-store-name').textContent = storeName();
  updatePurchaseTable();
  document.getElementById('purchase-modal').style.display = 'flex';
}
function hidePurchaseModal() { document.getElementById('purchase-modal').style.display = 'none'; }
function addItemToPurchase() {
  const name = document.getElementById('purchase-search').value.trim();
  const p = products.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!p) return alert('Product not found');
  if (purchaseItems.some(x => x.item === p.name)) return alert('Already added');
  purchaseItems.push({ item: p.name, unit: 'pc', quantity: 0, costPrice: 0, totalCost: 0 });
  document.getElementById('purchase-search').value = '';
  updatePurchaseTable();
}
function updatePurchaseTable() {
  const tbody = document.getElementById('purchase-table-body');
  tbody.innerHTML = '';
  if (!purchaseItems.length) {
    tbody.innerHTML = '<tr><td colspan="6">No items added yet</td></tr>';
  } else {
    purchaseItems.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${item.item}</td><td><select onchange="purchaseItems[${index}].unit=this.value"><option value="pc" ${item.unit==='pc'?'selected':''}>pc</option><option value="dz" ${item.unit==='dz'?'selected':''}>dz</option><option value="ct" ${item.unit==='ct'?'selected':''}>ct</option></select></td><td><input type="number" step="any" value="${item.quantity}" onchange="purchaseItems[${index}].quantity=Number(this.value||0);recalcPurchase(${index})"></td><td><input type="number" step="any" value="${item.costPrice}" onchange="purchaseItems[${index}].costPrice=Number(this.value||0);recalcPurchase(${index})"></td><td id="purchase-total-${index}">${(item.totalCost||0).toFixed(2)}</td><td><button onclick="removePurchaseItem(${index})">Remove</button></td>`;
      tbody.appendChild(tr);
    });
  }
  document.getElementById('purchase-summary').textContent = `Items to purchase: ${purchaseItems.length}`;
}
function recalcPurchase(index) {
  const item = purchaseItems[index];
  item.totalCost = (Number(item.quantity)||0) * (Number(item.costPrice)||0);
  const cell = document.getElementById(`purchase-total-${index}`);
  if (cell) cell.textContent = item.totalCost.toFixed(2);
}
function removePurchaseItem(index) { purchaseItems.splice(index,1); updatePurchaseTable(); }
function clearPurchases() { purchaseItems = []; updatePurchaseTable(); }
async function submitPurchases() {
  if (!purchaseItems.length) return alert('No purchase items');
  try {
    const totalSpend = purchaseItems.reduce((s, x) => s + ((Number(x.quantity)||0)*(Number(x.costPrice)||0)), 0);
    const res = await apiPost({
      action: 'purchase',
      store: storeName(),
      supplier: document.getElementById('purchase-supplier').value,
      paymentMethod: document.getElementById('purchase-payment').value,
      items: purchaseItems,
      totalSpend,
      timestamp: new Date().toISOString()
    });
    if (!res.ok) throw new Error(res.error || 'Purchase submit failed');
    alert(`Submitted ${res.inserted} purchase line(s)`);
    purchaseItems = [];
    updatePurchaseTable();
    hidePurchaseModal();
    setStatus(`Purchases synced: ${res.inserted}`);
    loadProducts();
  } catch (error) {
  console.error(error);
  setStatus('Purchase sync failed');
  alert('Purchase submission failed: ' + error.message);
}
}
