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
  height: 720px;
  max-width: 92vw;
  max-height: 88vh;
  background: #070C10;
  border: 1px solid #26323A;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 22px 60px rgba(0,0,0,0.58);
  display: grid;
  grid-template-rows: 50px 1fr;
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
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px 0 14px;
  border-bottom: 1px solid #26323A;
  background: #070B0F;
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
  grid-template-rows: auto auto 1fr auto;
  background: #080D11;
}

/* CONTROLS */

.dc-controls {
  background: #080D11;
  padding: 12px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  border-bottom: 1px solid #1E2A32;
}

.dc-search {
  width: 100%;
  height: 38px;
  background: #10171D;
  border: 1px solid #26323A;
  border-radius: 7px;
  padding: 0 12px;
  color: #F5F7FA;
  font-size: 13px;
  outline: none;
}

.dc-search::placeholder {
  color: #76828A;
}

.dc-search:focus {
  border-color: #F3B83F;
}

.dc-chips {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 7px;
}

.dc-chip {
  height: 32px;
  border: none;
  border-radius: 7px;
  color: #FFFFFF;
  cursor: pointer;
  text-transform: uppercase;
  font-weight: 800;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
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
  background: #080D11;
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
  transition: background 120ms ease;
}

.dc-card:hover {
  background: #121A20;
}

.dc-card.dc-selected {
  background: #141D24;
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
  .dc-graph-bar {
    transition: none;
  }
}
`;