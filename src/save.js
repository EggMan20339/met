// ---- Persistence (localStorage) ---------------------------------------------
const SAVE_KEY = 'glimmerdeep_save_v1';
function saveGame(data) {
  if (!IS_BROWSER) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* ignore quota / privacy errors */ }
}
function loadGame() {
  if (!IS_BROWSER) return null;
  try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function clearSave() { if (!IS_BROWSER) return; try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
