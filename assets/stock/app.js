import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const cfg = window.STOCK_CONFIG || {};
const fbCfg = cfg.firebaseConfig || {};
const configMissing =
  !fbCfg.apiKey || fbCfg.apiKey === "YOUR_API_KEY" ||
  !fbCfg.projectId || fbCfg.projectId === "YOUR_PROJECT_ID" ||
  !cfg.allowedEmail || cfg.allowedEmail === "YOUR_GOOGLE_EMAIL@gmail.com";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const loginScreen = $("#loginScreen");
const dashboard = $("#dashboard");
const configWarning = $("#configWarning");

if (configMissing) {
  configWarning.classList.remove("hidden");
  loginScreen.classList.add("hidden");
  dashboard.classList.add("hidden");
} else {
  runApp();
}

function runApp() {
  const app = initializeApp(fbCfg);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const carsCol = collection(db, "cars");

  const money = (n) => {
    const v = Number(n || 0);
    return v.toLocaleString(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
  };

  let cars = [];
  let currentTab = "in_stock";
  let openCarId = null;
  let carModalMode = "view";

  // ---------- Auth ----------

  const googleSignInBtn = $("#googleSignInBtn");
  const loginError = $("#loginError");
  const logoutBtn = $("#logoutBtn");
  const standaloneHint = $("#standaloneHint");
  const openInBrowserLink = $("#openInBrowserLink");

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (isStandalone) {
    openInBrowserLink.href = location.href;
  }

  googleSignInBtn.addEventListener("click", async () => {
    loginError.textContent = "";
    googleSignInBtn.disabled = true;
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      console.error(err);
      loginError.textContent = `Sign-in failed: ${err.code || err.message}`;
    }
    googleSignInBtn.disabled = false;
  });

  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      loginScreen.classList.remove("hidden");
      dashboard.classList.add("hidden");
      standaloneHint.classList.toggle("hidden", !isStandalone);
      return;
    }
    if ((user.email || "").toLowerCase() !== cfg.allowedEmail.toLowerCase()) {
      loginError.textContent = `This Google account isn't authorized. Sign in with ${cfg.allowedEmail}.`;
      await signOut(auth);
      return;
    }
    loginScreen.classList.add("hidden");
    dashboard.classList.remove("hidden");
    await loadCars();
  });

  // ---------- Data ----------

  async function loadCars() {
    try {
      const snap = await getDocs(query(carsCol, orderBy("createdAt", "desc")));
      cars = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error(err);
      return;
    }
    renderAll();
  }

  function carTotalCost(car) {
    const extra = (car.costs || []).reduce((sum, c) => sum + Number(c.amount || 0), 0);
    return Number(car.buyingPrice || 0) + extra;
  }

  function carProfit(car) {
    if (car.status !== "sold" || car.sellingPrice == null) return null;
    return Number(car.sellingPrice) - carTotalCost(car);
  }

  // ---------- Rendering ----------

  function renderAll() {
    renderSummary();
    renderGrid();
  }

  function renderSummary() {
    const inStock = cars.filter((c) => c.status === "in_stock");
    const sold = cars.filter((c) => c.status === "sold");
    const capitalInvested = inStock.reduce((sum, c) => sum + carTotalCost(c), 0);
    const totalProfit = sold.reduce((sum, c) => sum + (carProfit(c) || 0), 0);

    $("#sumInStock").textContent = inStock.length;
    $("#sumCapital").textContent = money(capitalInvested);
    $("#sumSold").textContent = sold.length;
    const profitEl = $("#sumProfit");
    profitEl.textContent = money(totalProfit);
    profitEl.classList.toggle("pos", totalProfit > 0);
  }

  function renderGrid() {
    const grid = $("#carGrid");
    const empty = $("#emptyState");
    let list = cars;
    if (currentTab !== "all") list = cars.filter((c) => c.status === currentTab);

    grid.innerHTML = "";
    if (list.length === 0) {
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    for (const car of list) {
      const totalCost = carTotalCost(car);
      const profit = carProfit(car);
      const card = document.createElement("div");
      card.className = "car-card";
      card.dataset.id = car.id;
      const titleParts = [car.make, car.model].filter(Boolean).join(" ");
      const subParts = [car.year, car.vinPlate].filter(Boolean).join(" · ");
      card.innerHTML = `
        <span class="status-pill ${car.status}">${car.status === "sold" ? "Sold" : "In Stock"}</span>
        <h3>${escapeHtml(titleParts || "Unnamed car")}</h3>
        <div class="sub">${escapeHtml(subParts || "—")}</div>
        <div class="row"><span class="k">Buying price</span><span class="v">${money(car.buyingPrice)}</span></div>
        <div class="row"><span class="k">Total cost</span><span class="v">${money(totalCost)}</span></div>
        ${
          car.status === "sold"
            ? `<div class="row"><span class="k">Profit</span><span class="v" style="color:${profit >= 0 ? "var(--green)" : "var(--red)"}">${money(profit)}</span></div>`
            : ""
        }
      `;
      card.addEventListener("click", () => openCarModal(car.id));
      grid.appendChild(card);
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[m]));
  }

  // ---------- Tabs ----------

  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentTab = tab.dataset.tab;
      renderGrid();
    });
  });

  // ---------- Add car ----------

  const addCarBtn = $("#addCarBtn");
  const addCarModal = $("#addCarModal");
  const addCarForm = $("#addCarForm");
  const addCarError = $("#addCarError");

  addCarBtn.addEventListener("click", () => {
    addCarForm.reset();
    addCarError.textContent = "";
    addCarModal.classList.remove("hidden");
  });

  $$("[data-close-modal]", addCarModal).forEach((btn) =>
    btn.addEventListener("click", () => addCarModal.classList.add("hidden"))
  );

  addCarForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    addCarError.textContent = "";
    const payload = {
      make: $("#carMake").value.trim(),
      model: $("#carModel").value.trim() || null,
      year: $("#carYear").value ? Number($("#carYear").value) : null,
      vinPlate: $("#carVin").value.trim() || null,
      purchaseDate: $("#carPurchaseDate").value || null,
      buyingPrice: $("#carBuyingPrice").value ? Number($("#carBuyingPrice").value) : 0,
      askingPrice: $("#carAskingPrice").value ? Number($("#carAskingPrice").value) : null,
      notes: $("#carNotes").value.trim() || null,
      status: "in_stock",
      sellingPrice: null,
      soldDate: null,
      costs: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      await addDoc(carsCol, payload);
    } catch (err) {
      addCarError.textContent = "Could not save the car. Please try again.";
      console.error(err);
      return;
    }
    addCarModal.classList.add("hidden");
    await loadCars();
  });

  // ---------- Car detail modal ----------

  const carModal = $("#carModal");
  const carModalBody = $("#carModalBody");

  $$("[data-close-modal]", carModal).forEach((btn) =>
    btn.addEventListener("click", closeCarModal)
  );

  function closeCarModal() {
    carModal.classList.add("hidden");
    openCarId = null;
  }

  function openCarModal(id) {
    openCarId = id;
    carModalMode = "view";
    renderCarModal();
    carModal.classList.remove("hidden");
  }

  function renderCarModal() {
    const car = cars.find((c) => c.id === openCarId);
    if (!car) return closeCarModal();
    if (carModalMode === "edit") {
      renderCarModalEdit(car);
    } else {
      renderCarModalView(car);
    }
  }

  function renderCarModalView(car) {
    const totalCost = carTotalCost(car);
    const profit = carProfit(car);
    const expectedProfit = car.askingPrice != null ? Number(car.askingPrice) - totalCost : null;
    const costsHtml = (car.costs || [])
      .slice()
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      .map(
        (c) => `
        <div class="cost-line">
          <span class="lbl">${escapeHtml(c.label)}</span>
          <span class="amt">${money(c.amount)}</span>
        </div>`
      )
      .join("");

    const detailRows = [
      ["Make", car.make],
      ["Model", car.model],
      ["Year", car.year],
      ["VIN / Plate", car.vinPlate],
      ["Purchase date", car.purchaseDate],
    ]
      .filter(([, v]) => v)
      .map(
        ([k, v]) =>
          `<div class="row"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(String(v))}</span></div>`
      )
      .join("");

    carModalBody.innerHTML = `
      <span class="status-pill ${car.status}" style="margin-bottom:.7rem;display:inline-block;">${car.status === "sold" ? "Sold" : "In Stock"}</span>
      <h3 style="margin-bottom:.7rem;">${escapeHtml([car.make, car.model].filter(Boolean).join(" ") || "Unnamed car")}</h3>
      <div class="detail-rows">${detailRows || '<div style="color:var(--text-muted);font-size:.85rem;">No details added yet.</div>'}</div>
      ${car.notes ? `<div class="field" style="margin-top:.9rem;"><label>Notes</label><div style="font-size:.9rem;">${escapeHtml(car.notes)}</div></div>` : ""}

      <div class="costs-list">
        <h3 style="font-size:.95rem;margin-bottom:.5rem;">Additional costs</h3>
        ${costsHtml || '<div style="color:var(--text-muted);font-size:.85rem;">No extra costs added.</div>'}
      </div>

      <div class="totals-box">
        <div class="row"><span>Buying price</span><span>${money(car.buyingPrice)}</span></div>
        <div class="row"><span>Additional costs</span><span>${money(totalCost - Number(car.buyingPrice || 0))}</span></div>
        <div class="row grand"><span>Total cost</span><span>${money(totalCost)}</span></div>
        ${
          car.status === "sold"
            ? `<div class="row"><span>Selling price</span><span>${money(car.sellingPrice)}</span></div>
               <div class="row profit ${profit < 0 ? "neg" : ""}"><span>Profit</span><span>${money(profit)}</span></div>`
            : car.askingPrice != null
            ? `<div class="row"><span>Asking price</span><span>${money(car.askingPrice)}</span></div>
               <div class="row profit ${expectedProfit < 0 ? "neg" : ""}"><span>Expected profit</span><span>${money(expectedProfit)}</span></div>`
            : ""
        }
      </div>

      <div class="modal-actions">
        <button type="button" class="btn btn-gold" id="editCarBtn">Edit</button>
        ${
          car.status === "in_stock"
            ? `<button type="button" class="btn" id="markSoldBtn">Mark as sold</button>`
            : `<button type="button" class="btn" id="markUnsoldBtn">Mark as in stock</button>`
        }
        <button type="button" class="btn btn-danger" id="deleteCarBtn">Delete car</button>
      </div>

      <div id="soldFormWrap" class="hidden" style="margin-top:1rem;border-top:1px solid var(--border-gold);padding-top:1rem;">
        <div class="grid-2">
          <div class="field"><label>Selling price (€)</label><input id="soldPrice" type="number" step="0.01" value="${car.askingPrice ?? ""}"></div>
          <div class="field"><label>Sold date</label><input id="soldDate" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
        </div>
        <button type="button" class="btn btn-gold btn-sm" id="confirmSoldBtn">Confirm sale</button>
      </div>
    `;

    $("#editCarBtn").addEventListener("click", () => {
      carModalMode = "edit";
      renderCarModal();
    });

    const markSoldBtn = $("#markSoldBtn");
    if (markSoldBtn) {
      markSoldBtn.addEventListener("click", () => {
        $("#soldFormWrap").classList.remove("hidden");
      });
    }
    const confirmSoldBtn = $("#confirmSoldBtn");
    if (confirmSoldBtn) confirmSoldBtn.addEventListener("click", confirmSold);

    const markUnsoldBtn = $("#markUnsoldBtn");
    if (markUnsoldBtn) markUnsoldBtn.addEventListener("click", markUnsold);

    $("#deleteCarBtn").addEventListener("click", deleteCar);
  }

  function renderCarModalEdit(car) {
    const costsHtml = (car.costs || [])
      .slice()
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      .map(
        (c) => `
        <div class="cost-line" data-cost-id="${c.id}">
          <span class="lbl">${escapeHtml(c.label)}</span>
          <span class="amt">${money(c.amount)}</span>
          <button type="button" class="btn btn-sm btn-danger" data-remove-cost="${c.id}">✕</button>
        </div>`
      )
      .join("");

    carModalBody.innerHTML = `
      <div class="grid-2">
        <div class="field"><label>Make</label><input id="editMake" value="${escapeHtml(car.make || "")}"></div>
        <div class="field"><label>Model</label><input id="editModel" value="${escapeHtml(car.model || "")}"></div>
        <div class="field"><label>Year</label><input id="editYear" type="number" value="${car.year ?? ""}"></div>
        <div class="field"><label>VIN / Plate</label><input id="editVin" value="${escapeHtml(car.vinPlate || "")}"></div>
        <div class="field"><label>Purchase date</label><input id="editPurchaseDate" type="date" value="${car.purchaseDate || ""}"></div>
        <div class="field"><label>Buying price (€)</label><input id="editBuyingPrice" type="number" step="0.01" value="${car.buyingPrice ?? 0}"></div>
        <div class="field"><label>Asking price (€)</label><input id="editAskingPrice" type="number" step="0.01" value="${car.askingPrice ?? ""}"></div>
        ${
          car.status === "sold"
            ? `<div class="field"><label>Selling price (€)</label><input id="editSellingPrice" type="number" step="0.01" value="${car.sellingPrice ?? ""}"></div>`
            : ""
        }
      </div>
      <div class="field"><label>Notes</label><input id="editNotes" value="${escapeHtml(car.notes || "")}"></div>

      <div class="costs-list">
        <h3 style="font-size:.95rem;margin-bottom:.5rem;">Additional costs</h3>
        ${costsHtml || '<div style="color:var(--text-muted);font-size:.85rem;">No extra costs added yet.</div>'}
        <div class="add-cost-row">
          <input type="text" class="lbl-input" id="newCostLabel" placeholder="e.g. Transport, repairs, registration...">
          <input type="number" step="0.01" class="amt-input" id="newCostAmount" placeholder="Amount (€)">
          <button type="button" class="btn btn-sm btn-gold" id="addCostBtn">Add</button>
        </div>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn btn-gold" id="saveCarBtn">Save changes</button>
        <button type="button" class="btn" id="cancelEditBtn">Cancel</button>
      </div>
      <div class="error-msg" id="saveCarMsg"></div>
    `;

    $("#saveCarBtn").addEventListener("click", saveCarEdits);
    $("#cancelEditBtn").addEventListener("click", () => {
      carModalMode = "view";
      renderCarModal();
    });
    $("#addCostBtn").addEventListener("click", addCostLine);
    $$("[data-remove-cost]", carModalBody).forEach((btn) =>
      btn.addEventListener("click", () => removeCostLine(btn.dataset.removeCost))
    );
  }

  async function saveCarEdits() {
    const msg = $("#saveCarMsg");
    const payload = {
      make: $("#editMake").value.trim(),
      model: $("#editModel").value.trim() || null,
      year: $("#editYear").value ? Number($("#editYear").value) : null,
      vinPlate: $("#editVin").value.trim() || null,
      purchaseDate: $("#editPurchaseDate").value || null,
      buyingPrice: $("#editBuyingPrice").value ? Number($("#editBuyingPrice").value) : 0,
      askingPrice: $("#editAskingPrice").value ? Number($("#editAskingPrice").value) : null,
      notes: $("#editNotes").value.trim() || null,
      updatedAt: serverTimestamp(),
    };
    const editSellingPrice = $("#editSellingPrice");
    if (editSellingPrice) {
      payload.sellingPrice = editSellingPrice.value ? Number(editSellingPrice.value) : null;
    }
    try {
      await updateDoc(doc(db, "cars", openCarId), payload);
    } catch (err) {
      msg.textContent = "Save failed.";
      console.error(err);
      return;
    }
    await loadCars();
    carModalMode = "view";
    renderCarModal();
  }

  function captureEditFields() {
    const makeInput = $("#editMake");
    if (!makeInput) return null;
    const editSellingPrice = $("#editSellingPrice");
    return {
      make: makeInput.value,
      model: $("#editModel").value,
      year: $("#editYear").value,
      vin: $("#editVin").value,
      purchaseDate: $("#editPurchaseDate").value,
      buyingPrice: $("#editBuyingPrice").value,
      askingPrice: $("#editAskingPrice").value,
      sellingPrice: editSellingPrice ? editSellingPrice.value : undefined,
      notes: $("#editNotes").value,
    };
  }

  function restoreEditFields(values) {
    const makeInput = $("#editMake");
    if (!values || !makeInput) return;
    makeInput.value = values.make;
    $("#editModel").value = values.model;
    $("#editYear").value = values.year;
    $("#editVin").value = values.vin;
    $("#editPurchaseDate").value = values.purchaseDate;
    $("#editBuyingPrice").value = values.buyingPrice;
    $("#editAskingPrice").value = values.askingPrice;
    const editSellingPrice = $("#editSellingPrice");
    if (editSellingPrice && values.sellingPrice !== undefined) {
      editSellingPrice.value = values.sellingPrice;
    }
    $("#editNotes").value = values.notes;
  }

  async function addCostLine() {
    const label = $("#newCostLabel").value.trim();
    const amount = Number($("#newCostAmount").value || 0);
    if (!label || !amount) return;
    const car = cars.find((c) => c.id === openCarId);
    const newCost = { id: crypto.randomUUID(), label, amount, createdAt: Date.now() };
    const costs = [...(car.costs || []), newCost];
    const pendingEdits = captureEditFields();
    try {
      await updateDoc(doc(db, "cars", openCarId), { costs, updatedAt: serverTimestamp() });
    } catch (err) {
      console.error(err);
      return;
    }
    await loadCars();
    renderCarModal();
    restoreEditFields(pendingEdits);
  }

  async function removeCostLine(costId) {
    const car = cars.find((c) => c.id === openCarId);
    const costs = (car.costs || []).filter((c) => c.id !== costId);
    const pendingEdits = captureEditFields();
    try {
      await updateDoc(doc(db, "cars", openCarId), { costs, updatedAt: serverTimestamp() });
    } catch (err) {
      console.error(err);
      return;
    }
    await loadCars();
    renderCarModal();
    restoreEditFields(pendingEdits);
  }

  async function confirmSold() {
    const price = $("#soldPrice").value;
    const date = $("#soldDate").value;
    if (!price) return;
    try {
      await updateDoc(doc(db, "cars", openCarId), {
        status: "sold",
        sellingPrice: Number(price),
        soldDate: date || null,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      return;
    }
    await loadCars();
    renderCarModal();
  }

  async function markUnsold() {
    try {
      await updateDoc(doc(db, "cars", openCarId), {
        status: "in_stock",
        sellingPrice: null,
        soldDate: null,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      return;
    }
    await loadCars();
    renderCarModal();
  }

  async function deleteCar() {
    if (!confirm("Delete this car and all its cost entries? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "cars", openCarId));
    } catch (err) {
      console.error(err);
      return;
    }
    closeCarModal();
    await loadCars();
  }

  // ---------- Pull to refresh ----------

  function setupPullToRefresh() {
    const indicator = $("#pullRefreshIndicator");
    const spinnerText = $(".pull-refresh-text", indicator);
    const threshold = 70;
    const maxPull = 110;
    const restY = -56;
    let startY = 0;
    let pulling = false;
    let currentPull = 0;

    function atTop() {
      return (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
    }

    function modalOpen() {
      return !addCarModal.classList.contains("hidden") || !carModal.classList.contains("hidden");
    }

    document.addEventListener(
      "touchstart",
      (e) => {
        if (dashboard.classList.contains("hidden") || modalOpen() || !atTop()) return;
        startY = e.touches[0].clientY;
        pulling = true;
        indicator.style.transition = "none";
      },
      { passive: true }
    );

    document.addEventListener(
      "touchmove",
      (e) => {
        if (!pulling) return;
        const dy = e.touches[0].clientY - startY;
        if (dy <= 0 || !atTop()) {
          pulling = false;
          indicator.style.transition = "";
          indicator.style.top = restY + "px";
          indicator.classList.remove("ready");
          return;
        }
        currentPull = Math.min(dy, maxPull);
        e.preventDefault();
        indicator.style.top = restY + currentPull + "px";
        const ready = currentPull >= threshold;
        indicator.classList.toggle("ready", ready);
        spinnerText.textContent = ready ? "Release to refresh" : "Pull to refresh";
      },
      { passive: false }
    );

    document.addEventListener("touchend", async () => {
      if (!pulling) return;
      pulling = false;
      indicator.style.transition = "";
      if (currentPull >= threshold) {
        indicator.style.top = "12px";
        indicator.classList.add("loading");
        spinnerText.textContent = "Refreshing...";
        await loadCars();
        indicator.classList.remove("loading", "ready");
        indicator.style.top = restY + "px";
        spinnerText.textContent = "Pull to refresh";
      } else {
        indicator.classList.remove("ready");
        indicator.style.top = restY + "px";
      }
      currentPull = 0;
    });
  }

  setupPullToRefresh();
}
