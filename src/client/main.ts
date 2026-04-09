import "./style.css";

const linkInput = document.getElementById("linkInput") as HTMLTextAreaElement;
const linkOutput = document.getElementById("linkOutput") as HTMLTextAreaElement;
const timeInput = document.getElementById("timeInput") as HTMLInputElement;
const standbyInput = document.getElementById("standbyInput") as HTMLTextAreaElement;
const standbyInputContainer = document.getElementById("standbyInputContainer") as HTMLDivElement;
const standbySwitch = document.getElementById("standbySwitch") as HTMLInputElement;
const proxySwitch = document.getElementById("proxySwitch") as HTMLInputElement;
const btnGenerate = document.getElementById("btnGenerate") as HTMLButtonElement;
const btnCopy = document.getElementById("btnCopy") as HTMLButtonElement;
const toast = document.getElementById("toast") as HTMLSpanElement;

// Persist & restore state
const STORAGE_KEY = "subconv_config";

function saveConfig() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      link: linkInput.value,
      time: timeInput.value,
      standby: standbySwitch.checked,
      standbyLink: standbyInput.value,
      proxy: proxySwitch.checked,
    })
  );
}

function restoreConfig() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const cfg = JSON.parse(raw);
    if (cfg.link != null) linkInput.value = cfg.link;
    if (cfg.time != null) timeInput.value = cfg.time;
    if (cfg.standby != null) {
      standbySwitch.checked = cfg.standby;
      standbyInputContainer.classList.toggle("hidden", !cfg.standby);
    }
    if (cfg.standbyLink != null) standbyInput.value = cfg.standbyLink;
    if (cfg.proxy != null) proxySwitch.checked = cfg.proxy;
  } catch {
    // ignore malformed data
  }
}

restoreConfig();

linkInput.addEventListener("input", saveConfig);
linkInput.addEventListener("change", saveConfig);
timeInput.addEventListener("input", saveConfig);
timeInput.addEventListener("change", saveConfig);
standbyInput.addEventListener("input", saveConfig);
standbyInput.addEventListener("change", saveConfig);
proxySwitch.addEventListener("change", saveConfig);

// Toggle standby textarea visibility
standbySwitch.addEventListener("change", () => {
  standbyInputContainer.classList.toggle("hidden", !standbySwitch.checked);
  saveConfig();
});

// Generate subscription link
btnGenerate.addEventListener("click", () => {
  if (!linkInput.value.trim()) {
    linkInput.focus();
    linkInput.classList.add("ring-2", "ring-red-400", "border-transparent");
    setTimeout(() => linkInput.classList.remove("ring-2", "ring-red-400", "border-transparent"), 1500);
    return;
  }

  let result = `${location.protocol}//${location.host}/sub?url=${encodeURIComponent(linkInput.value)}`;

  const time = timeInput.value.trim();
  if (time !== "") {
    if (/^[1-9][0-9]*$/.test(time)) {
      result += `&interval=${time}`;
    } else {
      timeInput.focus();
      timeInput.classList.add("ring-2", "ring-red-400", "border-transparent");
      setTimeout(() => timeInput.classList.remove("ring-2", "ring-red-400", "border-transparent"), 1500);
      return;
    }
  }

  if (standbySwitch.checked && standbyInput.value.trim()) {
    result += `&urlstandby=${encodeURIComponent(standbyInput.value)}`;
  }

  if (!proxySwitch.checked) {
    result += "&npr=1";
  }

  linkOutput.value = result;
});

// Copy to clipboard
let toastTimer: ReturnType<typeof setTimeout> | undefined;
btnCopy.addEventListener("click", () => {
  if (!linkOutput.value) return;
  navigator.clipboard.writeText(linkOutput.value).then(() => {
    toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 2000);
  });
});
