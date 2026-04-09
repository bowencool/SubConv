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

// Toggle standby textarea visibility
standbySwitch.addEventListener("change", () => {
  standbyInputContainer.classList.toggle("hidden", !standbySwitch.checked);
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
