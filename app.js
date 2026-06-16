const STORAGE_KEY = "plannerOrganizerData";

const state = loadState();
let currentScreen = "events";

const screenEvents = document.getElementById("screen-events");
const screenTracker = document.getElementById("screen-tracker");
const addEventForm = document.getElementById("add-event-form");
const eventNameInput = document.getElementById("event-name");
const eventSelect = document.getElementById("event-select");
const openEventButton = document.getElementById("open-event");
const switchEventButton = document.getElementById("switch-event");
const currentEventNameEl = document.getElementById("current-event-name");
const addItemForm = document.getElementById("add-item-form");
const addPurchaseForm = document.getElementById("add-purchase-form");
const itemQtyInput = document.getElementById("item-qty");
const itemNameInput = document.getElementById("item-name");
const buyerNameInput = document.getElementById("buyer-name");
const purchaseItemSelect = document.getElementById("purchase-item");
const purchaseQtyInput = document.getElementById("purchase-qty");
const overviewEl = document.getElementById("overview");
const clearDataButton = document.getElementById("clear-data");

addEventForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = eventNameInput.value.trim();
  if (!name) {
    return;
  }

  const createdEvent = {
    id: crypto.randomUUID(),
    name,
    items: []
  };

  state.events.push(createdEvent);
  state.currentEventId = createdEvent.id;
  currentScreen = "tracker";

  addEventForm.reset();
  saveAndRender();
});

eventSelect.addEventListener("change", () => {
  state.currentEventId = eventSelect.value || null;
  saveAndRender();
});

openEventButton.addEventListener("click", () => {
  if (!state.currentEventId) {
    return;
  }

  currentScreen = "tracker";
  render();
});

switchEventButton.addEventListener("click", () => {
  currentScreen = "events";
  render();
});

addItemForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const targetQty = Number(itemQtyInput.value);
  const name = itemNameInput.value.trim();
  const activeEvent = getCurrentEvent();

  if (!activeEvent || !name || !Number.isInteger(targetQty) || targetQty <= 0) {
    return;
  }

  activeEvent.items.push({
    id: crypto.randomUUID(),
    name,
    targetQty,
    purchases: []
  });

  addItemForm.reset();
  saveAndRender();
});

addPurchaseForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const itemId = purchaseItemSelect.value;
  const buyer = buyerNameInput.value.trim();
  const qty = Number(purchaseQtyInput.value);
  const activeEvent = getCurrentEvent();

  if (!activeEvent || !itemId || !buyer || !Number.isInteger(qty) || qty <= 0) {
    return;
  }

  const item = activeEvent.items.find((entry) => entry.id === itemId);
  if (!item) {
    return;
  }

  item.purchases.push({
    id: crypto.randomUUID(),
    buyer,
    qty
  });

  addPurchaseForm.reset();
  saveAndRender();
});

clearDataButton.addEventListener("click", () => {
  const activeEvent = getCurrentEvent();
  if (!activeEvent) {
    return;
  }

  if (!confirm(`Clear all items and purchases for \"${activeEvent.name}\"?`)) {
    return;
  }

  activeEvent.items = [];
  saveAndRender();
});

function loadState() {
  const initial = { events: [], currentEventId: null };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return initial;
    }

    const parsed = JSON.parse(raw);
    if (!parsed) {
      return initial;
    }

    if (Array.isArray(parsed.events)) {
      const events = parsed.events.map((event) => ({
        id: event.id,
        name: event.name,
        items: normalizeItems(event.items)
      }));

      const currentEventId = typeof parsed.currentEventId === "string"
        ? parsed.currentEventId
        : events[0]?.id || null;

      return { events, currentEventId };
    }

    if (Array.isArray(parsed.items)) {
      const migratedEvent = {
        id: crypto.randomUUID(),
        name: "My event",
        items: normalizeItems(parsed.items)
      };

      return {
        events: [migratedEvent],
        currentEventId: migratedEvent.id
      };
    }

    return initial;
  } catch {
    return initial;
  }
}

function normalizeItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
        id: item.id,
        name: item.name,
        targetQty: Number(item.targetQty) || 0,
        purchases: Array.isArray(item.purchases)
          ? item.purchases.map((purchase) => ({
              id: purchase.id,
              buyer: purchase.buyer,
              qty: Number(purchase.qty) || 0
            }))
          : []
      }));
}

function getCurrentEvent() {
  if (!state.currentEventId) {
    return null;
  }

  return state.events.find((event) => event.id === state.currentEventId) || null;
}

function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function render() {
  renderActiveScreen();
  renderEventSelect();
  renderTrackerHeader();
  renderItemSelect();
  renderOverview();
}

function renderActiveScreen() {
  const showTracker = currentScreen === "tracker" && !!getCurrentEvent();
  screenEvents.classList.toggle("hidden", showTracker);
  screenTracker.classList.toggle("hidden", !showTracker);
}

function renderEventSelect() {
  eventSelect.innerHTML = "<option value=\"\">Select an event</option>";

  for (const event of state.events) {
    const option = document.createElement("option");
    option.value = event.id;
    option.textContent = event.name;
    eventSelect.append(option);
  }

  if (state.currentEventId) {
    eventSelect.value = state.currentEventId;
  }

  openEventButton.disabled = !state.currentEventId;
}

function renderTrackerHeader() {
  const activeEvent = getCurrentEvent();
  currentEventNameEl.textContent = activeEvent ? activeEvent.name : "Event";
}

function renderItemSelect() {
  const activeEvent = getCurrentEvent();
  const items = activeEvent?.items || [];

  purchaseItemSelect.innerHTML = "<option value=\"\">Select an item</option>";

  for (const item of items) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    purchaseItemSelect.append(option);
  }

  const disabled = !activeEvent || items.length === 0;
  addItemForm.querySelector("button").disabled = !activeEvent;
  addPurchaseForm.querySelector("button").disabled = disabled;
  purchaseItemSelect.disabled = disabled;
  clearDataButton.disabled = !activeEvent;
}

function renderOverview() {
  const activeEvent = getCurrentEvent();
  if (!activeEvent) {
    overviewEl.innerHTML = "<p class=\"empty\">Create and select an event first.</p>";
    return;
  }

  if (activeEvent.items.length === 0) {
    overviewEl.innerHTML = "<p class=\"empty\">No items yet. Add what needs to be bought.</p>";
    return;
  }

  overviewEl.innerHTML = "";

  for (const item of activeEvent.items) {
    const bought = item.purchases.reduce((sum, purchase) => sum + purchase.qty, 0);
    const remaining = Math.max(0, item.targetQty - bought);
    const progress = item.targetQty > 0 ? Math.min(100, Math.round((bought / item.targetQty) * 100)) : 0;

    const byBuyer = item.purchases.reduce((acc, purchase) => {
      const key = purchase.buyer;
      acc[key] = (acc[key] || 0) + purchase.qty;
      return acc;
    }, {});

    const buyerText = Object.keys(byBuyer).length
      ? Object.entries(byBuyer)
          .map(([buyer, qty]) => `${buyer}: ${qty}`)
          .join(" • ")
      : "No purchases yet";

    const card = document.createElement("article");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-top">
        <h3 class="item-name">${escapeHtml(item.name)}</h3>
        <span class="badge">${remaining} left</span>
      </div>
      <p class="meta">Need: ${item.targetQty} • Bought: ${bought}</p>
      <div class="progress"><span style="width:${progress}%"></span></div>
      <p class="buyers">${escapeHtml(buyerText)}</p>
    `;

    overviewEl.append(card);
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

render();
