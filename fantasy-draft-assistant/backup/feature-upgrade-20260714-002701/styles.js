const DRAFT_COPILOT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');

:host { all: initial; }
* { box-sizing: border-box; }

.dc-root {
  position: fixed;
  inset: 0;
  font-family: 'Inter', system-ui, sans-serif;
  color: #F5F7FA;
  z-index: 2147483647;
  pointer-events: none;
}

/* MAIN PLAYER LIST WINDOW */

.dc-window {
  position: fixed;
  top: 18px;
  right: 18px;
  width: 500px;
  height: 760px;
  max-width: 92vw;
  max-height: 88vh;
  background: linear-gradient(180deg, #0A1116 0%, #070C10 100%);
  border: 1px solid #2C3942;
  border-radius: 16px;
  overflow: hidden;
  box-shadow:
    0 28px 70px rgba(0,0,0,0.62),
    0 0 0 1px rgba(255,255,255,0.025) inset;
  display: grid;
  grid-template-rows: 56px 1fr;
  pointer-events: auto;
}

.dc-root.dc-hidden .dc-window,
.dc-root.dc-hidden .dc-profile-window {
  display: none;
}

.dc-float-tab {
  position: fixed;
  right: 18px;
  bottom: 72px;
  background: #111920;
  border: 1px solid #2B363C;
  color: #F5F7FA;
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 9px 14px;
  border-radius: 999px;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 12px 30px rgba(0,0,0,0.35);
  display: none;
}

.dc-root.dc-hidden .dc-float-tab {
  display: block;
}

.dc-header {
  grid-row: 1;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px 0 16px;
  border-bottom: 1px solid #202D35;
  background: linear-gradient(180deg, #0B1218 0%, #080D12 100%);
  cursor: move;
  user-select: none;
}

.dc-wordmark {
  font-weight: 800;
  font-size: 23px;
  letter-spacing: -0.04em;
  color: #F5F7FA;
}

.dc-wordmark span {
  color: #F3B83F;
}

.dc-header-actions {
  display: flex;
  align-items: center;
  gap: 7px;
}

.dc-reset-btn,
.dc-refresh-btn {
  height: 30px;
  border: 1px solid #2B3942;
  border-radius: 8px;
  background: #111A20;
  color: #CBD3D8;
  cursor: pointer;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 700;
  transition:
    color 120ms ease,
    border-color 120ms ease,
    background 120ms ease,
    transform 120ms ease;
}

.dc-reset-btn {
  padding: 0 11px;
  color: #AEB8BE;
}

.dc-refresh-btn {
  width: 30px;
  padding: 0;
  font-size: 16px;
}

.dc-reset-btn:hover,
.dc-refresh-btn:hover {
  color: #FFFFFF;
  border-color: #52616B;
  background: #172229;
  transform: translateY(-1px);
}

.dc-reset-btn:focus-visible,
.dc-refresh-btn:focus-visible,
.dc-collapse-btn:focus-visible {
  outline: 2px solid rgba(243, 184, 63, 0.85);
  outline-offset: 2px;
}

.dc-refresh-btn:disabled {
  cursor: wait;
  opacity: 0.65;
  transform: none;
}

.dc-refreshing .dc-refresh-icon {
  display: inline-block;
  animation: dc-spin 850ms linear infinite;
}

@keyframes dc-spin {
  to { transform: rotate(360deg); }
}

.dc-collapse-btn,
.dc-profile-close {
  background: #111920;
  border: 1px solid #26323A;
  color: #A7B0B6;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
}

.dc-collapse-btn:hover,
.dc-profile-close:hover {
  border-color: #F3B83F;
  color: #FFFFFF;
}

.dc-left-panel {
  grid-row: 2;
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto auto 1fr auto;
  background: #080D11;
}

/* CONTROLS */

.dc-controls {
  background: #080D11;
  padding: 13px 12px 11px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dc-search {
  width: 100%;
  height: 40px;
  background: #0E171D;
  border: 1px solid #293740;
  border-radius: 10px;
  padding: 0 12px;
  color: #F5F7FA;
  font-size: 13px;
  outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.dc-search::placeholder {
  color: #76828A;
}

.dc-search:focus {
  border-color: #F3B83F;
  box-shadow: 0 0 0 3px rgba(243, 184, 63, 0.10);
}

.dc-chips {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 7px;
}

.dc-chip {
  height: 34px;
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 9px;
  color: #FFFFFF;
  cursor: pointer;
  text-transform: uppercase;
  font-weight: 800;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: filter 120ms ease, transform 120ms ease, box-shadow 120ms ease;
}

.dc-chip[data-pos="ALL"] { background: #182229; }
.dc-chip[data-pos="QB"] { background: #9B42C8; }
.dc-chip[data-pos="RB"] { background: #1EA085; }
.dc-chip[data-pos="WR"] { background: #F0821F; }
.dc-chip[data-pos="TE"] { background: #2E88C8; }

.dc-chip.dc-chip-active {
  box-shadow: inset 0 0 0 2px rgba(255,255,255,0.52);
  filter: brightness(1.08);
}

.dc-chip:hover {
  filter: brightness(1.12);
  transform: translateY(-1px);
}

/* ROSTER-AWARE RECOMMENDATION */

.dc-recommendation {
  position: relative;
  overflow: hidden;
  margin: 0 12px 12px;
  padding: 13px 14px 12px;
  border: 1px solid rgba(243, 184, 63, 0.34);
  border-radius: 12px;
  background:
    radial-gradient(circle at 100% 0%, rgba(243, 184, 63, 0.12), transparent 42%),
    linear-gradient(135deg, #151B1D 0%, #0E161B 58%, #0B1217 100%);
  box-shadow:
    0 10px 24px rgba(0,0,0,0.22),
    0 1px 0 rgba(255,255,255,0.035) inset;
}

.dc-recommendation::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: linear-gradient(180deg, #F7CA62, #F3B83F 55%, #B87810);
}

.dc-rec-empty {
  padding: 6px 2px;
  color: #8F9BA3;
  font-size: 12px;
  text-align: center;
}

.dc-rec-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.dc-rec-eyebrow {
  margin-bottom: 3px;
  color: #E7B74D;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.09em;
  line-height: 1.25;
  text-transform: uppercase;
}

.dc-rec-title {
  color: #FFFFFF;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.025em;
  line-height: 1.2;
}

.dc-rec-view {
  flex: 0 0 auto;
  height: 29px;
  padding: 0 11px;
  border: 1px solid rgba(243, 184, 63, 0.52);
  border-radius: 8px;
  background: rgba(243, 184, 63, 0.10);
  color: #F6CA67;
  cursor: pointer;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 800;
  transition: background 120ms ease, color 120ms ease, transform 120ms ease;
}

.dc-rec-view:hover {
  background: #F3B83F;
  color: #111518;
  transform: translateY(-1px);
}

.dc-rec-player-line {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 9px;
  color: #CDD5DA;
  font-size: 11px;
  font-weight: 600;
}

.dc-rec-reason {
  margin-top: 7px;
  color: #F2F5F6;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
}

.dc-rec-roster {
  margin-top: 9px;
  padding: 7px 9px;
  border: 1px solid #25333C;
  border-radius: 8px;
  background: rgba(5, 10, 14, 0.48);
  color: #AEBAC1;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  font-weight: 600;
  line-height: 1.35;
  text-align: center;
}

.dc-rec-alternatives {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 9px;
  color: #8F9BA3;
  font-size: 10px;
  font-weight: 600;
}

.dc-rec-alt {
  min-height: 25px;
  padding: 3px 9px;
  border: 1px solid #2B3942;
  border-radius: 999px;
  background: #121C22;
  color: #DDE3E6;
  cursor: pointer;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 10px;
  font-weight: 700;
  transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
}

.dc-rec-alt:hover {
  border-color: rgba(243, 184, 63, 0.65);
  background: rgba(243, 184, 63, 0.09);
  color: #F7CA62;
}

/* PLAYER TABLE */

.dc-table-header {
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr) 56px 64px 18px;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 10px;
  color: #F5F7FA;
  font-weight: 800;
  font-size: 12px;
  background: #0B1217;
  border-bottom: 1px solid #1E2A32;
}

.dc-table-header div:first-child {
  grid-column: 1 / 3;
}

.dc-table-header div:nth-child(2),
.dc-table-header div:nth-child(3) {
  text-align: right;
}

.dc-list {
  min-height: 0;
  overflow-y: auto;
  background: #080D11;
}

.dc-card {
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr) 56px 64px 18px;
  align-items: center;
  gap: 6px;
  min-height: 68px;
  padding: 7px 10px;
  border-bottom: 1px solid #1C262D;
  background: #080D11;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: background 120ms ease, border-color 120ms ease;
}

.dc-card:hover {
  background: #121A20;
  border-left-color: rgba(243, 184, 63, 0.45);
}

.dc-card.dc-selected {
  background: #141D24;
  border-left-color: #F3B83F;
}

.dc-card.dc-drafted {
  opacity: 0.35;
}

.dc-card.dc-drafted .dc-card-name {
  text-decoration: line-through;
}

.dc-card-rank {
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  color: #FFFFFF;
}

.dc-star {
  color: #A5AFB7;
  font-size: 17px;
  line-height: 1;
}

.dc-card-main {
  min-width: 0;
}

.dc-card-name {
  color: #FFFFFF;
  font-weight: 800;
  font-size: 13px;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dc-card-meta {
  margin-top: 3px;
  font-size: 11px;
  color: #B5BEC4;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.dc-card-adp,
.dc-card-proj {
  font-family: 'IBM Plex Mono', monospace;
  color: #FFFFFF;
  font-size: 12px;
  font-weight: 600;
  text-align: right;
}

.dc-card-arrow {
  color: #FFFFFF;
  font-size: 13px;
  text-align: center;
}

.dc-no-results {
  padding: 18px;
  color: #8D98A0;
  font-size: 13px;
}

/* POSITION BADGES */

.dc-pos {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 25px;
  height: 17px;
  padding: 0 5px;
  border-radius: 5px;
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
}

.dc-pos-QB { background: #9B42C8; }
.dc-pos-RB { background: #1EA085; }
.dc-pos-WR { background: #F0821F; }
.dc-pos-TE { background: #2E88C8; }
.dc-pos-K,
.dc-pos-PK { background: #77818A; }
.dc-pos-DEF,
.dc-pos-DST { background: #55616B; }

/* SEPARATE PROFILE WINDOW */

.dc-profile-window {
  position: fixed;
  top: 18px;
  right: 536px;
  width: 560px;
  height: 720px;
  max-width: 92vw;
  max-height: 88vh;
  background: #080D11;
  border: 1px solid #26323A;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 22px 60px rgba(0,0,0,0.58);
  pointer-events: auto;
}

.dc-profile-window.dc-profile-hidden {
  display: none;
}

.dc-profile {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  background: radial-gradient(circle at top right, #111C24, #080D11 58%);
  padding: 16px 18px 18px;
}

.dc-profile-header {
  display: grid;
  grid-template-columns: 108px minmax(0, 1fr) 30px;
  gap: 13px;
  align-items: start;
  padding-bottom: 14px;
  border-bottom: 1px solid #26323A;
  margin-bottom: 14px;
  cursor: move;
  user-select: none;
}

.dc-profile-close {
  cursor: pointer;
}

.dc-profile-image {
  width: 108px;
  height: 76px;
  object-fit: cover;
  object-position: top center;
  border-radius: 0;
  background: #141B20;
}

.dc-profile-player {
  min-width: 0;
}

.dc-profile-name {
  color: #FFFFFF;
  font-size: 23px;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.dc-profile-meta {
  margin-top: 6px;
  font-size: 14px;
  color: #B7C0C6;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.dc-profile-section-title {
  margin: 14px 0 10px;
  font-size: 17px;
  font-weight: 600;
  color: #FFFFFF;
  letter-spacing: -0.02em;
}

.dc-profile-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
  margin-bottom: 16px;
}

.dc-profile-stat {
  min-height: 78px;
  background: linear-gradient(180deg, #111920, #0D141A);
  border: 1px solid #26323A;
  border-radius: 7px;
  padding: 10px 6px;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.dc-profile-stat-value {
  font-size: 21px;
  font-weight: 800;
  color: #FFFFFF;
}

.dc-profile-stat-label {
  margin-top: 6px;
  font-size: 11px;
  color: #D3D8DC;
}

/* GRAPH */

.dc-profile-graph {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  min-height: 190px;
  padding: 10px 6px 8px;
  background: transparent;
  border: none;
  margin-bottom: 14px;
}

.dc-graph-item {
  flex: 1;
  min-width: 0;
  height: 165px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}

.dc-graph-value {
  margin-bottom: 6px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  font-weight: 800;
  color: #FFFFFF;
  line-height: 1;
}

.dc-graph-bar {
  width: 100%;
  min-height: 8px;
  border-radius: 4px;
  transition: transform 120ms ease;
}

.dc-graph-bar:hover {
  transform: scaleY(1.06);
}

.dc-graph-bar-bad {
  background: linear-gradient(180deg, #FF4D4D, #D93636);
}

.dc-graph-bar-mid {
  background: linear-gradient(180deg, #F6C74A, #DFA728);
}

.dc-graph-bar-good {
  background: linear-gradient(180deg, #35D06F, #168B50);
}

.dc-graph-week {
  margin-top: 7px;
  font-size: 10px;
  color: #ADB6BC;
  font-family: 'IBM Plex Mono', monospace;
  white-space: nowrap;
}

.dc-profile-note {
  font-size: 13px;
  color: #8D98A0;
  line-height: 1.45;
  margin-top: 10px;
  text-align: center;
}

/* OUTLOOK */

.dc-outlook {
  margin-top: 6px;
}

.dc-outlook-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
}

.dc-outlook-grid > div {
  background: #111920;
  border: 1px solid #26323A;
  border-radius: 7px;
  padding: 10px 8px;
}

.dc-outlook-label {
  color: #8D98A0;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}

.dc-outlook-value {
  color: #FFFFFF;
  font-size: 14px;
  font-weight: 800;
}

/* SOURCE BREAKDOWN */

.dc-source-breakdown {
  margin-top: 16px;
}

.dc-source-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 7px;
}

.dc-source-card {
  background: #111920;
  border: 1px solid #26323A;
  border-radius: 7px;
  padding: 10px 9px;
}

.dc-source-card-master {
  border-color: rgba(243, 184, 63, 0.7);
  background: linear-gradient(180deg, #1A1B16, #111920);
}

.dc-source-name {
  color: #FFFFFF;
  font-size: 12px;
  font-weight: 800;
  margin-bottom: 9px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.dc-source-card-master .dc-source-name {
  color: #F3B83F;
}

.dc-source-values {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.dc-source-label {
  color: #8D98A0;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 4px;
}

.dc-source-value {
  color: #FFFFFF;
  font-size: 13px;
  font-weight: 800;
  font-family: 'IBM Plex Mono', monospace;
}

/* FOOTER */

.dc-footer {
  padding: 9px 12px;
  border-top: 1px solid #26323A;
  font-size: 12px;
  color: #9AA5AC;
  background: #080D11;
  text-align: center;
}

.dc-footer-loading { color: #D7B15A; }
.dc-footer-success { color: #65D6A8; }
.dc-footer-error { color: #FF8585; }

.dc-footer span {
  font-size: 17px;
  vertical-align: -2px;
}

/* SCROLLBARS */

.dc-list::-webkit-scrollbar,
.dc-profile::-webkit-scrollbar {
  width: 7px;
}

.dc-list::-webkit-scrollbar-track,
.dc-profile::-webkit-scrollbar-track {
  background: transparent;
}

.dc-list::-webkit-scrollbar-thumb,
.dc-profile::-webkit-scrollbar-thumb {
  background: #2B363C;
  border-radius: 6px;
}

/* MOBILE / SMALL SCREEN FALLBACK */

@media (max-width: 1180px) {
  .dc-window {
    width: 440px;
    height: 680px;
    right: 14px;
    top: 14px;
  }

  .dc-profile-window {
    width: 520px;
    height: 680px;
    right: 468px;
    top: 14px;
  }
}

@media (max-width: 980px) {
  .dc-window,
  .dc-profile-window {
    width: 94vw;
    right: 3vw;
  }

  .dc-profile-window {
    top: 76px;
    height: calc(88vh - 58px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dc-card,
  .dc-graph-bar,
  .dc-chip,
  .dc-reset-btn,
  .dc-refresh-btn,
  .dc-rec-view {
    transition: none;
  }

  .dc-refreshing .dc-refresh-icon {
    animation: none;
  }
}
`;
