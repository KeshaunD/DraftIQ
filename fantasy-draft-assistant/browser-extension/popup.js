const STORAGE_KEY_HIDDEN = "draftCopilotHidden";
const toggleEl = document.getElementById("toggle");

function render(hidden) {
  toggleEl.classList.toggle("on", !hidden);
  toggleEl.setAttribute("aria-checked", String(!hidden));
}

chrome.storage.local.get([STORAGE_KEY_HIDDEN], (res) => {
  render(!!res[STORAGE_KEY_HIDDEN]);
});

toggleEl.addEventListener("click", () => {
  chrome.storage.local.get([STORAGE_KEY_HIDDEN], (res) => {
    const nextHidden = !res[STORAGE_KEY_HIDDEN];
    chrome.storage.local.set({ [STORAGE_KEY_HIDDEN]: nextHidden });
    render(nextHidden);
  });
});
