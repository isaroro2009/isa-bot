// IsaBot extension — service worker (MV3).
// Por ahora solo escucha instalación para dar la bienvenida.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ installedAt: Date.now() });
});
