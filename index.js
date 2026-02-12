function pad(value) {
  return String(value).padStart(2, "0");
}

function ordinal(value) {
  const remainder100 = value % 100;

  if (remainder100 >= 11 && remainder100 <= 13) {
    return `${value}th`;
  }

  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

function getMonthNames(locale = "en-US") {
  return Array.from({ length: 12 }, (_, i) =>
    new Date(2020, i, 1).toLocaleString(locale, { month: "long" })
  );
}

function getShortMonthNames(locale = "en-US") {
  return Array.from({ length: 12 }, (_, i) =>
    new Date(2020, i, 1).toLocaleString(locale, { month: "short" })
  );
}

function getWeekdayNames(locale = "en-US") {
  return Array.from({ length: 7 }, (_, i) =>
    new Date(2020, 5, 7 + i).toLocaleString(locale, { weekday: "long" })
  );
}

function getShortWeekdayNames(locale = "en-US") {
  return Array.from({ length: 7 }, (_, i) =>
    new Date(2020, 5, 7 + i).toLocaleString(locale, { weekday: "short" })
  );
}

function formatDateByPattern(date, pattern) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const shortMonths = getShortMonthNames();
  const longMonths = getMonthNames();
  const shortWeekdays = getShortWeekdayNames();
  const longWeekdays = getWeekdayNames();

  const tokenMap = {
    yyyy: `${year}`,
    YYYY: `${year}`,
    yy: `${year}`.slice(-2),
    MM: pad(month),
    M: `${month}`,
    dd: pad(day),
    d: `${day}`,
    do: ordinal(day),
    MMMM: longMonths[month - 1],
    MMM: shortMonths[month - 1],
    EEEE: longWeekdays[date.getDay()],
    EEE: shortWeekdays[date.getDay()],
  };

  const knownTokens = Object.keys(tokenMap).sort((a, b) => b.length - a.length);
  const tokenRegex = new RegExp(knownTokens.join("|"), "g");

  return pattern.replace(tokenRegex, (token) => tokenMap[token] || token);
}

async function getPreferredDateFormat() {
  try {
    const config = await logseq.App.getUserConfigs();
    return config?.preferredDateFormat || "yyyy-MM-dd";
  } catch (error) {
    console.error("Could not load preferredDateFormat", error);
    return "yyyy-MM-dd";
  }
}

async function openJournalByDate(dateText) {
  const pickedDate = new Date(`${dateText}T12:00:00`);

  if (Number.isNaN(pickedDate.getTime())) {
    logseq.App.showMsg("Ungültiges Datum", "warning");
    return;
  }

  const format = await getPreferredDateFormat();
  const pageName = formatDateByPattern(pickedDate, format);

  try {
    await logseq.Editor.createPage(pageName, {}, { redirect: true, createFirstBlock: false });
  } catch (error) {
    console.error("Could not open journal page", error);
    logseq.App.showMsg(`Konnte Journal nicht öffnen: ${pageName}`, "error");
  }
}

function ensureCalendarContainer() {
  let panel = document.getElementById("datepicker-journal-panel");

  if (panel) {
    return panel;
  }

  panel = document.createElement("div");
  panel.id = "datepicker-journal-panel";
  panel.innerHTML = `
    <div class="datepicker-journal-inner">
      <div class="datepicker-journal-header">Journal-Datum wählen</div>
      <input id="datepicker-journal-input" type="date" />
      <button id="datepicker-journal-open">Zum Eintrag springen</button>
    </div>
  `;

  document.body.appendChild(panel);

  const openButton = panel.querySelector("#datepicker-journal-open");
  const input = panel.querySelector("#datepicker-journal-input");

  openButton?.addEventListener("click", async () => {
    if (!input || !input.value) {
      logseq.App.showMsg("Bitte ein Datum auswählen", "warning");
      return;
    }

    await openJournalByDate(input.value);
    panel.classList.remove("is-visible");
  });

  return panel;
}

function toggleCalendarPanel() {
  const panel = ensureCalendarContainer();
  panel.classList.toggle("is-visible");

  if (panel.classList.contains("is-visible")) {
    const input = panel.querySelector("#datepicker-journal-input");
    if (input && !input.value) {
      input.valueAsDate = new Date();
    }
    input?.focus();
  }
}

function registerToolbarButton() {
  logseq.App.registerUIItem("toolbar", {
    key: "datepicker-journal-trigger",
    template: `
      <a class="button" id="datepicker-journal-trigger" title="Journal via Kalender öffnen">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      </a>
    `,
  });

  const bindClick = () => {
    const button = parent.document.getElementById("datepicker-journal-trigger");
    if (!button) {
      setTimeout(bindClick, 250);
      return;
    }

    button.addEventListener("click", (event) => {
      event.preventDefault();
      toggleCalendarPanel();
    });
  };

  bindClick();
}

function provideStyles() {
  logseq.provideStyle(`
    #datepicker-journal-panel {
      position: fixed;
      top: 56px;
      right: 16px;
      z-index: 9999;
      display: none;
      min-width: 240px;
      background: var(--ls-primary-background-color, #fff);
      border: 1px solid var(--ls-border-color, #ddd);
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
      padding: 12px;
    }

    #datepicker-journal-panel.is-visible {
      display: block;
    }

    .datepicker-journal-inner {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .datepicker-journal-header {
      font-size: 14px;
      font-weight: 600;
    }

    #datepicker-journal-open {
      border: 1px solid var(--ls-border-color, #ccc);
      border-radius: 6px;
      padding: 6px 10px;
      background: var(--ls-secondary-background-color, #f7f7f7);
      cursor: pointer;
      font-size: 12px;
    }

    #datepicker-journal-open:hover {
      opacity: 0.9;
    }

    #datepicker-journal-input {
      width: 100%;
      border: 1px solid var(--ls-border-color, #ccc);
      border-radius: 6px;
      padding: 6px;
      background: var(--ls-primary-background-color, #fff);
      color: var(--ls-primary-text-color, #222);
    }
  `);
}

function main() {
  provideStyles();
  registerToolbarButton();
  console.log("logseq-datepicker-plugin loaded");
}

logseq.ready(main).catch(console.error);
