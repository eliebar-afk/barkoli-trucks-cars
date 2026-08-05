(() => {
  const cfg = window.STOCK_CONFIG || {};
  const configMissing = !cfg.supabaseUrl || cfg.supabaseUrl === "YOUR_SUPABASE_PROJECT_URL" ||
    !cfg.supabaseAnonKey || cfg.supabaseAnonKey === "YOUR_SUPABASE_ANON_KEY";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const loginScreen = $("#loginScreen");
  const dashboard = $("#dashboard");
  const configWarning = $("#configWarning");

  if (configMissing) {
    configWarning.classList.remove("hidden");
    loginScreen.classList.add("hidden");
    dashboard.classList.add("hidden");
    return;
  }

  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  const money = (n) => {
    const v = Number(n || 0);
    return v.toLocaleString(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
  };

  let cars = [];
  let currentTab = "in_stock";
  let openCarId = null;

  // ---------- Auth ----------

  const loginForm = $("#loginForm");
  const loginError = $("#loginError");
  const logoutBtn = $("#logoutBtn");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";
    const email = $("#loginEmail").value.trim();
    const password = $("#loginPassword").value;
    const submitBtn = loginForm.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    submitBtn.disabled = false;
    if (error) {
      loginError.textContent = "Login failed — check your email and password.";
      return;
    }
    await enterDashboard();
  });

  logoutBtn.addEventListener("click", async () => {
    await sb.auth.signOut();
    location.reload();
  });

  async function checkSession() {
    const { data } = await sb.auth.getSession();
    if (data.session) {
      await enterDashboard();
    } else {
      loginScreen.classList.remove("hidden");
      dashboard.classList.add("hidden");
    }
  }

  async function enterDashboard() {
    loginScreen.classList.add("hidden");
    dashboard.classList.remove("hidden");
    await loadCars();
  }

  // ---------- Data ----------

  async function loadCars() {
    const { data, error } = await sb
      .from("cars")
      .select("*, car_costs(*)")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    cars = data || [];
    renderAll();
  }

  function carTotalCost(car) {
    const extra = (car.car_costs || []).reduce((sum, c) => sum + Number(c.amount || 0), 0);
    return Number(car.buying_price || 0) + extra;
  }

  function carProfit(car) {
    if (car.status !== "sold" || car.selling_price == null) return null;
    return Number(car.selling_price) - carTotalCost(car);
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
      const subParts = [car.year, car.vin_plate].filter(Boolean).join(" · ");
      card.innerHTML = `
        <span class="status-pill ${car.status}">${car.status === "sold" ? "Sold" : "In Stock"}</span>
        <h3>${escapeHtml(titleParts || "Unnamed car")}</h3>
        <div class="sub">${escapeHtml(subParts || "—")}</div>
        <div class="row"><span class="k">Buying price</span><span class="v">${money(car.buying_price)}</span></div>
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
    const { data: userData } = await sb.auth.getUser();
    const payload = {
      user_id: userData.user.id,
      make: $("#carMake").value.trim(),
      model: $("#carModel").value.trim() || null,
      year: $("#carYear").value ? Number($("#carYear").value) : null,
      vin_plate: $("#carVin").value.trim() || null,
      purchase_date: $("#carPurchaseDate").value || null,
      buying_price: $("#carBuyingPrice").value ? Number($("#carBuyingPrice").value) : 0,
      notes: $("#carNotes").value.trim() || null,
    };
    const { error } = await sb.from("cars").insert(payload);
    if (error) {
      addCarError.textContent = "Could not save the car. Please try again.";
      console.error(error);
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
    renderCarModal();
    carModal.classList.remove("hidden");
  }

  function renderCarModal() {
    const car = cars.find((c) => c.id === openCarId);
    if (!car) return closeCarModal();

    const totalCost = carTotalCost(car);
    const profit = carProfit(car);
    const costsHtml = (car.car_costs || [])
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
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
        <div class="field"><label>VIN / Plate</label><input id="editVin" value="${escapeHtml(car.vin_plate || "")}"></div>
        <div class="field"><label>Purchase date</label><input id="editPurchaseDate" type="date" value="${car.purchase_date || ""}"></div>
        <div class="field"><label>Buying price (€)</label><input id="editBuyingPrice" type="number" step="0.01" value="${car.buying_price ?? 0}"></div>
      </div>
      <div class="field"><label>Notes</label><input id="editNotes" value="${escapeHtml(car.notes || "")}"></div>
      <div style="margin-top:.6rem;">
        <button type="button" class="btn btn-sm" id="saveCarBtn">Save changes</button>
        <span id="saveCarMsg" style="font-size:.8rem;color:var(--text-muted);margin-left:.5rem;"></span>
      </div>

      <div class="costs-list">
        <h3 style="font-size:.95rem;margin-bottom:.5rem;">Additional costs</h3>
        ${costsHtml || '<div style="color:var(--text-muted);font-size:.85rem;">No extra costs added yet.</div>'}
        <div class="add-cost-row">
          <input type="text" class="lbl-input" id="newCostLabel" placeholder="e.g. Transport, repairs, registration...">
          <input type="number" step="0.01" class="amt-input" id="newCostAmount" placeholder="Amount (€)">
          <button type="button" class="btn btn-sm btn-gold" id="addCostBtn">Add</button>
        </div>
      </div>

      <div class="totals-box">
        <div class="row"><span>Buying price</span><span>${money(car.buying_price)}</span></div>
        <div class="row"><span>Additional costs</span><span>${money(totalCost - Number(car.buying_price || 0))}</span></div>
        <div class="row grand"><span>Total cost</span><span>${money(totalCost)}</span></div>
        ${
          car.status === "sold"
            ? `<div class="row"><span>Selling price</span><span>${money(car.selling_price)}</span></div>
               <div class="row profit ${profit < 0 ? "neg" : ""}"><span>Profit</span><span>${money(profit)}</span></div>`
            : ""
        }
      </div>

      <div class="modal-actions">
        ${
          car.status === "in_stock"
            ? `<button type="button" class="btn btn-gold" id="markSoldBtn">Mark as sold</button>`
            : `<button type="button" class="btn" id="markUnsoldBtn">Mark as in stock</button>`
        }
        <button type="button" class="btn btn-danger" id="deleteCarBtn">Delete car</button>
      </div>

      <div id="soldFormWrap" class="hidden" style="margin-top:1rem;border-top:1px solid var(--border-gold);padding-top:1rem;">
        <div class="grid-2">
          <div class="field"><label>Selling price (€)</label><input id="soldPrice" type="number" step="0.01"></div>
          <div class="field"><label>Sold date</label><input id="soldDate" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
        </div>
        <button type="button" class="btn btn-gold btn-sm" id="confirmSoldBtn">Confirm sale</button>
      </div>
    `;

    $("#saveCarBtn").addEventListener("click", saveCarEdits);
    $("#addCostBtn").addEventListener("click", addCostLine);
    $$("[data-remove-cost]", carModalBody).forEach((btn) =>
      btn.addEventListener("click", () => removeCostLine(btn.dataset.removeCost))
    );

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

  async function saveCarEdits() {
    const msg = $("#saveCarMsg");
    const payload = {
      make: $("#editMake").value.trim(),
      model: $("#editModel").value.trim() || null,
      year: $("#editYear").value ? Number($("#editYear").value) : null,
      vin_plate: $("#editVin").value.trim() || null,
      purchase_date: $("#editPurchaseDate").value || null,
      buying_price: $("#editBuyingPrice").value ? Number($("#editBuyingPrice").value) : 0,
      notes: $("#editNotes").value.trim() || null,
    };
    const { error } = await sb.from("cars").update(payload).eq("id", openCarId);
    if (error) {
      msg.textContent = "Save failed.";
      console.error(error);
      return;
    }
    msg.textContent = "Saved.";
    await loadCars();
    renderCarModal();
  }

  async function addCostLine() {
    const label = $("#newCostLabel").value.trim();
    const amount = Number($("#newCostAmount").value || 0);
    if (!label || !amount) return;
    const { data: userData } = await sb.auth.getUser();
    const { error } = await sb.from("car_costs").insert({
      car_id: openCarId,
      user_id: userData.user.id,
      label,
      amount,
    });
    if (error) {
      console.error(error);
      return;
    }
    await loadCars();
    renderCarModal();
  }

  async function removeCostLine(costId) {
    const { error } = await sb.from("car_costs").delete().eq("id", costId);
    if (error) {
      console.error(error);
      return;
    }
    await loadCars();
    renderCarModal();
  }

  async function confirmSold() {
    const price = $("#soldPrice").value;
    const date = $("#soldDate").value;
    if (!price) return;
    const { error } = await sb
      .from("cars")
      .update({ status: "sold", selling_price: Number(price), sold_date: date || null })
      .eq("id", openCarId);
    if (error) {
      console.error(error);
      return;
    }
    await loadCars();
    renderCarModal();
  }

  async function markUnsold() {
    const { error } = await sb
      .from("cars")
      .update({ status: "in_stock", selling_price: null, sold_date: null })
      .eq("id", openCarId);
    if (error) {
      console.error(error);
      return;
    }
    await loadCars();
    renderCarModal();
  }

  async function deleteCar() {
    if (!confirm("Delete this car and all its cost entries? This cannot be undone.")) return;
    const { error } = await sb.from("cars").delete().eq("id", openCarId);
    if (error) {
      console.error(error);
      return;
    }
    closeCarModal();
    await loadCars();
  }

  checkSession();
})();
