(() => {
  const STORAGE_KEY = "plate-diary-entries";
  const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"];
  const MAX_PHOTO_SIZE = 600;

  const $ = (id) => document.getElementById(id);

  // Format a Date as YYYY-MM-DD in local time.
  const toISODate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toISODate(d);
  };

  const formatDate = (iso) =>
    new Date(iso + "T00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  const sampleEntries = () => [
    { id: "s1", date: daysAgo(0), caption: "Avocado toast with chili flakes", meal: "Breakfast", rating: 4, emoji: "🥑", hue: 95 },
    { id: "s2", date: daysAgo(1), caption: "Spicy miso ramen downtown", meal: "Dinner", rating: 5, emoji: "🍜", hue: 20 },
    { id: "s3", date: daysAgo(3), caption: "Grandma's apple cake", meal: "Snack", rating: 5, emoji: "🍰", hue: 40 },
  ];

  // Storage can be unavailable (private mode, blocked site data); fall back to memory.
  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* fall through to samples */ }
    return sampleEntries();
  };

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      return true;
    } catch (e) {
      return false;
    }
  };

  let entries = load();
  const state = {
    view: "feed",
    mealFilter: "All",
    dayFilter: null,
    calMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    draft: { photo: null, meal: "Lunch", rating: 4 },
  };

  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    Object.assign(node, props);
    for (const child of [].concat(children)) {
      node.append(child instanceof Node ? child : document.createTextNode(child));
    }
    return node;
  };

  const placeholderBg = (hue) =>
    `linear-gradient(135deg, hsl(${hue} 80% 82%), hsl(${hue + 30} 70% 68%))`;

  // Newest date first; on the same date, the most recently added entry first (sort is stable).
  const sortedEntries = () =>
    [...entries].reverse().sort((a, b) => b.date.localeCompare(a.date));

  /* ---------- Views ---------- */

  function showView(name) {
    state.view = name;
    for (const v of ["feed", "calendar", "add"]) $(`view-${v}`).hidden = v !== name;
    document.querySelectorAll(".tab-bar button").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === name);
    });
    document.querySelector(".app-body").scrollTop = 0;
    render();
  }

  function render() {
    $("app-count").textContent = `${entries.length} meal${entries.length === 1 ? "" : "s"}`;
    if (state.view === "feed") renderFeed();
    if (state.view === "calendar") renderCalendar();
  }

  function renderChips() {
    const chips = $("chips");
    chips.replaceChildren(
      ...["All", ...MEALS].map((meal) => {
        const chip = el("button", { type: "button", className: "chip", textContent: meal });
        chip.setAttribute("aria-pressed", String(state.mealFilter === meal));
        chip.addEventListener("click", () => {
          state.mealFilter = meal;
          renderFeed();
        });
        return chip;
      })
    );
  }

  function renderFeed() {
    renderChips();

    $("day-filter").hidden = !state.dayFilter;
    if (state.dayFilter) $("day-filter-label").textContent = `Showing ${formatDate(state.dayFilter)}`;

    const visible = sortedEntries().filter(
      (e) =>
        (state.mealFilter === "All" || e.meal === state.mealFilter) &&
        (!state.dayFilter || e.date === state.dayFilter)
    );

    $("feed").replaceChildren(...visible.map(renderEntry));
    $("feed-empty").hidden = visible.length > 0;
  }

  function renderEntry(entry) {
    const photo = entry.photo
      ? el("img", { className: "entry-photo", src: entry.photo, alt: entry.caption })
      : el("div", { className: "entry-photo", textContent: entry.emoji || "🍽️" });
    if (!entry.photo) photo.style.background = placeholderBg(entry.hue ?? 30);

    const del = el("button", { type: "button", className: "delete-btn", textContent: "✕", title: "Delete" });
    del.setAttribute("aria-label", `Delete ${entry.caption}`);
    del.addEventListener("click", () => {
      entries = entries.filter((e) => e.id !== entry.id);
      save();
      render();
    });

    const stars = "★".repeat(entry.rating) + "☆".repeat(5 - entry.rating);

    return el("li", { className: "entry" }, [
      photo,
      el("div", { className: "entry-body" }, [
        el("div", { className: "entry-top" }, [el("p", { className: "entry-caption", textContent: entry.caption }), del]),
        el("div", { className: "entry-meta" }, [
          el("span", { className: "tag", textContent: entry.meal }),
          el("span", { className: "entry-stars", textContent: stars }),
          el("span", { textContent: formatDate(entry.date) }),
        ]),
      ]),
    ]);
  }

  function renderCalendar() {
    const month = state.calMonth;
    $("cal-title").textContent = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    const byDate = {};
    for (const e of sortedEntries()) (byDate[e.date] ||= []).push(e);

    const firstWeekday = month.getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const today = toISODate(new Date());
    const cells = [];

    for (let i = 0; i < firstWeekday; i++) cells.push(el("div", { className: "cal-day blank" }));

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = toISODate(new Date(month.getFullYear(), month.getMonth(), day));
      const dayEntries = byDate[iso] || [];
      const cell = el("button", { type: "button", className: "cal-day" }, [el("span", { className: "cal-num", textContent: day })]);
      if (iso === today) cell.classList.add("today");

      if (dayEntries.length) {
        const top = dayEntries[0];
        cell.classList.add("has-entry");
        if (top.photo) {
          cell.style.backgroundImage = `url(${top.photo})`;
        } else {
          cell.style.background = placeholderBg(top.hue ?? 30);
          cell.append(el("span", { className: "cal-emoji", textContent: top.emoji || "🍽️" }));
        }
        if (dayEntries.length > 1) cell.append(el("span", { className: "cal-badge", textContent: dayEntries.length }));
        cell.setAttribute("aria-label", `${formatDate(iso)}: ${dayEntries.length} meal${dayEntries.length > 1 ? "s" : ""}`);
        cell.addEventListener("click", () => {
          state.dayFilter = iso;
          state.mealFilter = "All";
          showView("feed");
        });
      } else {
        cell.disabled = true;
      }
      cells.push(cell);
    }

    $("cal-grid").replaceChildren(...cells);
  }

  /* ---------- Add form ---------- */

  function renderPickers() {
    $("meal-picker").replaceChildren(
      ...MEALS.map((meal) => {
        const b = el("button", { type: "button", className: "chip", textContent: meal });
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", String(state.draft.meal === meal));
        b.setAttribute("aria-pressed", String(state.draft.meal === meal));
        b.addEventListener("click", () => {
          state.draft.meal = meal;
          renderPickers();
        });
        return b;
      })
    );

    $("star-picker").replaceChildren(
      ...[1, 2, 3, 4, 5].map((n) => {
        const b = el("button", { type: "button", textContent: "★", className: n <= state.draft.rating ? "on" : "" });
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", String(state.draft.rating === n));
        b.setAttribute("aria-label", `${n} star${n > 1 ? "s" : ""}`);
        b.addEventListener("click", () => {
          state.draft.rating = n;
          renderPickers();
        });
        return b;
      })
    );
  }

  // Downscale the chosen image so entries stay small enough for localStorage.
  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_PHOTO_SIZE / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read that image."));
      };
      img.src = url;
    });
  }

  function resetForm() {
    $("add-form").reset();
    state.draft = { photo: null, meal: "Lunch", rating: 4 };
    $("photo-preview").hidden = true;
    $("photo-preview").removeAttribute("src");
    $("photo-hint").hidden = false;
    $("date").value = toISODate(new Date());
    $("form-error").hidden = true;
    renderPickers();
  }

  function showError(message) {
    $("form-error").textContent = message;
    $("form-error").hidden = false;
  }

  $("photo-input").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      state.draft.photo = await resizeImage(file);
      $("photo-preview").src = state.draft.photo;
      $("photo-preview").hidden = false;
      $("photo-hint").hidden = true;
      $("form-error").hidden = true;
    } catch (err) {
      showError(err.message);
    }
  });

  $("add-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const caption = $("caption").value.trim();
    if (!caption) return showError("Add a short caption.");

    const entry = {
      id: String(Date.now()),
      date: $("date").value || toISODate(new Date()),
      caption,
      meal: state.draft.meal,
      rating: state.draft.rating,
      photo: state.draft.photo,
      emoji: "🍽️",
      hue: Math.floor(Math.random() * 60),
    };
    entries.push(entry);

    if (!save() && entry.photo) {
      // Most likely the storage quota; keep the entry for this session only.
      console.warn("Plate Diary: could not save to localStorage; entry kept in memory.");
    }

    state.mealFilter = "All";
    state.dayFilter = null;
    const d = new Date(entry.date + "T00:00");
    state.calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    resetForm();
    showView("feed");
  });

  /* ---------- Wiring ---------- */

  document.querySelectorAll(".tab-bar button").forEach((b) => {
    b.addEventListener("click", () => showView(b.dataset.view));
  });

  $("day-filter-clear").addEventListener("click", () => {
    state.dayFilter = null;
    renderFeed();
  });

  $("cal-prev").addEventListener("click", () => {
    state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() - 1, 1);
    renderCalendar();
  });

  $("cal-next").addEventListener("click", () => {
    state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + 1, 1);
    renderCalendar();
  });

  $("reset-demo").addEventListener("click", () => {
    entries = sampleEntries();
    save();
    state.mealFilter = "All";
    state.dayFilter = null;
    state.calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    resetForm();
    showView("feed");
  });

  resetForm();
  render();
})();
