/* ════════════════════════════════════════════════════════════
   FARMA — app.js
   Multi-Page Marketplace (Buy Page & Sell Page)
   Strict Rule: User can sell items, items appear on Buy Page,
   but user CANNOT buy their own listed items.
════════════════════════════════════════════════════════════ */

// ─── AUTH & ACCOUNTS ─────────────────────────────────────────
let accounts = JSON.parse(localStorage.getItem('farma_accounts') || '[]');
let currentUser = null;

// Seed demo accounts if empty
(function seedDefaultAccounts() {
  if (accounts.length === 0) {
    accounts = [
      { name: 'Demo Farmer', username: 'demo', password: 'demo123' },
      { name: 'Akshay', username: 'akshay', password: 'akshay123' },
    ];
    localStorage.setItem('farma_accounts', JSON.stringify(accounts));
  }
})();

function saveAccounts() {
  localStorage.setItem('farma_accounts', JSON.stringify(accounts));
}

// ─── DEFAULT MARKETPLACE (NO PRE-ADDED ITEMS) ────────────────
const DEFAULT_MARKET_ITEMS = [];

// ─── GLOBAL MARKETPLACE STORAGE ──────────────────────────────
function getGlobalMarketplace() {
  const stored = localStorage.getItem('farma_global_marketplace');
  if (!stored) {
    localStorage.setItem('farma_global_marketplace', JSON.stringify([]));
    return [];
  }
  try {
    let items = JSON.parse(stored);
    // Remove any legacy pre-added items (system items) so market is clean
    const filtered = items.filter(i => i.seller !== 'system');
    if (filtered.length !== items.length) {
      saveGlobalMarketplace(filtered);
    }
    return filtered;
  } catch (e) {
    return [];
  }
}

function saveGlobalMarketplace(items) {
  localStorage.setItem('farma_global_marketplace', JSON.stringify(items));
}

// Stepper function for Sell Page Quantity box
function adjustSellQty(delta) {
  const input = document.getElementById('sellQty');
  if (!input) return;
  let val = parseInt(input.value) || 1;
  val = Math.max(1, Math.min(999, val + delta));
  input.value = val;
}

// ─── USER SESSION STORAGE ────────────────────────────────────
function getUserDataKey(username) {
  return `farma_user_${username}`;
}

function loadUserData(username) {
  const raw = localStorage.getItem(getUserDataKey(username));
  if (raw) {
    try {
      const data = JSON.parse(raw);
      return {
        cart: data.cart || [],
        history: data.history || [],
      };
    } catch (e) {}
  }
  return { cart: [], history: [] };
}

function saveUserData(username, data) {
  localStorage.setItem(getUserDataKey(username), JSON.stringify(data));
}

// Helper to push history record for any user (even if not currently logged in)
function pushUserHistory(username, record) {
  const data = loadUserData(username);
  data.history.unshift(record);
  saveUserData(username, data);
}

// ─── APP STATE ───────────────────────────────────────────────
let shopRunning = false;
let currentPage = 'buy';
let categoryFilter = 'all';
let historyFilter = 'all';
let cart = [];
let history = [];
let selectedEmoji = '🎁';
let bgTimer = null;

const EMOJIS = [
  '🎁','🍅','🍎','🥕','🌽','🥦','🍋','🥒','🧅','🥔',
  '🍓','🥛','🍯','🫐','🍇','🥭','🍌','🍉','🍑','🥑',
  '🫒','🧄','🌶️','🥬','🍄','🌿','🌾','🫘','🥜','🌰',
  '🍞','🧀','🥚','🥗','🍵','📦','🪴','🌻','🧺','🧑‍🌾'
];

/* ════════════════════════════════════════════════════════════
   AUTH FUNCTIONS
════════════════════════════════════════════════════════════ */
function switchAuthTab(tab) {
  document.getElementById('loginForm').classList.toggle('hidden',  tab !== 'login');
  document.getElementById('signupForm').classList.toggle('hidden', tab !== 'signup');
  document.getElementById('loginTabBtn').classList.toggle('active',  tab === 'login');
  document.getElementById('signupTabBtn').classList.toggle('active', tab === 'signup');
  document.getElementById('loginErr').textContent  = '';
  document.getElementById('signupErr').textContent = '';
}

function doLogin() {
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  const err  = document.getElementById('loginErr');

  if (!user || !pass) { err.textContent = '⚠️ Please fill all fields.'; return; }

  const found = accounts.find(a => a.username.toLowerCase() === user.toLowerCase() && a.password === pass);
  if (!found) { err.textContent = '❌ Invalid username or password.'; return; }

  currentUser = found;
  openApp();
}

function doSignup() {
  const name  = document.getElementById('signupName').value.trim();
  const user  = document.getElementById('signupUser').value.trim();
  const pass  = document.getElementById('signupPass').value;
  const pass2 = document.getElementById('signupPass2').value;
  const err   = document.getElementById('signupErr');

  if (!name || !user || !pass || !pass2) { err.textContent = '⚠️ Please fill all fields.'; return; }
  if (user.length < 3)                   { err.textContent = '⚠️ Username min 3 characters.'; return; }
  if (pass.length < 5)                   { err.textContent = '⚠️ Password min 5 characters.'; return; }
  if (pass !== pass2)                    { err.textContent = '❌ Passwords do not match.'; return; }
  if (accounts.find(a => a.username.toLowerCase() === user.toLowerCase())) {
    err.textContent = '❌ Username already registered.'; return;
  }

  const newAcc = { name, username: user, password: pass };
  accounts.push(newAcc);
  saveAccounts();
  currentUser = newAcc;
  openApp();
}

function openApp() {
  // Hide auth screen, show app
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');

  // Populate header and overlay info
  document.getElementById('headerUser').textContent   = currentUser.name;
  document.getElementById('headerAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
  document.getElementById('overlayName').textContent  = currentUser.name;

  // Load user data from localStorage
  const uData = loadUserData(currentUser.username);
  cart = uData.cart;
  history = uData.history;

  updateCartBadge();

  // Reset overlay to prompt Start
  document.getElementById('overlay').classList.remove('hidden');
  document.getElementById('overlayNote').textContent = 'Press Start to access all marketplace functions.';
  document.getElementById('mainContent').classList.add('disabled');
  document.getElementById('stopBtn').disabled = true;
  setStatus('stopped', '⏹ Stopped');
}

function doLogout() {
  if (currentUser) {
    // Persist current session
    saveUserData(currentUser.username, { cart, history });
  }

  stopShop();
  currentUser = null;
  cart = [];
  history = [];

  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  document.getElementById('loginErr').textContent = '';
  document.getElementById('signupErr').textContent = '';
  showToast('👋 Logged out successfully.', 'blue');
}

/* ════════════════════════════════════════════════════════════
   START / STOP CONTROLS
════════════════════════════════════════════════════════════ */
function startShop() {
  shopRunning = true;

  // Enable main content & hide overlay
  document.getElementById('mainContent').classList.remove('disabled');
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('stopBtn').disabled = false;
  setStatus('running', '🟢 Running');

  // Start background ticker
  startBgTicker();

  // Refresh current view
  renderCurrentPage();

  showToast(`🌿 Farma Started! Welcome ${currentUser.name}!`, 'green');
}

function stopShop() {
  shopRunning = false;
  stopBgTicker();

  // Disable UI and re-show overlay
  document.getElementById('mainContent').classList.add('disabled');
  document.getElementById('overlay').classList.remove('hidden');
  document.getElementById('overlayNote').textContent = 'Farma is paused. Press Start to resume.';
  document.getElementById('stopBtn').disabled = true;
  setStatus('stopped', '⏹ Stopped');

  showToast('🔴 Farma Stopped. Press Start to resume.', 'red');
}

function startBgTicker() {
  stopBgTicker();
  bgTimer = setInterval(() => {
    // Background health heartbeat
  }, 20000);
}

function stopBgTicker() {
  if (bgTimer) {
    clearInterval(bgTimer);
    bgTimer = null;
  }
}

function guard() {
  if (!shopRunning) {
    showToast('⚠️ Please press ▶ Start Farma first!', 'orange');
    return false;
  }
  return true;
}

/* ════════════════════════════════════════════════════════════
   MULTI-PAGE NAVIGATION (Buy Page, Sell Page, Cart, History)
════════════════════════════════════════════════════════════ */
function switchPage(pageName) {
  currentPage = pageName;

  // Toggle page visibility
  document.querySelectorAll('.app-page').forEach(p => p.classList.remove('active'));
  const targetPage = document.getElementById(pageName + 'Page');
  if (targetPage) targetPage.classList.add('active');

  // Update nav button active states
  const navMap = {
    buy: 'navBuyBtn',
    sell: 'navSellBtn',
    cart: 'navCartBtn',
    history: 'navHistoryBtn'
  };

  document.querySelectorAll('.nav-page-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(navMap[pageName]);
  if (activeBtn) activeBtn.classList.add('active');

  // Render view
  renderCurrentPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderCurrentPage() {
  if (currentPage === 'buy')     renderShopGrid();
  if (currentPage === 'sell')    renderSellPage();
  if (currentPage === 'cart')    renderCart();
  if (currentPage === 'history') renderHistory();
}

/* ════════════════════════════════════════════════════════════
   PAGE 1: BUY PAGE LOGIC & RENDERING
   * CRITICAL RULE IMPLEMENTATION:
   - User's listed items appear on the Buy page
   - BUT the same user CANNOT buy their own item!
════════════════════════════════════════════════════════════ */
function setCategoryFilter(category, btnElement) {
  categoryFilter = category;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');
  renderShopGrid();
}

function filterBuyItems() {
  renderShopGrid();
}

function renderShopGrid() {
  const grid = document.getElementById('shopGrid');
  if (!grid) return;

  const marketplace = getGlobalMarketplace();
  const searchVal = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();

  // Apply search & category filter
  let filtered = marketplace.filter(item => {
    // Search match
    const matchSearch = !searchVal ||
      item.name.toLowerCase().includes(searchVal) ||
      item.desc.toLowerCase().includes(searchVal) ||
      (item.sellerName && item.sellerName.toLowerCase().includes(searchVal));

    if (!matchSearch) return false;

    // Category filter
    if (categoryFilter === 'fresh') {
      return item.seller === 'system';
    } else if (categoryFilter === 'community') {
      return item.seller !== 'system';
    } else if (categoryFilter === 'myitems') {
      return currentUser && item.seller === currentUser.username;
    }
    return true;
  });

  grid.innerHTML = '';

  if (marketplace.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <span class="big-icon">🌾</span>
        <p><strong>The marketplace is currently empty!</strong><br>
        All pre-added items have been cleared. List your first fresh product from the Sell Page!</p>
        <button class="btn-banner-switch" onclick="switchPage('sell')" style="margin-top:16px; background:var(--primary); color:#fff">
          🏷️ Go to Sell Page &amp; List Item →
        </button>
      </div>`;
    return;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <span class="big-icon">🔍</span>
        <p><strong>No products found matching your search.</strong><br>
        Try clearing search or filters.</p>
      </div>`;
    return;
  }

  filtered.forEach(item => {
    const isOutOfStock = (item.qty <= 0);
    // CHECK IF THIS ITEM WAS LISTED BY THE CURRENT LOGGED-IN USER:
    const isOwnListing = currentUser && (item.seller === currentUser.username);

    const card = document.createElement('div');
    card.className = `item-card ${isOwnListing ? 'own-listing' : ''}`;

    // Tag for seller identity
    let sellerTagHtml = '';
    if (isOwnListing) {
      sellerTagHtml = `<span class="seller-tag own">👤 Listed by You</span>`;
    } else {
      sellerTagHtml = `<span class="seller-tag">🌱 Seller: ${esc(item.sellerName || 'Farmer')}</span>`;
    }

    // Purchase button according to ownership rule:
    let actionButtonHtml = '';
    if (isOwnListing) {
      // RULE: User CANNOT buy their own item!
      actionButtonHtml = `
        <button class="btn-add btn-disabled-own" disabled title="You cannot buy an item listed by yourself.">
          🚫 Your Item (Cannot Buy)
        </button>
        <div class="own-notice">✓ You are the seller of this item</div>
      `;
    } else if (isOutOfStock) {
      actionButtonHtml = `
        <button class="btn-add" disabled style="opacity:0.4; cursor:not-allowed;">
          Sold Out
        </button>
      `;
    } else {
      actionButtonHtml = `
        <button class="btn-add" onclick="addToCart(${item.id})">
          🛒 Add to Cart
        </button>
      `;
    }

    card.innerHTML = `
      ${isOutOfStock ? '<div class="ribbon-sold">Sold Out</div>' : ''}
      <div>
        <span class="item-emoji">${item.emoji}</span>
        ${sellerTagHtml}
        <div class="item-name">${esc(item.name)}</div>
        <div class="item-desc">${esc(item.desc)}</div>
      </div>
      <div>
        <div class="item-price-row">
          <span class="item-price">₹ ${item.price}</span>
          <span class="item-stock-tag">(${item.qty} in stock)</span>
        </div>
        ${actionButtonHtml}
      </div>
    `;

    grid.appendChild(card);
  });
}

function addToCart(itemId) {
  if (!guard()) return;

  const marketplace = getGlobalMarketplace();
  const item = marketplace.find(i => i.id === itemId);
  if (!item) return;

  // STRICT GUARD: Cannot buy own listing
  if (currentUser && item.seller === currentUser.username) {
    showToast('⚠️ You cannot buy your own listed item!', 'orange');
    return;
  }

  if (item.qty <= 0) {
    showToast('⚠️ Sorry, this item is out of stock!', 'red');
    return;
  }

  // Check if item is already in cart and quantity limit
  const inCart = cart.filter(i => i.id === itemId).length;
  if (inCart >= item.qty) {
    showToast(`⚠️ Only ${item.qty} units available in stock!`, 'orange');
    return;
  }

  cart.push({
    ...item,
    cartId: Date.now() + Math.random()
  });

  updateCartBadge();
  saveUserData(currentUser.username, { cart, history });
  showToast(`✅ ${item.emoji} ${item.name} added to cart!`, 'green');
}

/* ════════════════════════════════════════════════════════════
   PAGE 2: SELL PAGE (SELLER STUDIO & LISTINGS)
════════════════════════════════════════════════════════════ */
function renderSellPage() {
  updateSellerStats();
  renderMyListings();
}

function updateSellerStats() {
  if (!currentUser) return;
  const marketplace = getGlobalMarketplace();
  const myListings = marketplace.filter(i => i.seller === currentUser.username);

  const totalListed = myListings.length;
  const totalValue = myListings.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const soldCount = history.filter(h => h.type === 'sell').length;

  document.getElementById('statListedCount').textContent = totalListed;
  document.getElementById('statTotalValue').textContent  = `₹ ${totalValue}`;
  document.getElementById('statSoldCount').textContent   = soldCount;
  document.getElementById('myListingSubCount').textContent = `${totalListed} active items`;
}

function listItem() {
  if (!guard()) return;
  const msg   = document.getElementById('sellMsg');
  const name  = document.getElementById('sellName').value.trim();
  const desc  = document.getElementById('sellDesc').value.trim();
  const price = parseInt(document.getElementById('sellPrice').value);
  const qty   = parseInt(document.getElementById('sellQty').value) || 1;

  if (!name) {
    setMsg(msg, '⚠️ Please enter a product name.', 'error'); return;
  }
  if (!desc) {
    setMsg(msg, '⚠️ Please add a short description.', 'error'); return;
  }
  if (!price || price < 1) {
    setMsg(msg, '⚠️ Price must be at least ₹ 1.', 'error'); return;
  }
  if (qty < 1) {
    setMsg(msg, '⚠️ Quantity must be at least 1.', 'error'); return;
  }

  const newItem = {
    id: Date.now(),
    name: name,
    desc: desc,
    emoji: selectedEmoji,
    price: price,
    qty: qty,
    seller: currentUser.username,
    sellerName: currentUser.name,
    createdAt: now()
  };

  // 1. Add to global marketplace (so it appears on Buy page!)
  const marketplace = getGlobalMarketplace();
  marketplace.unshift(newItem);
  saveGlobalMarketplace(marketplace);

  // 2. Add to user's history as "Listed"
  history.unshift({
    type: 'listed',
    name: name,
    emoji: selectedEmoji,
    price: price,
    qty: qty,
    time: now()
  });

  saveUserData(currentUser.username, { cart, history });

  // 3. Clear form
  document.getElementById('sellName').value = '';
  document.getElementById('sellDesc').value = '';
  document.getElementById('sellPrice').value = '';
  document.getElementById('sellQty').value = '1';

  setMsg(msg, `🎉 "${name}" published! It is now live on the Buy Page!`, 'success');
  updateSellerStats();
  renderMyListings();

  showToast(`🏷️ "${name}" is now live on Buy Page!`, 'green');
  setTimeout(() => { msg.textContent = ''; }, 4000);
}

function renderMyListings() {
  const container = document.getElementById('myListingsGrid');
  if (!container || !currentUser) return;

  const marketplace = getGlobalMarketplace();
  const myListings = marketplace.filter(i => i.seller === currentUser.username);

  container.innerHTML = '';

  if (myListings.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="big-icon">🏷️</span>
        <p><strong>You have not listed any items yet.</strong><br>
        Fill out the form on the left to list your harvest!</p>
      </div>`;
    return;
  }

  myListings.forEach(item => {
    const row = document.createElement('div');
    row.className = 'listing-item-row';
    row.innerHTML = `
      <span class="listing-emoji">${item.emoji}</span>
      <div class="listing-info">
        <strong>${esc(item.name)}</strong>
        <small>${esc(item.desc)}</small>
        <div class="listing-price-tag">₹ ${item.price} · <span style="font-weight:600; color:var(--muted); font-size:0.85rem">${item.qty} units available</span></div>
      </div>
      <div class="listing-actions">
        <span class="listing-status-badge">🟢 Live on Buy Page</span>
        <button class="btn-delist" onclick="removeListing(${item.id})">🗑️ Remove / Delist</button>
      </div>
    `;
    container.appendChild(row);
  });
}

function removeListing(itemId) {
  if (!guard()) return;

  let marketplace = getGlobalMarketplace();
  const item = marketplace.find(i => i.id === itemId);
  if (!item) return;

  // Verify ownership
  if (item.seller !== currentUser.username) return;

  // Remove from global marketplace
  marketplace = marketplace.filter(i => i.id !== itemId);
  saveGlobalMarketplace(marketplace);

  // Update seller studio view
  updateSellerStats();
  renderMyListings();
  showToast(`🗑️ "${item.name}" removed from marketplace.`, 'orange');
}

/* ════════════════════════════════════════════════════════════
   PAGE 3: CART PAGE & CHECKOUT
════════════════════════════════════════════════════════════ */
function renderCart() {
  const list    = document.getElementById('cartList');
  const summary = document.getElementById('cartSummary');
  const totEl   = document.getElementById('cartTotal');
  const lines   = document.getElementById('summaryLines');
  const msg     = document.getElementById('cartMsg');
  if (msg) msg.textContent = '';

  if (cart.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="big-icon">🧺</span>
        <p><strong>Your cart is empty!</strong><br>
        Go to the Buy Page to add fresh farm produce.</p>
        <button class="btn-banner-switch" onclick="switchPage('buy')" style="margin-top:14px; background:var(--primary); color:#fff">
          🛒 Browse Buy Page →
        </button>
      </div>`;
    summary.style.display = 'none';
    return;
  }

  list.innerHTML = '';
  lines.innerHTML = '';
  let total = 0;

  cart.forEach(item => {
    total += item.price;

    const row = document.createElement('div');
    row.className = 'cart-row';
    row.innerHTML = `
      <span class="cart-emoji">${item.emoji}</span>
      <div class="cart-info">
        <strong>${esc(item.name)}</strong>
        <small>${esc(item.desc)} · Seller: ${esc(item.sellerName)}</small>
      </div>
      <span class="cart-price">₹ ${item.price}</span>
      <button class="remove-btn" onclick="removeFromCart(${item.cartId})" title="Remove item">✕</button>
    `;
    list.appendChild(row);

    const ln = document.createElement('div');
    ln.className = 'summary-line';
    ln.innerHTML = `
      <span>${item.emoji} ${esc(item.name)}</span>
      <strong>₹ ${item.price}</strong>
    `;
    lines.appendChild(ln);
  });

  totEl.textContent = `Total: ₹ ${total}`;
  summary.style.display = 'block';
}

function removeFromCart(cartId) {
  if (!guard()) return;
  cart = cart.filter(i => i.cartId !== cartId);
  updateCartBadge();
  saveUserData(currentUser.username, { cart, history });
  renderCart();
}

function checkout() {
  if (!guard()) return;
  const msg = document.getElementById('cartMsg');
  if (cart.length === 0) return;

  const marketplace = getGlobalMarketplace();

  // Process purchases and update stock
  cart.forEach(cartItem => {
    const marketItem = marketplace.find(m => m.id === cartItem.id);
    if (marketItem) {
      marketItem.qty = Math.max(0, marketItem.qty - 1);

      // If bought from another community user, record a sale for that seller!
      if (marketItem.seller !== 'system' && marketItem.seller !== currentUser.username) {
        pushUserHistory(marketItem.seller, {
          type: 'sell',
          name: marketItem.name,
          emoji: marketItem.emoji,
          price: marketItem.price,
          buyerName: currentUser.name,
          time: now()
        });
      }
    }

    // Add purchase record to buyer's history
    history.unshift({
      type: 'buy',
      name: cartItem.name,
      emoji: cartItem.emoji,
      price: cartItem.price,
      sellerName: cartItem.sellerName,
      time: now()
    });
  });

  // Save updated marketplace
  saveGlobalMarketplace(marketplace);

  const grandTotal = cart.reduce((s, i) => s + i.price, 0);
  cart = [];
  updateCartBadge();
  saveUserData(currentUser.username, { cart, history });

  renderCart();
  showToast(`🎉 Order Placed for ₹ ${grandTotal}! Enjoy fresh produce!`, 'green');
}

/* ════════════════════════════════════════════════════════════
   PAGE 4: HISTORY PAGE
════════════════════════════════════════════════════════════ */
function filterHistory(filterType, btnEl) {
  historyFilter = filterType;
  document.querySelectorAll('.hist-filter-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;

  // Reload history fresh from storage
  if (currentUser) {
    const uData = loadUserData(currentUser.username);
    history = uData.history;
  }

  let filtered = history;
  if (historyFilter !== 'all') {
    filtered = history.filter(h => h.type === historyFilter);
  }

  list.innerHTML = '';

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="big-icon">📜</span>
        <p><strong>No transactions found in this category.</strong><br>
        Your purchases and sales will appear here automatically.</p>
      </div>`;
    return;
  }

  filtered.forEach(h => {
    const badgeMap = {
      buy:    { label: '🛒 Bought', cls: 'buy' },
      sell:   { label: '✅ Sold',   cls: 'sell' },
      listed: { label: '📋 Listed', cls: 'listed' },
    };
    const badge = badgeMap[h.type] || badgeMap.buy;

    let detailText = h.time;
    if (h.type === 'buy' && h.sellerName) {
      detailText += ` · Bought from ${esc(h.sellerName)}`;
    } else if (h.type === 'sell' && h.buyerName) {
      detailText += ` · Sold to ${esc(h.buyerName)}`;
    }

    const row = document.createElement('div');
    row.className = 'hist-row';
    row.innerHTML = `
      <span style="font-size:2rem">${h.emoji}</span>
      <div class="hist-info">
        <strong>${esc(h.name)}</strong>
        <small>${detailText}</small>
      </div>
      <span class="hist-badge ${badge.cls}">${badge.label}</span>
      <span class="hist-price">₹ ${h.price}</span>
    `;
    list.appendChild(row);
  });
}

/* ════════════════════════════════════════════════════════════
   HELPERS & UTILITIES
════════════════════════════════════════════════════════════ */
function updateCartBadge() {
  const b = document.getElementById('cartCount');
  if (!b) return;
  b.textContent = cart.length;
  b.classList.toggle('hidden', cart.length === 0);
}

function setStatus(cls, text) {
  const el = document.getElementById('shopStatus');
  if (!el) return;
  el.textContent = text;
  el.className   = 'status-badge ' + cls;
}

function setMsg(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className   = 'msg ' + type;
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function now() {
  return new Date().toLocaleString('en-IN', {
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
    day: '2-digit',
    month: 'short'
  });
}

let toastTimer = null;
function showToast(text, color) {
  const t = document.getElementById('toast');
  if (!t) return;
  const bg = {
    green: '#15803d',
    red: '#b91c1c',
    orange: '#c2410c',
    blue: '#1d4ed8'
  };
  t.style.background = bg[color] || '#0f172a';
  t.textContent      = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

function buildEmojiPicker() {
  const picker = document.getElementById('emojiPicker');
  if (!picker) return;
  picker.innerHTML = '';
  EMOJIS.forEach(em => {
    const s = document.createElement('span');
    s.className = 'emoji-opt' + (em === selectedEmoji ? ' picked' : '');
    s.textContent = em;
    s.onclick = () => {
      selectedEmoji = em;
      document.getElementById('chosenEmoji').textContent = em;
      document.querySelectorAll('.emoji-opt').forEach(x => x.classList.remove('picked'));
      s.classList.add('picked');
    };
    picker.appendChild(s);
  });
}

// Enter Key triggers Login / Signup
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const loginForm  = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  if (loginForm && !loginForm.classList.contains('hidden')) {
    doLogin();
  } else if (signupForm && !signupForm.classList.contains('hidden')) {
    doSignup();
  }
});

// ════════════════════════════════════════════════════════════
// ABOUT US, CONTACT & SUGGESTIONS MODAL
// ════════════════════════════════════════════════════════════
function openAboutModal(initialTab = 'about') {
  const modal = document.getElementById('aboutModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  switchModalTab(initialTab);

  // Pre-fill name in feedback form if logged in
  const nameInput = document.getElementById('feedbackName');
  if (nameInput && currentUser && !nameInput.value) {
    nameInput.value = currentUser.name;
  }
}

function closeAboutModal() {
  const modal = document.getElementById('aboutModal');
  if (modal) modal.classList.add('hidden');
}

function handleBackdropClick(e) {
  if (e.target && e.target.id === 'aboutModal') {
    closeAboutModal();
  }
}

function switchModalTab(tabName) {
  const tabs = {
    about: { btn: 'tabAboutBtn', section: 'modalAboutSection' },
    contact: { btn: 'tabContactBtn', section: 'modalContactSection' },
    feedback: { btn: 'tabFeedbackBtn', section: 'modalFeedbackSection' }
  };

  // Remove active classes
  document.querySelectorAll('.modal-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.modal-section').forEach(s => s.classList.remove('active'));

  // Activate selected tab
  const selected = tabs[tabName] || tabs.about;
  const btnEl = document.getElementById(selected.btn);
  const secEl = document.getElementById(selected.section);
  if (btnEl) btnEl.classList.add('active');
  if (secEl) secEl.classList.add('active');
}

function sendSuggestion(e) {
  if (e) e.preventDefault();
  const nameInput = document.getElementById('feedbackName');
  const topicSelect = document.getElementById('feedbackTopic');
  const msgInput = document.getElementById('feedbackMessage');
  const statusEl = document.getElementById('feedbackStatus');

  const name = nameInput ? nameInput.value.trim() : '';
  const topic = topicSelect ? topicSelect.value : 'General Suggestion';
  const message = msgInput ? msgInput.value.trim() : '';

  if (!name || !message) {
    setMsg(statusEl, '⚠️ Please fill out your name and suggestion message.', 'error');
    return;
  }

  const recipient = 'akshaymagadum2007@gmai.com';
  const subject = encodeURIComponent(`[Farma Marketplace] ${topic} from ${name}`);
  const body = encodeURIComponent(
    `Hello Akshay,\n\nHere is my suggestion / feedback for the Farma Web App:\n\nTopic: ${topic}\nMessage:\n${message}\n\n---\nSent by: ${name} (${currentUser ? currentUser.username : 'Guest'})\nTime: ${now()}`
  );

  const mailtoUrl = `mailto:${recipient}?subject=${subject}&body=${body}`;

  // Launch email client
  window.open(mailtoUrl, '_blank');

  setMsg(statusEl, '🎉 Thank you! Your email app has been opened with your message ready to send to akshaymagadum2007@gmai.com.', 'success');
  showToast('✉️ Opening mail app to send suggestion!', 'green');

  // Clear message
  if (msgInput) msgInput.value = '';
  setTimeout(() => {
    if (statusEl) statusEl.textContent = '';
  }, 5000);
}

// App initialization on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  buildEmojiPicker();
});
