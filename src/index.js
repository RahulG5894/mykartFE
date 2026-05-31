const API_BASE = "http://localhost:8089/kart-service/api/v1";

// Elements
const userSelect = document.getElementById("userSelect");
const refreshBtn = document.getElementById("refreshBtn");

const inventorySearch = document.getElementById("inventorySearch");
const inventoryList = document.getElementById("inventoryList");
const inventoryEmpty = document.getElementById("inventoryEmpty");

const addItemForm = document.getElementById("addItemForm");
const itemName = document.getElementById("itemName");
const itemPrice = document.getElementById("itemPrice");
const itemWeight = document.getElementById("itemWeight");

const cartMeta = document.getElementById("cartMeta");
const cartList = document.getElementById("cartList");
const cartEmpty = document.getElementById("cartEmpty");
const cartTotal = document.getElementById("cartTotal");
const checkoutBtn = document.getElementById("checkoutBtn");

const loadingBar = document.getElementById("loadingBar");
const toasts = document.getElementById("toasts");

let currentUserId = null;
let allInventory = [];

// --- Utilities ---
function showLoading(on) {
  loadingBar.classList.toggle("hidden", !on);
}
function toast(msg, type = "success", ttl = 2200) {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  toasts.appendChild(el);
  setTimeout(() => el.remove(), ttl);
}
async function api(path, options = {}) {
  try {
    showLoading(true);
    const headers = {
      "Content-Type": "application/json",
      ...(localStorage.getItem("authToken")
        ? { Authorization: `Bearer ${localStorage.getItem("authToken")}` }
        : {})
    };

    const res = await fetch(`${API_BASE}${path}`, { headers, credentials: "include", ...options });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 401) {
        // Token invalid → back to login
        localStorage.removeItem("authToken");
        window.location.href = "login.html";
      }
      throw new Error(text || `HTTP ${res.status}`);
    }
    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : res.text();
  } catch (e) {
    toast(e.message.includes("Failed to fetch") ? "Network/CORS error" : e.message, "error", 3200);
    throw e;
  } finally {
    showLoading(false);
  }
}
function currency(n) {
  const v = Number(n || 0);
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

// --- Loaders ---
async function loadUsers() {
  const users = await api("/user");
  userSelect.innerHTML = "";
  users.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = `${u.name} (${u.type})`;
    userSelect.appendChild(opt);
  });
  if (users.length) {
    currentUserId = users[0].id;
    userSelect.value = currentUserId;
    cartMeta.textContent = `User #${currentUserId}`;
  }
}

async function loadInventory() {
  allInventory = await api("/item");
  renderInventory(allInventory);
}

async function loadCart() {
  if (!currentUserId) return;
  const cart = await api(`/kart/items/${currentUserId}`);
  renderCart(cart);
}

// --- Renderers ---
function renderInventory(items) {
  inventoryList.innerHTML = "";
  inventoryEmpty.classList.toggle("hidden", items.length > 0);

  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "card";

    const left = document.createElement("div");
    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = item.name;

    const sub = document.createElement("div");
    sub.className = "card-sub";
    sub.textContent = `${currency(item.price)} • ${item.weight} gm`;

    left.appendChild(title);
    left.appendChild(sub);

    const right = document.createElement("div");
    right.className = "row-actions";

    const qtyWrap = document.createElement("div");
    qtyWrap.className = "qty";
    const qtyInput = document.createElement("input");
    qtyInput.className = "input";
    qtyInput.type = "number";
    qtyInput.min = "1";
    qtyInput.value = "1";

    qtyWrap.appendChild(document.createTextNode("Qty"));
    qtyWrap.appendChild(qtyInput);

    const addBtn = document.createElement("button");
    addBtn.className = "btn success";
    addBtn.textContent = "Add to Cart";
    addBtn.addEventListener("click", async () => {
      const q = Math.max(1, parseInt(qtyInput.value || "1", 10));
      await addToCart(item.id, q);
    });

    right.appendChild(qtyWrap);
    right.appendChild(addBtn);

    card.appendChild(left);
    card.appendChild(right);
    inventoryList.appendChild(card);
  });
}

function renderCart(cart) {
  cartList.innerHTML = "";
  const items = (cart && cart.items) || [];
  cartEmpty.classList.toggle("hidden", items.length > 0);

  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "card";

    const left = document.createElement("div");
    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = item.name;

    const sub = document.createElement("div");
    sub.className = "card-sub";
    sub.textContent = `${currency(item.price)} • In cart: ${item.quantity}`;

    left.appendChild(title);
    left.appendChild(sub);

    const right = document.createElement("div");
    right.className = "row-actions";

    const dec = document.createElement("button");
    dec.className = "btn danger";
    dec.textContent = "−";
    dec.title = "Remove one";
    dec.addEventListener("click", async () => {
      await removeFromCart(item.id, 1);
    });

    const qtyPill = document.createElement("div");
    qtyPill.className = "qty";
    const qtyLabel = document.createElement("span");
    qtyLabel.textContent = item.quantity;
    qtyPill.appendChild(document.createTextNode("Qty"));
    qtyPill.appendChild(qtyLabel);

    const inc = document.createElement("button");
    inc.className = "btn success";
    inc.textContent = "+";
    inc.title = "Add one";
    inc.addEventListener("click", async () => {
      await addToCart(item.id, 1);
    });

    right.appendChild(dec);
    right.appendChild(qtyPill);
    right.appendChild(inc);

    card.appendChild(left);
    card.appendChild(right);
    cartList.appendChild(card);
  });

  cartTotal.textContent = `Total: ${currency(cart?.totalAmount || 0)}`;
  checkoutBtn.disabled = items.length === 0;
}

// --- Actions ---

const logoutBtn = document.getElementById("logoutBtn");
logoutBtn.addEventListener("click", async () => {
  try {
    await fetch(`${API_BASE.replace("/api/v1", "")}/auth/logout`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("authToken")}`
      },
      credentials: "include"
    });
  } catch (e) {
    // ignore error, just clear
  }
  window.location.href = "login.html";
});

async function addToCart(itemId, qty) {
  if (!currentUserId) return;
  await api("/kart/items/add", {
    method: "POST",
    body: JSON.stringify({ userId: Number(currentUserId), items: [{ itemId, quantity: qty }] })
  });
  toast("Added to cart");
  await loadCart();
}

async function removeFromCart(itemId, qty) {
  await api("/kart/items/delete", {
    method: "DELETE",
    body: JSON.stringify({ userId: Number(currentUserId), itemId, quantity: qty })
  });
  toast("Updated cart");
  await loadCart();
}

// --- Events ---
userSelect.addEventListener("change", () => {
  currentUserId = Number(userSelect.value);
  cartMeta.textContent = `User #${currentUserId}`;
  loadCart();
});

refreshBtn.addEventListener("click", async () => {
  await Promise.all([loadUsers(), loadInventory(), loadCart()]);
  toast("Refreshed");
});

inventorySearch.addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase().trim();
  const filtered = !q ? allInventory : allInventory.filter(i =>
    i.name?.toLowerCase().includes(q)
  );
  renderInventory(filtered);
});

addItemForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    name: itemName.value.trim(),
    price: parseFloat(itemPrice.value),
    weight: parseFloat(itemWeight.value),
    seller: currentUserId
  };
  if (!payload.name) return;

  await api("/item/add", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  itemName.value = ""; itemPrice.value = ""; itemWeight.value = "";
  toast("Item added");
  await loadInventory();
});

// --- Init ---
(async function init(){
  try {
    await loadUsers();
    await Promise.all([loadInventory(), loadCart()]);
  } catch (e) {
    // Already toasted
  }
})();

