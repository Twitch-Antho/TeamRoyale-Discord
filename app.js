(() => {
  const config = window.LEADERBOARD_CONFIG || {};
  const apiUrl = String(config.apiUrl || "").replace(/\/+$/, "");
  const ranking = document.getElementById("ranking");
  const status = document.getElementById("status");
  const periodLabel = document.getElementById("period-label");
  const memberCount = document.getElementById("member-count");
  const monthPicker = document.getElementById("month-picker");
  const yearPicker = document.getElementById("year-picker");
  const monthControl = document.getElementById("month-control");
  const yearControl = document.getElementById("year-control");
  const periodButtons = [...document.querySelectorAll("[data-period]")];
  const parisParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(new Date());
  const currentMonth = `${parisParts.find(part => part.type === "year").value}-${parisParts.find(part => part.type === "month").value}`;
  let period = "month";
  let requestNumber = 0;

  monthPicker.value = currentMonth;
  yearPicker.value = currentMonth.slice(0, 4);

  const query = new URLSearchParams(window.location.search);
  const requestedPeriod = query.get("period");
  const requestedKey = query.get("key");
  if (requestedPeriod === "year" && /^\d{4}$/.test(requestedKey || "")) {
    period = "year";
    yearPicker.value = requestedKey;
  } else if (requestedPeriod === "month" && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedKey || "")) {
    monthPicker.value = requestedKey;
  }

  function getKey() {
    return period === "month" ? monthPicker.value : yearPicker.value;
  }

  function formatPeriod(key) {
    if (period === "year") return key;
    const [year, month] = key.split("-").map(Number);
    return new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
      timeZone: "Europe/Paris"
    }).format(new Date(Date.UTC(year, month - 1, 15)));
  }

  function formatDuration(milliseconds) {
    const totalMinutes = Math.floor(milliseconds / 60_000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days) return `${days} j ${hours} h`;
    if (hours) return `${hours} h ${String(minutes).padStart(2, "0")} min`;
    if (minutes) return `${minutes} min`;
    return `${Math.max(1, Math.floor(milliseconds / 1000))} s`;
  }

  function showStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
    status.classList.remove("is-hidden");
    ranking.replaceChildren();
    memberCount.textContent = "";
  }

  function renderScores(data) {
    const scores = Array.isArray(data.scores) ? data.scores : [];
    periodLabel.textContent = formatPeriod(data.key);
    memberCount.textContent = `${scores.length} ${scores.length === 1 ? "membre" : "membres"}`;
    status.classList.add("is-hidden");
    ranking.replaceChildren();

    if (!scores.length) {
      showStatus("Aucun temps vocal enregistré pour cette période.");
      return;
    }

    const maximum = Math.max(...scores.map(score => Number(score.milliseconds) || 0));
    scores.forEach((score, index) => {
      const item = document.createElement("li");
      item.className = `rank-item${index < 3 ? ` rank-${index + 1}` : ""}`;

      const number = document.createElement("span");
      number.className = "rank-number";
      number.textContent = String(index + 1).padStart(2, "0");

      const info = document.createElement("div");
      info.className = "rank-info";
      const name = document.createElement("span");
      name.className = "rank-name";
      name.textContent = score.displayName || "Membre";

      const meter = document.createElement("div");
      meter.className = "rank-meter";
      meter.setAttribute("aria-hidden", "true");
      const fill = document.createElement("span");
      const proportion = maximum > 0 ? (Number(score.milliseconds) / maximum) * 100 : 0;
      fill.style.width = `${Math.max(3, Math.min(100, proportion))}%`;
      meter.append(fill);
      info.append(name, meter);

      const duration = document.createElement("span");
      duration.className = "rank-score";
      duration.textContent = formatDuration(Number(score.milliseconds) || 0);

      item.append(number, info, duration);
      ranking.append(item);
    });
  }

  async function loadScores() {
    const currentRequest = ++requestNumber;
    const key = getKey();
    periodLabel.textContent = key ? formatPeriod(key) : "Période invalide";

    if (!apiUrl) {
      showStatus("Configure l’URL HTTPS de l’API du bot dans docs/config.js pour afficher les scores.", true);
      return;
    }
    if (!key || (period === "month" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) ||
      (period === "year" && !/^\d{4}$/.test(key))) {
      showStatus("Choisis une période valide.", true);
      return;
    }

    showStatus("Chargement du classement…");
    try {
      const url = new URL(`${apiUrl}/api/leaderboard`);
      url.searchParams.set("period", period);
      url.searchParams.set("key", key);
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`L’API a répondu avec le code ${response.status}.`);
      const data = await response.json();
      if (currentRequest === requestNumber) renderScores(data);
    } catch (error) {
      if (currentRequest === requestNumber) {
        showStatus(`Impossible de charger le classement : ${error.message}`, true);
      }
    }
  }

  function setPeriod(nextPeriod) {
    period = nextPeriod;
    periodButtons.forEach(button => {
      const selected = button.dataset.period === period;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    monthControl.classList.toggle("is-hidden", period !== "month");
    yearControl.classList.toggle("is-hidden", period !== "year");
    loadScores();
  }

  periodButtons.forEach(button => {
    button.addEventListener("click", () => setPeriod(button.dataset.period));
  });
  monthPicker.addEventListener("change", loadScores);
  yearPicker.addEventListener("change", loadScores);
  setPeriod(period);
})();
