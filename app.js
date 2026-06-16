import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA2ULweu6J4N6R7tQAQK2ZcyXT0IZgZzKI",
  authDomain: "festival-planner-c1bdc.firebaseapp.com",
  projectId: "festival-planner-c1bdc",
  storageBucket: "festival-planner-c1bdc.firebasestorage.app",
  messagingSenderId: "944037433401",
  appId: "1:944037433401:web:e419a10d93d8f6ca223de8",
  measurementId: "G-0X03EJTBEP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const state = {
  events: [],
  currentEventId: null,
  items: [],
  purchases: []
};

let currentScreen = "events";
let stopItemsListener = null;
let stopPurchasesListener = null;

const screenEvents = document.getElementById("screen-events");
const screenTracker = document.getElementById("screen-tracker");
const statusMessage = document.getElementById("status-message");
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

addEventForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = eventNameInput.value.trim();
  if (!name) {
    return;
  }

  try {
    const created = await addDoc(collection(db, "events"), {
      name,
      createdAt: serverTimestamp()
    });

    state.currentEventId = created.id;
    currentScreen = "tracker";
    addEventForm.reset();
    selectCurrentEvent(state.currentEventId);
  } catch {
    setStatus("Could not create event. Check Firebase rules/auth.", true);
  }
});

eventSelect.addEventListener("change", () => {
  state.currentEventId = eventSelect.value || null;
  render();
});

openEventButton.addEventListener("click", () => {
  if (!state.currentEventId) {
    return;
  }

  currentScreen = "tracker";
  selectCurrentEvent(state.currentEventId);
  render();
});

switchEventButton.addEventListener("click", () => {
  currentScreen = "events";
  render();
});

addItemForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const targetQty = Number(itemQtyInput.value);
  const name = itemNameInput.value.trim();
  const activeEvent = getCurrentEvent();

  if (!activeEvent || !name || !Number.isInteger(targetQty) || targetQty <= 0) {
    return;
  }

  try {
    await addDoc(collection(db, "events", activeEvent.id, "items"), {
      name,
      targetQty,
      createdAt: serverTimestamp()
    });

    addItemForm.reset();
  } catch {
    setStatus("Could not add item.", true);
  }
});

addPurchaseForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const itemId = purchaseItemSelect.value;
  const buyer = buyerNameInput.value.trim();
  const qty = Number(purchaseQtyInput.value);
  const activeEvent = getCurrentEvent();

  if (!activeEvent || !itemId || !buyer || !Number.isInteger(qty) || qty <= 0) {
    return;
  }

  try {
    await addDoc(collection(db, "events", activeEvent.id, "purchases"), {
      itemId,
      buyer,
      qty,
      createdAt: serverTimestamp()
    });

    addPurchaseForm.reset();
  } catch {
    setStatus("Could not save purchase.", true);
  }
});

clearDataButton.addEventListener("click", async () => {
  const activeEvent = getCurrentEvent();
  if (!activeEvent) {
    return;
  }

  if (!confirm(`Clear all items and purchases for \"${activeEvent.name}\"?`)) {
    return;
  }

  try {
    const itemsSnapshot = await getDocs(collection(db, "events", activeEvent.id, "items"));
    const purchasesSnapshot = await getDocs(collection(db, "events", activeEvent.id, "purchases"));

    const deletions = [];
    itemsSnapshot.forEach((item) => {
      deletions.push(deleteDoc(doc(db, "events", activeEvent.id, "items", item.id)));
    });
    purchasesSnapshot.forEach((purchase) => {
      deletions.push(deleteDoc(doc(db, "events", activeEvent.id, "purchases", purchase.id)));
    });

    await Promise.all(deletions);
  } catch {
    setStatus("Could not clear active event.", true);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    setStatus("Connected.");
    initEventsListener();
    return;
  }

  try {
    await signInAnonymously(auth);
    setStatus("Connected.");
  } catch {
    setStatus("Firebase sign-in failed. Enable Anonymous auth and check rules.", true);
  }
});

function initEventsListener() {
  const eventsQuery = query(collection(db, "events"), orderBy("createdAt", "asc"));
  onSnapshot(eventsQuery, (snapshot) => {
    state.events = snapshot.docs.map((eventDoc) => ({
      id: eventDoc.id,
      ...eventDoc.data()
    }));

    if (!state.events.some((event) => event.id === state.currentEventId)) {
      state.currentEventId = state.events[0]?.id || null;
      if (!state.currentEventId) {
        currentScreen = "events";
      }
    }

    if (currentScreen === "tracker" && state.currentEventId) {
      selectCurrentEvent(state.currentEventId);
    }

    render();
  }, () => {
    setStatus("Could not read events. Check Firestore rules.", true);
  });
}

function selectCurrentEvent(eventId) {
  if (!eventId) {
    cleanupActiveEventListeners();
    state.items = [];
    state.purchases = [];
    render();
    return;
  }

  cleanupActiveEventListeners();

  const itemsQuery = query(collection(db, "events", eventId, "items"), orderBy("createdAt", "asc"));
  const purchasesQuery = query(collection(db, "events", eventId, "purchases"), orderBy("createdAt", "asc"));

  stopItemsListener = onSnapshot(itemsQuery, (snapshot) => {
    state.items = snapshot.docs.map((itemDoc) => ({
      id: itemDoc.id,
      ...itemDoc.data()
    }));
    render();
  }, () => {
    setStatus("Could not read items.", true);
  });

  stopPurchasesListener = onSnapshot(purchasesQuery, (snapshot) => {
    state.purchases = snapshot.docs.map((purchaseDoc) => ({
      id: purchaseDoc.id,
      ...purchaseDoc.data()
    }));
    render();
  }, () => {
    setStatus("Could not read purchases.", true);
  });
}

function cleanupActiveEventListeners() {
  if (stopItemsListener) {
    stopItemsListener();
    stopItemsListener = null;
  }

  if (stopPurchasesListener) {
    stopPurchasesListener();
    stopPurchasesListener = null;
  }
}

function getCurrentEvent() {
  if (!state.currentEventId) {
    return null;
  }

  return state.events.find((event) => event.id === state.currentEventId) || null;
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
  const items = activeEvent ? state.items : [];

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

  if (state.items.length === 0) {
    overviewEl.innerHTML = "<p class=\"empty\">No items yet. Add what needs to be bought.</p>";
    return;
  }

  overviewEl.innerHTML = "";

  for (const item of state.items) {
    const purchasesForItem = state.purchases.filter((purchase) => purchase.itemId === item.id);
    const bought = purchasesForItem.reduce((sum, purchase) => sum + (Number(purchase.qty) || 0), 0);
    const remaining = Math.max(0, (Number(item.targetQty) || 0) - bought);
    const progress = (Number(item.targetQty) || 0) > 0
      ? Math.min(100, Math.round((bought / Number(item.targetQty)) * 100))
      : 0;

    const byBuyer = purchasesForItem.reduce((acc, purchase) => {
      const key = purchase.buyer;
      acc[key] = (acc[key] || 0) + (Number(purchase.qty) || 0);
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
        <h3 class="item-name">${escapeHtml(item.name || "")}</h3>
        <span class="badge">${remaining} left</span>
      </div>
      <p class="meta">Need: ${Number(item.targetQty) || 0} • Bought: ${bought}</p>
      <div class="progress"><span style="width:${progress}%"></span></div>
      <p class="buyers">${escapeHtml(buyerText)}</p>
    `;

    overviewEl.append(card);
  }
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? "#dc2626" : "#6b7280";
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
