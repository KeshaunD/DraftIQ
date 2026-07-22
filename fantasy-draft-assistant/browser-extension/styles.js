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
  width: 472px;
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

.dc-root.dc-hidden .dc-window {
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
  gap: 5px;
}

.dc-status-btn,
.dc-icon-btn,
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

.dc-status-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 9px;
  color: #AEB8BE;
}

.dc-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #E4A83D;
  box-shadow: 0 0 0 3px rgba(228, 168, 61, 0.10);
}

.dc-status-dot-live {
  background: #35D89A;
  box-shadow: 0 0 0 3px rgba(53, 216, 154, 0.12);
}

.dc-status-dot-warning {
  background: #E4A83D;
}

.dc-icon-btn {
  width: 30px;
  padding: 0;
  color: #AEB8BE;
  font-size: 14px;
}

.dc-refresh-btn {
  width: 30px;
  padding: 0;
  font-size: 16px;
}

.dc-status-btn:hover,
.dc-icon-btn:hover,
.dc-refresh-btn:hover {
  color: #FFFFFF;
  border-color: #52616B;
  background: #172229;
  transform: translateY(-1px);
}

.dc-status-btn:focus-visible,
.dc-icon-btn:focus-visible,
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
  grid-template-rows: auto auto auto auto 1fr auto;
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

.dc-sort-control {
  height: 34px;
  display: grid;
  grid-template-columns: auto minmax(150px, 1fr);
  align-items: center;
  gap: 10px;
  color: #8F9BA3;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.dc-sort-select {
  width: 100%;
  height: 34px;
  padding: 0 32px 0 10px;
  border: 1px solid #293740;
  border-radius: 9px;
  background: #0E171D;
  color: #F5F7FA;
  font-size: 12px;
  font-weight: 700;
  outline: none;
  cursor: pointer;
}

.dc-sort-select:focus {
  border-color: #F3B83F;
  box-shadow: 0 0 0 3px rgba(243, 184, 63, 0.10);
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
  grid-template-columns: 46px minmax(0, 1fr) 48px 54px 16px;
  align-items: center;
  gap: 4px;
  height: 34px;
  padding: 0 8px;
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
  grid-template-columns: 46px minmax(0, 1fr) 48px 54px 16px;
  align-items: center;
  gap: 4px;
  min-height: 66px;
  padding: 7px 8px;
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

.dc-card-rank {
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  color: #FFFFFF;
}

.dc-star {
  width: 20px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #A5AFB7;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  line-height: 1;
  transition: color 120ms ease, background 120ms ease, transform 120ms ease;
}

.dc-star:hover {
  color: #F7CA62;
  background: rgba(243, 184, 63, 0.1);
  transform: scale(1.08);
}

.dc-star:focus-visible {
  outline: 2px solid rgba(243, 184, 63, 0.7);
  outline-offset: 1px;
}

.dc-star.dc-star-active {
  color: #F7CA62;
  text-shadow: 0 0 10px rgba(243, 184, 63, 0.38);
}

.dc-card-main {
  min-width: 0;
}

.dc-card-main-stack {
  position: relative;
  padding-right: 56px;
}

.dc-card-stack-target {
  position: absolute;
  top: 50%;
  right: 3px;
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid #E8B94E;
  border-radius: 50%;
  background: #172235;
  box-shadow: 0 0 0 2px rgba(232, 185, 78, 0.12);
  color: #E8B94E;
  font-size: 9px;
  font-weight: 850;
  line-height: 1;
  transform: translateY(-50%);
}

.dc-card-stack-target img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  image-rendering: auto;
  transform: scale(1.12);
  transform-origin: center top;
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

/* SETTINGS, DIAGNOSTICS, AND REPORT DRAWERS */

.dc-drawer {
  position: absolute;
  inset: 56px 0 0;
  z-index: 20;
  overflow-y: auto;
  padding: 18px;
  background:
    radial-gradient(circle at 100% 0%, rgba(243, 184, 63, 0.07), transparent 34%),
    linear-gradient(180deg, #0B1217 0%, #080D11 100%);
  border-top: 1px solid #202D35;
  pointer-events: auto;
}

.dc-drawer-hidden {
  display: none;
}

.dc-drawer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid #233039;
}

.dc-drawer-eyebrow {
  margin-bottom: 4px;
  color: #D4A63E;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.10em;
  text-transform: uppercase;
}

.dc-drawer-title {
  color: #FFFFFF;
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.035em;
}

.dc-drawer-close {
  width: 30px;
  height: 30px;
  border: 1px solid #2B3942;
  border-radius: 8px;
  background: #111A20;
  color: #AEB8BE;
  cursor: pointer;
  font-size: 17px;
}

.dc-drawer-close:hover {
  border-color: #F3B83F;
  color: #FFFFFF;
}

.dc-report-roster-title {
  margin-top: 2px;
  color: #FFFFFF;
  font-size: 12px;
  font-weight: 800;
}

.dc-report-disclaimer {
  border: 1px solid #233039;
  border-radius: 9px;
  background: rgba(15, 24, 30, 0.72);
  color: #8F9BA3;
  padding: 10px 11px;
  font-size: 10px;
  line-height: 1.5;
}

.dc-diagnostic-compact-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  max-width: 430px;
}

.dc-diagnostic-compact-card {
  min-width: 0;
  min-height: 64px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 10px 11px;
  border: 1px solid #25333C;
  border-radius: 9px;
  background: #0E161B;
}

.dc-diagnostic-compact-card > span,
.dc-diagnostic-compact-card > div > span,
.dc-diagnostic-compact-card strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dc-diagnostic-compact-card > span,
.dc-diagnostic-compact-card > div > span {
  margin-bottom: 5px;
  color: #7F8B92;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.dc-diagnostic-compact-card strong {
  color: #EAF0F2;
  font-size: 12px;
}

.dc-diagnostic-status-card {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  align-items: center;
  justify-content: initial;
  gap: 9px;
}

.dc-health-dot {
  width: 9px;
  height: 9px;
  margin: 0;
  border-radius: 999px;
  background: #E4A83D;
}

.dc-diagnostic-status-live {
  border-color: rgba(53, 216, 154, 0.35);
  background: rgba(53, 216, 154, 0.06);
}

.dc-diagnostic-status-live .dc-health-dot {
  background: #35D89A;
  box-shadow: 0 0 0 3px rgba(53, 216, 154, 0.10);
}

.dc-diagnostic-status-warning {
  border-color: rgba(228, 168, 61, 0.35);
  background: rgba(228, 168, 61, 0.06);
}

@media (max-width: 430px) {
  .dc-diagnostic-compact-grid {
    grid-template-columns: 1fr;
  }
}

.dc-report-score-card {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  margin-bottom: 13px;
  padding: 14px;
  border: 1px solid rgba(243, 184, 63, 0.34);
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(243, 184, 63, 0.10), #10181E 58%);
}

.dc-report-grade {
  width: 68px;
  height: 68px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px solid #F3B83F;
  border-radius: 999px;
  background: #0B1217;
}

.dc-report-grade strong {
  color: #F7CA62;
  font-size: 24px;
  line-height: 1;
}

.dc-report-grade span {
  margin-top: 4px;
  color: #8F9BA3;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 8px;
}

.dc-report-score-title {
  color: #FFFFFF;
  font-size: 15px;
  font-weight: 800;
}

.dc-report-score-copy {
  margin-top: 5px;
  color: #9CA7AE;
  font-size: 10px;
  line-height: 1.45;
}

.dc-report-position-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 13px;
}

.dc-report-position-grid > div {
  padding: 9px;
  border: 1px solid #25333C;
  border-radius: 9px;
  background: #0E161B;
  text-align: center;
}

.dc-report-position-grid span,
.dc-report-position-grid strong {
  display: block;
}

.dc-report-position-grid span {
  color: #7F8B92;
  font-size: 9px;
  font-weight: 800;
}

.dc-report-position-grid strong {
  margin-top: 3px;
  color: #FFFFFF;
  font-size: 17px;
}

.dc-report-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  margin-bottom: 14px;
}

.dc-report-columns section {
  padding: 11px;
  border: 1px solid #25333C;
  border-radius: 9px;
  background: #0E161B;
}

.dc-report-columns h3 {
  margin: 0 0 7px;
  color: #FFFFFF;
  font-size: 11px;
}

.dc-report-columns ul {
  margin: 0;
  padding-left: 15px;
  color: #9FAAB0;
  font-size: 9px;
  line-height: 1.5;
}

.dc-report-roster {
  margin-top: 8px;
  margin-bottom: 12px;
  border: 1px solid #25333C;
  border-radius: 9px;
  overflow: hidden;
}

.dc-report-player {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) 38px 54px;
  gap: 7px;
  align-items: center;
  padding: 8px 9px;
  border-bottom: 1px solid #1D2930;
  background: #0D151A;
  font-size: 9px;
}

.dc-report-player:last-child {
  border-bottom: none;
}

.dc-report-player strong {
  overflow: hidden;
  color: #FFFFFF;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dc-report-player > span:not(.dc-pos) {
  color: #8F9BA3;
  text-align: right;
}

.dc-empty-state {
  padding: 34px 20px;
  border: 1px dashed #2B3942;
  border-radius: 11px;
  background: #0E161B;
  text-align: center;
}

.dc-empty-state strong,
.dc-empty-state span {
  display: block;
}

.dc-empty-state strong {
  color: #FFFFFF;
  font-size: 14px;
}

.dc-empty-state span {
  margin-top: 7px;
  color: #8F9BA3;
  font-size: 10px;
  line-height: 1.45;
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

/* ROTOWIRE PLAYER NEWS */

.dc-player-news {
  margin-top: 16px;
}

.dc-news-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dc-news-section-header .dc-profile-section-title {
  margin-bottom: 10px;
}

.dc-news-source-badge {
  flex: 0 0 auto;
  min-height: 23px;
  display: inline-flex;
  align-items: center;
  padding: 0 9px;
  border: 1px solid rgba(221, 53, 78, 0.48);
  border-radius: 999px;
  background: rgba(178, 24, 48, 0.13);
  color: #FF7D90;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.dc-news-list {
  display: grid;
  gap: 8px;
}

.dc-news-item {
  position: relative;
  overflow: hidden;
  padding: 11px 12px;
  border: 1px solid #2A363E;
  border-radius: 9px;
  background:
    linear-gradient(
      145deg,
      #111920 0%,
      #0D1419 100%
    );
}

.dc-news-item::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 2px;
  background: #73303D;
}

.dc-news-item-latest {
  border-color: rgba(221, 53, 78, 0.42);
  background:
    radial-gradient(
      circle at 100% 0%,
      rgba(221, 53, 78, 0.10),
      transparent 42%
    ),
    linear-gradient(
      145deg,
      #15181D 0%,
      #0D1419 100%
    );
}

.dc-news-item-latest::before {
  width: 3px;
  background: linear-gradient(
    180deg,
    #FF7187,
    #B21830
  );
}

.dc-news-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.dc-news-headline {
  min-width: 0;
  margin: 0;
  color: #FFFFFF;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.35;
}

.dc-news-date {
  flex: 0 0 auto;
  color: #89959C;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  font-weight: 600;
  white-space: nowrap;
}

.dc-news-summary {
  margin: 7px 0 0;
  color: #B7C0C6;
  font-size: 10px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.dc-news-link {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 9px;
  color: #FF8798;
  font-size: 10px;
  font-weight: 800;
  text-decoration: none;
  transition:
    color 120ms ease,
    transform 120ms ease;
}

.dc-news-link:hover {
  color: #FFFFFF;
  transform: translateX(2px);
}

.dc-news-link:focus-visible {
  outline: 2px solid rgba(255, 113, 135, 0.75);
  outline-offset: 3px;
  border-radius: 3px;
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
.dc-drawer::-webkit-scrollbar {
  width: 7px;
}

.dc-list::-webkit-scrollbar-track,
.dc-drawer::-webkit-scrollbar-track {
  background: transparent;
}

.dc-list::-webkit-scrollbar-thumb,
.dc-drawer::-webkit-scrollbar-thumb {
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
}

@media (max-width: 980px) {
  .dc-window {
    width: 94vw;
    right: 3vw;
  }
}

/* =========================================================
   DRAFTIQ HORIZONTAL DESKTOP LAYOUT
   ========================================================= */

.dc-window {
  width: 980px;
  height: 620px;
  max-width: calc(100vw - 36px);
  max-height: calc(100vh - 36px);
}

.dc-left-panel {
  grid-row: 2;
  min-height: 0;
  display: grid;
  grid-template-columns: 420px minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr) auto;
  grid-template-areas:
    "controls tableHeader"
    "recommendation playerList"
    "footer footer";
  background: #080D11;
}

.dc-controls {
  grid-area: controls;
  min-width: 0;
  padding: 12px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150px;
  grid-template-areas:
    "search search"
    "chips sort";
  gap: 8px;
  border-right: 1px solid #1E2A32;
  border-bottom: 1px solid #1E2A32;
}

.dc-search {
  grid-area: search;
}

.dc-chips {
  grid-area: chips;
}

.dc-sort-control {
  grid-area: sort;
  height: 34px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 0;
}

.dc-sort-control > span {
  display: none;
}

.dc-recommendation {
  grid-area: recommendation;
  align-self: start;
  margin: 12px 10px 10px 12px;
}

.dc-table-header {
  grid-area: tableHeader;
  align-self: end;
  grid-template-columns: 60px minmax(0, 1fr) 74px 82px 18px;
  border-left: 1px solid #1E2A32;
}

.dc-list {
  grid-area: playerList;
  min-height: 0;
  overflow-y: auto;
  border-left: 1px solid #1E2A32;
}

.dc-card {
  grid-template-columns: 60px minmax(0, 1fr) 74px 82px 18px;
}

.dc-footer {
  grid-area: footer;
}

@media (max-width: 1220px) {
  .dc-window {
    width: 880px;
    height: 600px;
  }

  .dc-left-panel {
    grid-template-columns: 370px minmax(0, 1fr);
  }

  .dc-controls {
    grid-template-columns: minmax(0, 1fr) 138px;
  }

  .dc-table-header,
  .dc-card {
    grid-template-columns: 54px minmax(0, 1fr) 66px 74px 18px;
  }
}

@media (max-width: 1080px) {
  .dc-window {
    width: 500px;
    height: 760px;
    right: 14px;
    top: 14px;
    max-width: 92vw;
    max-height: 88vh;
  }

  .dc-left-panel {
    grid-template-columns: 1fr;
    grid-template-rows:
      auto
      auto
      34px
      minmax(0, 1fr)
      auto;
    grid-template-areas:
      "controls"
      "recommendation"
      "tableHeader"
      "playerList"
      "footer";
  }

  .dc-controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 13px 12px 11px;
    border-right: 0;
  }

  .dc-search,
  .dc-chips,
  .dc-sort-control {
    grid-area: auto;
  }

  .dc-sort-control {
    grid-template-columns: auto minmax(150px, 1fr);
    gap: 10px;
  }

  .dc-sort-control > span {
    display: block;
  }

  .dc-recommendation {
    align-self: stretch;
    margin: 0 12px 12px;
  }

  .dc-table-header {
    align-self: stretch;
    border-left: 0;
  }

  .dc-list {
    border-left: 0;
  }

  .dc-table-header,
  .dc-card {
    grid-template-columns: 46px minmax(0, 1fr) 48px 54px 16px;
  }

}

@media (max-width: 980px) {
  .dc-window {
    width: 94vw;
    right: 3vw;
    left: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dc-card,
  .dc-graph-bar,
  .dc-chip,
  .dc-refresh-btn,
  .dc-rec-view {
    transition: none;
  }

  .dc-refreshing .dc-refresh-icon {
    animation: none;
  }
}

/* =========================================================
   PROFILE TOP NEWS + FULL REGULAR-SEASON GRAPH
   ========================================================= */

.dc-profile-top-grid {
  display: grid;
  grid-template-columns:
    minmax(0, 1.35fr)
    minmax(330px, 0.85fr);
  align-items: start;
  gap: 18px;
  margin-bottom: 8px;
}

.dc-profile-snapshot-column,
.dc-profile-news-column {
  min-width: 0;
}

.dc-profile-snapshot-column
  > .dc-profile-section-title {
  margin-top: 0;
}

.dc-profile-news-column
  .dc-player-news {
  margin-top: 0;
}

.dc-profile-news-column
  .dc-profile-section-title {
  margin-top: 0;
}

.dc-profile-news-column
  .dc-news-item {
  min-height: 104px;
}

@media (max-width: 1080px) {
  .dc-profile-top-grid {
    grid-template-columns: 1fr;
  }

  .dc-profile-news-column {
    order: -1;
  }
}

/* =========================================================
   DRAFTIQ COMPACT INLINE EXPERIENCE
   ========================================================= */

.dc-window {
  width: 1020px;
  height: 640px;
  grid-template-rows: 46px minmax(0, 1fr);
  border-radius: 14px;
}

.dc-header {
  height: 46px;
  padding: 0 9px 0 13px;
  background: linear-gradient(180deg, #0D151B 0%, #090F14 100%);
}

.dc-wordmark {
  font-size: 20px;
}

.dc-header-actions {
  gap: 4px;
}

.dc-pick-tracker {
  height: 26px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  border: 1px solid rgba(243, 184, 63, 0.30);
  border-radius: 7px;
  background: rgba(243, 184, 63, 0.07);
  color: #8D9AA1;
  white-space: nowrap;
}

.dc-pick-tracker span {
  font-size: 7px;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.dc-pick-tracker strong {
  color: #F6C85D;
  font: 800 11px 'IBM Plex Mono', monospace;
}

.dc-pick-tracker small {
  padding-left: 5px;
  border-left: 1px solid rgba(243, 184, 63, 0.22);
  color: #B7C0C5;
  font: 650 8px 'IBM Plex Mono', monospace;
}

.dc-status-btn,
.dc-icon-btn,
.dc-refresh-btn,
.dc-collapse-btn {
  height: 26px;
  min-height: 26px;
  border-radius: 7px;
}

.dc-status-btn {
  padding: 0 8px;
  font-size: 10px;
}

.dc-icon-btn,
.dc-refresh-btn,
.dc-collapse-btn {
  width: 26px;
  font-size: 13px;
}

.dc-status-dot-live {
  animation: dc-live-pulse 1.8s ease-out infinite;
}

@keyframes dc-live-pulse {
  0%, 45% { box-shadow: 0 0 0 0 rgba(53, 216, 154, 0.38); }
  80%, 100% { box-shadow: 0 0 0 5px rgba(53, 216, 154, 0); }
}

.dc-drawer {
  inset: 46px 0 0;
}

.dc-left-panel {
  grid-row: 2;
  grid-template-columns: 320px minmax(0, 1fr);
  grid-template-rows: auto 32px minmax(0, 1fr) auto;
  grid-template-areas:
    "draftContext controls"
    "recommendation tableHeader"
    "recommendation playerList"
    "footer footer";
}

.dc-draft-context {
  grid-area: draftContext;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 8px;
  border-right: 1px solid #1E2A32;
  border-bottom: 1px solid #1E2A32;
  background: linear-gradient(180deg, #0C1419 0%, #090F13 100%);
}

.dc-draft-context-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 7px 10px;
  border: 1px solid #22313A;
  border-radius: 9px;
  background: rgba(17, 27, 33, 0.78);
}

.dc-draft-context-card > span,
.dc-draft-context-card > strong,
.dc-draft-context-card > small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dc-draft-context-card > span {
  margin-bottom: 3px;
  color: #71808A;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dc-draft-context-card > strong {
  color: #F4F7F8;
  font-size: 12px;
  line-height: 1.2;
}

.dc-draft-context-card > small {
  margin-top: 2px;
  color: #8D9BA3;
  font-size: 8px;
  line-height: 1.2;
}

.dc-draft-context-next {
  border-color: rgba(243, 184, 63, 0.28);
  background: linear-gradient(135deg, rgba(243, 184, 63, 0.09), rgba(17, 27, 33, 0.82));
}

.dc-draft-context-next > strong {
  color: #F3B83F;
}

.dc-draft-context-on-clock {
  border-color: rgba(53, 216, 154, 0.42);
  background: linear-gradient(135deg, rgba(53, 216, 154, 0.13), rgba(17, 27, 33, 0.82));
  box-shadow: inset 3px 0 0 #35D89A;
}

.dc-draft-context-on-clock > strong {
  color: #5CE6AF;
}

.dc-controls {
  padding: 9px 10px;
  grid-template-columns: minmax(0, 1fr) 116px;
  gap: 6px;
}

.dc-search {
  height: 35px;
  border-radius: 8px;
}

.dc-chip,
.dc-sort-control,
.dc-sort-select {
  height: 30px;
}

.dc-table-header,
.dc-card {
  grid-template-columns: 42px minmax(150px, 1fr) 38px 52px 66px 36px;
  gap: 2px;
}

.dc-table-header {
  height: 32px;
  padding: 0 7px;
  font-size: 9px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dc-table-header div:first-child {
  grid-column: auto;
}

.dc-table-header div:nth-child(n+3) {
  text-align: center;
}

.dc-list {
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: #35444D transparent;
}

.dc-list-section-label {
  position: sticky;
  top: 0;
  z-index: 2;
  height: 24px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-bottom: 1px solid #1D2930;
  background: rgba(13, 21, 27, 0.96);
  color: #7F8B92;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  backdrop-filter: blur(8px);
}

.dc-list-section-favorites {
  color: #F2C85B;
  background: rgba(39, 32, 16, 0.96);
}

.dc-card {
  min-height: 64px;
  padding: 7px;
  border-left-width: 2px;
  transition: transform 140ms ease, background 140ms ease, border-color 140ms ease;
}

.dc-card:hover {
  transform: translateY(-1px);
}

.dc-card:focus-visible {
  outline: 2px solid rgba(243, 184, 63, 0.65);
  outline-offset: -2px;
}

.dc-card-rank {
  justify-content: center;
  color: #DCE4E8;
  font-size: 11px;
  font-weight: 700;
}

.dc-card-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.dc-card-chevron {
  color: #65727A;
  font-size: 9px;
}

.dc-card-meta {
  margin-top: 2px;
  gap: 3px;
  color: #929EA5;
  font-size: 9px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dc-card-tier,
.dc-card-adp,
.dc-card-proj {
  color: #E7EDF0;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  font-weight: 650;
  text-align: center;
}

.dc-card-tier {
  color: #C6A653;
}

.dc-card-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.dc-star {
  width: 25px;
  height: 25px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: #7F8B92;
  cursor: pointer;
  font-size: 13px;
}

.dc-inline-profile {
  margin: 0;
  padding: 14px;
  border-bottom: 1px solid #33424B;
  background:
    radial-gradient(circle at 100% 0%, rgba(243, 184, 63, 0.08), transparent 34%),
    linear-gradient(180deg, #111A20, #0A1116);
  animation: dc-inline-open 180ms ease-out;
}

@keyframes dc-inline-open {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}

.dc-inline-profile .dc-profile-header {
  cursor: default;
  padding: 0 0 12px;
  margin-bottom: 12px;
}

.dc-inline-profile .dc-profile-image {
  width: 58px;
  height: 58px;
  border-radius: 12px;
}

.dc-inline-profile .dc-profile-name {
  font-size: 19px;
}

.dc-profile-grade-badge {
  width: 54px;
  height: 54px;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(243, 184, 63, 0.42);
  border-radius: 13px;
  background: linear-gradient(145deg, rgba(243, 184, 63, 0.18), rgba(243, 184, 63, 0.04));
  color: #F6C85D;
}

.dc-profile-grade-badge strong {
  font-size: 20px;
  line-height: 1;
}

.dc-profile-grade-badge span {
  margin-top: 3px;
  color: #AEB8BE;
  font: 600 9px 'IBM Plex Mono', monospace;
}

.dc-inline-profile .dc-profile-top-grid {
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  gap: 10px;
}

.dc-profile-section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
}

.dc-profile-section-title-row small {
  color: #65727A;
  font-size: 8px;
  font-weight: 600;
  text-transform: none;
}

.dc-performance-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 5px;
  margin: 8px 0;
}

.dc-performance-grid > div {
  padding: 7px;
  border: 1px solid #26343C;
  border-radius: 8px;
  background: #0B1217;
  text-align: center;
}

.dc-performance-grid span,
.dc-performance-grid strong {
  display: block;
}

.dc-performance-grid span {
  color: #718089;
  font-size: 7px;
  font-weight: 800;
  text-transform: uppercase;
}

.dc-performance-grid strong {
  margin-top: 3px;
  color: #E8EEF1;
  font: 700 11px 'IBM Plex Mono', monospace;
}

.dc-game-log {
  max-height: 225px;
  overflow-y: auto;
  border: 1px solid #26343C;
  border-radius: 10px;
  background: #0A1116;
}

.dc-game-row {
  min-height: 29px;
  display: grid;
  grid-template-columns: 38px 42px 42px 52px minmax(80px, 1fr);
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  border-bottom: 1px solid #1C282F;
  color: #AEB8BE;
  font-size: 9px;
}

.dc-game-header {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #111A20;
  color: #6F7D85;
  font-size: 7px;
  font-weight: 800;
  text-transform: uppercase;
}

.dc-game-outcome {
  font-weight: 750;
}

.dc-game-outcome-boom { color: #65D6A8; }
.dc-game-outcome-bust { color: #FF8585; }
.dc-game-outcome-steady { color: #D7B15A; }

.dc-game-bar {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: #1A252C;
}

.dc-game-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.dc-game-bar .dc-graph-bar-good { background: #35D89A; }
.dc-game-bar .dc-graph-bar-mid { background: #E4A83D; }
.dc-game-bar .dc-graph-bar-bad { background: #E96868; }

/* Recommendation intelligence */
.dc-recommendation {
  align-self: start;
  margin: 10px;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(243, 184, 63, 0.38);
  border-radius: 13px;
  background:
    radial-gradient(circle at 100% 0%, rgba(243, 184, 63, 0.12), transparent 42%),
    linear-gradient(155deg, #171B18, #0D1519 62%);
}

.dc-rec-heading {
  min-height: 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 11px;
  border-bottom: 1px solid rgba(243, 184, 63, 0.18);
  color: #77858D;
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
}

.dc-rec-kicker {
  color: #F3C658;
  letter-spacing: 0.09em;
}

.dc-rec-primary {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 58px;
  align-items: center;
  gap: 10px;
  padding: 11px;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.dc-rec-primary:hover {
  background: rgba(255, 255, 255, 0.025);
}

.dc-rec-best-alternate {
  width: auto;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  margin: 0 9px 9px;
  padding: 8px 10px;
  border: 1px solid rgba(75, 150, 220, 0.28);
  border-radius: 9px;
  background: rgba(75, 150, 220, 0.055);
  color: #DCE5E9;
  cursor: pointer;
  text-align: left;
  transition: border-color 120ms ease, background 120ms ease;
}

.dc-rec-best-alternate:hover {
  border-color: rgba(75, 150, 220, 0.55);
  background: rgba(75, 150, 220, 0.10);
}

.dc-rec-best-alternate > span:first-child,
.dc-rec-best-alternate > span:first-child small,
.dc-rec-best-alternate > span:first-child strong {
  min-width: 0;
  display: block;
}

.dc-rec-best-alternate > span:first-child small {
  color: #79B8F2;
  font-size: 7px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dc-rec-best-alternate > span:first-child strong {
  margin-top: 2px;
  overflow: hidden;
  color: #F2F6F8;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dc-rec-best-alternate-meta {
  color: #93A0A8;
  font-size: 8px;
  white-space: nowrap;
}

.dc-rec-best-alternate > em {
  color: #F5C85F;
  font-size: 9px;
  font-style: normal;
  font-weight: 800;
  white-space: nowrap;
}

.dc-rec-player strong,
.dc-rec-player > span {
  display: block;
}

.dc-rec-player strong {
  color: #FFFFFF;
  font-size: 17px;
  letter-spacing: -0.025em;
}

.dc-rec-player > span {
  margin-top: 5px;
  color: #9DA8AE;
  font-size: 9px;
}

.dc-rec-grade {
  height: 54px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(243, 184, 63, 0.42);
  border-radius: 11px;
  background: rgba(243, 184, 63, 0.08);
}

.dc-rec-grade strong {
  color: #F7CB66;
  font: 800 21px 'IBM Plex Mono', monospace;
}

.dc-rec-grade span {
  margin-top: 1px;
  color: #8E9AA1;
  font-size: 7px;
  font-weight: 800;
  text-transform: uppercase;
}

.dc-rec-decision-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  margin: 0 11px;
  padding: 9px 0;
  border-top: 1px solid #253139;
  border-bottom: 1px solid #253139;
}

.dc-rec-urgency {
  padding: 6px 8px;
  border-radius: 7px;
  background: rgba(53, 216, 154, 0.12);
  color: #65D6A8;
  font-size: 9px;
  font-weight: 850;
  text-transform: uppercase;
}

.dc-rec-urgency-can-wait { background: rgba(75, 150, 220, 0.12); color: #79B8F2; }
.dc-rec-urgency-reach { background: rgba(232, 104, 104, 0.12); color: #FF8585; }
.dc-rec-urgency-steal { background: rgba(155, 66, 200, 0.14); color: #D49AF3; }
.dc-rec-urgency-must-draft { background: rgba(243, 184, 63, 0.14); color: #F7CB66; }

.dc-rec-probability {
  min-width: 0;
}

.dc-rec-probability strong,
.dc-rec-probability span {
  display: block;
}

.dc-rec-probability strong {
  color: #FFFFFF;
  font: 750 13px 'IBM Plex Mono', monospace;
}

.dc-rec-probability span {
  margin-top: 2px;
  overflow: hidden;
  color: #89969D;
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dc-rec-alternatives {
  padding: 8px 11px 10px;
  border-top: 1px solid #253139;
}

.dc-rec-section-label {
  margin-bottom: 5px;
  color: #78858D;
  font-size: 7px;
  font-weight: 850;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dc-rec-alt {
  width: 100%;
  min-height: 34px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 30px 64px;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border: 0;
  border-top: 1px solid #202C33;
  border-radius: 0;
  background: transparent;
  color: #AEB8BE;
  cursor: pointer;
  text-align: left;
}

.dc-rec-alt:first-of-type {
  border-top: 0;
}

.dc-rec-alt span strong,
.dc-rec-alt span small {
  display: block;
}

.dc-rec-alt span strong {
  color: #E8EDF0;
  font-size: 9px;
}

.dc-rec-alt small {
  color: #6F7D85;
  font-size: 7px;
}

.dc-rec-alt-score {
  color: #F3C658;
  font: 750 10px 'IBM Plex Mono', monospace;
  text-align: center;
}

/* Expanded draft report */
.dc-report-position-card small {
  display: block;
  margin-top: 3px;
  color: #6F7D85;
  font-size: 7px;
}

.dc-report-balance-card {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #293841;
  border-radius: 11px;
  background: #0D151A;
}

.dc-report-balance-card > div:first-child {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dc-report-balance-card span {
  color: #839098;
  font-size: 9px;
}

.dc-report-balance-card strong {
  color: #65D6A8;
  font: 800 17px 'IBM Plex Mono', monospace;
}

.dc-report-balance-track {
  height: 6px;
  margin: 8px 0 6px;
  overflow: hidden;
  border-radius: 999px;
  background: #1C282F;
}

.dc-report-balance-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #35D89A, #8BE3BF);
}

.dc-report-value-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.dc-report-value-summary > div {
  padding: 10px;
  border: 1px solid #293841;
  border-radius: 10px;
  background: #0D151A;
  text-align: center;
}

.dc-report-value-summary span,
.dc-report-value-summary strong {
  display: block;
}

.dc-report-value-summary span {
  color: #7F8B92;
  font-size: 8px;
  font-weight: 750;
  text-transform: uppercase;
}

.dc-report-value-summary strong {
  margin-top: 4px;
  color: #EAF0F2;
  font: 800 17px 'IBM Plex Mono', monospace;
}

.dc-report-value-summary .dc-report-value-positive {
  color: #65D6A8;
}

.dc-report-value-summary .dc-report-value-negative {
  color: #F07E73;
}

.dc-report-pick-values {
  margin-bottom: 12px;
  padding: 11px;
  border: 1px solid #283740;
  border-radius: 11px;
  background: #0D151A;
}

.dc-report-value-list {
  margin-top: 7px;
  border-top: 1px solid #24323A;
}

.dc-report-value-row {
  display: grid;
  grid-template-columns: 30px minmax(130px, 1fr) 64px 66px 110px 62px;
  gap: 8px;
  align-items: center;
  min-width: 0;
  padding: 7px 0;
  border-bottom: 1px solid #202D34;
  color: #829099;
  font-size: 8px;
}

.dc-report-value-row:last-child {
  border-bottom: 0;
}

.dc-report-value-row strong {
  overflow: hidden;
  color: #EAF0F2;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dc-report-value-row small {
  color: #77858D;
  font-size: 7px;
  text-align: right;
}

.dc-report-value-badge {
  justify-self: end;
  padding: 4px 6px;
  border-radius: 999px;
  font-size: 7px;
  text-align: center;
  white-space: nowrap;
}

.dc-report-value-steal {
  color: #65D6A8;
  background: rgba(53, 216, 154, 0.12);
}

.dc-report-value-at-adp {
  color: #F3C658;
  background: rgba(243, 198, 88, 0.11);
}

.dc-report-value-reach {
  color: #F08B82;
  background: rgba(240, 126, 115, 0.12);
}

.dc-report-columns {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.dc-report-lineup-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.dc-report-lineup-grid > section,
.dc-report-bye-card,
.dc-report-all-roster {
  padding: 11px;
  border: 1px solid #283740;
  border-radius: 11px;
  background: #0D151A;
}

.dc-report-lineup-list {
  display: grid;
  gap: 5px;
}

.dc-report-lineup-player {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 32px auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 8px;
}

.dc-report-lineup-player strong {
  overflow: hidden;
  color: #E8EDF0;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dc-report-lineup-player small,
.dc-report-lineup-player > span:nth-child(3) {
  color: #718089;
  font-size: 7px;
}

.dc-report-bye-card {
  margin-bottom: 12px;
}

.dc-report-bye-row {
  display: grid;
  grid-template-columns: 55px minmax(0, 1fr);
  gap: 8px;
  padding: 6px 0;
  border-top: 1px solid #233039;
  color: #9DA8AE;
  font-size: 8px;
}

.dc-report-positive,
.dc-report-empty-line {
  color: #65D6A8;
  font-size: 8px;
}

.dc-report-all-roster summary {
  color: #AEB8BE;
  cursor: pointer;
  font-size: 9px;
  font-weight: 750;
}

.dc-report-all-roster .dc-report-roster {
  margin-top: 10px;
}

@media (max-width: 1220px) {
  .dc-window {
    width: 940px;
    height: 620px;
  }

  .dc-left-panel {
    grid-template-columns: 300px minmax(0, 1fr);
  }

  .dc-inline-profile .dc-profile-top-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1080px) {
  .dc-window {
    width: 500px;
    height: 760px;
  }

  .dc-left-panel {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto 32px minmax(0, 1fr) auto;
    grid-template-areas:
      "controls"
      "draftContext"
      "recommendation"
      "tableHeader"
      "playerList"
      "footer";
  }

  .dc-draft-context {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-left: 0;
    border-right: 0;
  }

  .dc-table-header,
  .dc-card {
    grid-template-columns: 38px minmax(142px, 1fr) 34px 48px 58px 36px;
  }

  .dc-report-columns,
  .dc-report-lineup-grid {
    grid-template-columns: 1fr;
  }

  .dc-report-value-row {
    grid-template-columns: 28px minmax(110px, 1fr) 56px 60px 58px;
  }

  .dc-report-value-row small {
    display: none;
  }

  .dc-pick-tracker span {
    display: none;
  }
}

/* Inter typography and readability pass */
.dc-root,
.dc-root * {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.dc-search { font-size: 14px; }
.dc-chip,
.dc-sort-select,
.dc-status-btn { font-size: 11px; }
.dc-table-header { font-size: 10px; }
.dc-list-section-label { font-size: 9px; }
.dc-card-rank { font-size: 12px; }
.dc-card-name { font-size: 13px; }
.dc-card-meta { font-size: 10px; }
.dc-card-tier,
.dc-card-adp,
.dc-card-proj { font-size: 11px; }
.dc-table-header,
.dc-card {
  grid-template-columns: 42px minmax(140px, 1fr) 38px 50px 62px 58px;
}
.dc-footer { font-size: 11px; }
.dc-pick-tracker span { font-size: 8px; }
.dc-pick-tracker strong { font-size: 12px; }
.dc-pick-tracker small { font-size: 9px; }

.dc-profile-meta,
.dc-profile-note,
.dc-news-summary,
.dc-source-label,
.dc-outlook-label { font-size: 10px; }
.dc-profile-stat-label,
.dc-source-name,
.dc-report-score-copy { font-size: 9px; }
.dc-profile-stat-value,
.dc-source-value,
.dc-outlook-value { font-size: 13px; }
.dc-performance-grid span { font-size: 8px; }
.dc-performance-grid strong { font-size: 12px; }
.dc-game-row { font-size: 10px; }
.dc-game-header { font-size: 8px; }

.dc-recommendation {
  align-self: stretch;
  min-height: 0;
  margin: 8px;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dc-rec-heading {
  min-height: 38px;
  padding: 0 14px;
  font-size: 9px;
}

.dc-rec-primary {
  width: auto;
  min-height: 132px;
  flex: 1 1 auto;
  grid-template-columns: minmax(0, 1fr) 70px;
  margin: 10px 12px;
  padding: 16px;
  border: 1px solid rgba(243, 184, 63, 0.24);
  border-radius: 12px;
  background: linear-gradient(145deg, rgba(243, 184, 63, 0.11), rgba(255, 255, 255, 0.018));
}

.dc-rec-primary:hover {
  border-color: rgba(243, 184, 63, 0.48);
  background: linear-gradient(145deg, rgba(243, 184, 63, 0.16), rgba(255, 255, 255, 0.03));
}

.dc-rec-player strong { font-size: 20px; }
.dc-rec-player > span { font-size: 11px; }
.dc-rec-grade { height: 66px; }
.dc-rec-grade strong { font-size: 24px; }
.dc-rec-grade span { font-size: 8px; }

.dc-rec-decision-row {
  margin: 0 12px;
  padding: 11px 0;
}

.dc-rec-urgency { font-size: 10px; }
.dc-rec-probability strong { font-size: 15px; }
.dc-rec-probability span { font-size: 9px; }

.dc-rec-alternatives {
  margin-top: auto;
  padding: 10px 12px 12px;
}

.dc-rec-section-label { font-size: 8px; }
.dc-rec-alt span strong { font-size: 10px; }
.dc-rec-alt small { font-size: 8px; }
.dc-rec-alt-score { font-size: 11px; }

/* Recommendation card visual refinement */
.dc-recommendation {
  border: 1px solid #2B3A43;
  border-radius: 16px;
  background:
    radial-gradient(circle at 18% 8%, rgba(243, 184, 63, 0.11), transparent 32%),
    radial-gradient(circle at 100% 100%, rgba(53, 216, 154, 0.05), transparent 38%),
    linear-gradient(165deg, #111A20 0%, #0A1217 58%, #091015 100%);
  box-shadow:
    0 14px 32px rgba(0, 0, 0, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.035);
}

.dc-recommendation::before {
  display: none;
}

.dc-rec-heading {
  border-bottom: 1px solid #25333B;
  background: rgba(255, 255, 255, 0.018);
}

.dc-rec-kicker {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #F5C85F;
}

.dc-rec-primary {
  grid-template-columns: 52px minmax(0, 1fr) 64px;
  gap: 10px;
  margin: 12px;
  padding: 14px;
  border-color: rgba(243, 184, 63, 0.20);
  background:
    radial-gradient(circle at 0% 50%, rgba(243, 184, 63, 0.10), transparent 40%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.012));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
}

.dc-rec-avatar {
  width: 52px;
  height: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid #354650;
  border-radius: 14px;
  background: linear-gradient(145deg, #1A252C, #0E171C);
  color: #E6EDF0;
  font-size: 16px;
  font-weight: 800;
}

.dc-rec-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}

.dc-rec-player {
  min-width: 0;
}

.dc-rec-player strong {
  font-size: 18px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dc-rec-grade {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  background: linear-gradient(145deg, rgba(243, 184, 63, 0.18), rgba(243, 184, 63, 0.055));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.dc-rec-decision-row {
  margin: 0 12px 10px;
  padding: 12px;
  border: 1px solid #26353D;
  border-radius: 11px;
  background: rgba(7, 14, 18, 0.54);
}

.dc-rec-urgency {
  box-shadow: inset 0 0 0 1px rgba(53, 216, 154, 0.12);
}

.dc-rec-probability-track {
  width: 100%;
  height: 4px;
  display: block;
  margin-top: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: #1E2B32;
}

.dc-rec-probability-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #35D89A, #F3B83F);
}

.dc-rec-alternatives {
  border-top: 1px solid #24323A;
  background: rgba(5, 11, 15, 0.26);
}

.dc-rec-section-label {
  margin-bottom: 7px;
  color: #8D9AA1;
}

.dc-rec-alt {
  min-height: 46px;
  grid-template-columns: minmax(0, 1fr) 38px 66px;
  gap: 8px;
  margin-top: 6px;
  padding: 7px 8px;
  border: 1px solid #223139;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.018);
  transition: border-color 120ms ease, background 120ms ease, transform 120ms ease;
}

.dc-rec-alt:first-of-type {
  border-top: 1px solid #223139;
}

.dc-rec-alt:hover {
  border-color: #3B4C55;
  background: rgba(255, 255, 255, 0.035);
  transform: translateX(2px);
}

.dc-rec-alt-score {
  text-align: center;
}

.dc-rec-alt-score strong,
.dc-rec-alt-score small {
  display: block;
}

.dc-rec-alt-score strong {
  color: #F5C85F;
  font-size: 12px;
}

.dc-rec-alt-score small {
  margin-top: 1px;
  color: #627078;
  font-size: 7px;
  text-transform: uppercase;
}

@media (max-width: 1080px) {
  .dc-pick-tracker span {
    display: none;
  }

  .dc-rec-primary {
    min-height: 112px;
  }

  .dc-table-header,
  .dc-card {
    grid-template-columns: 38px minmax(136px, 1fr) 34px 46px 56px 56px;
  }
}

/* Live draft intelligence */
.dc-draft-sync-card {
  position: relative;
  padding-left: 20px;
}

.dc-draft-sync-card::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 9px;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #73818A;
  transform: translateY(-50%);
}

.dc-draft-sync-live {
  border-color: rgba(53, 216, 154, 0.32);
  background: rgba(53, 216, 154, 0.055);
}

.dc-draft-sync-live::before {
  background: #35D89A;
  box-shadow: 0 0 0 3px rgba(53, 216, 154, 0.10);
  animation: dc-live-pulse 1.8s ease-out infinite;
}

.dc-draft-sync-live > strong {
  color: #62DEAE;
}

.dc-draft-sync-delayed,
.dc-draft-sync-stale {
  border-color: rgba(228, 168, 61, 0.34);
  background: rgba(228, 168, 61, 0.055);
}

.dc-draft-sync-delayed::before,
.dc-draft-sync-stale::before {
  background: #E4A83D;
}

.dc-draft-sync-delayed > strong,
.dc-draft-sync-stale > strong {
  color: #F0BF63;
}

.dc-draft-sync-error {
  border-color: rgba(233, 104, 104, 0.38);
  background: rgba(233, 104, 104, 0.06);
}

.dc-draft-sync-error::before {
  background: #E96868;
}

.dc-draft-sync-error > strong {
  color: #FF9696;
}

.dc-status-btn[data-sync-level="delayed"],
.dc-status-btn[data-sync-level="stale"] {
  border-color: rgba(228, 168, 61, 0.38);
  color: #F0BF63;
}

.dc-status-btn[data-sync-level="error"] {
  border-color: rgba(233, 104, 104, 0.42);
  color: #FF9696;
}

.dc-between-picks-panel {
  flex: 0 0 auto;
  margin: 0 9px 7px;
  overflow: hidden;
  border: 1px solid #283842;
  border-radius: 11px;
  background:
    radial-gradient(circle at 100% 0%, rgba(75, 150, 220, 0.08), transparent 42%),
    rgba(6, 13, 17, 0.58);
}

.dc-between-picks-heading {
  min-height: 27px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 9px;
  border-bottom: 1px solid #23323A;
}

.dc-between-picks-heading > span {
  color: #DCE5E9;
  font-size: 9px;
  font-weight: 850;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.dc-between-picks-heading > small {
  color: #71818A;
  font-size: 9px;
  white-space: nowrap;
}

.dc-between-picks-panel .dc-rec-decision-row {
  margin: 0;
  padding: 8px 9px;
  border: 0;
  border-bottom: 1px solid #23323A;
  border-radius: 0;
  background: transparent;
}

.dc-personal-adp {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 2px 8px;
  padding: 7px 9px;
  border-bottom: 1px solid #23323A;
  background: rgba(243, 184, 63, 0.035);
}

.dc-personal-adp > span {
  grid-row: 1 / 3;
  color: #E5B956;
  font-size: 8px;
  font-weight: 850;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dc-personal-adp-title > em {
  display: block;
  margin-top: 3px;
  color: #DCE5E9;
  font: 750 8px 'IBM Plex Mono', monospace;
  letter-spacing: 0;
  text-transform: none;
}

.dc-mock-goal-track {
  width: 52px;
  height: 3px;
  display: block;
  margin-top: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: #25343C;
}

.dc-mock-goal-track > b {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #35D89A, #F3B83F);
}

.dc-personal-adp > strong,
.dc-personal-adp > small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dc-personal-adp > strong {
  color: #DCE5E9;
  font: 750 9px 'IBM Plex Mono', monospace;
}

.dc-personal-adp > small {
  color: #74848D;
  font-size: 8px;
}

.dc-personal-adp-building {
  background: rgba(255, 255, 255, 0.012);
}

.dc-personal-adp-building > span {
  color: #7F8D95;
}

.dc-between-picks-pressure {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 7px 9px 3px;
}

.dc-between-picks-pressure > strong,
.dc-between-picks-pressure > small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dc-between-picks-pressure > strong {
  color: #BFC9CE;
  font-size: 9px;
}

.dc-between-picks-pressure > small {
  color: #708089;
  font-size: 8px;
  text-align: right;
}

.dc-between-team-list {
  display: flex;
  gap: 4px;
  padding: 3px 9px 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.dc-between-team-list::-webkit-scrollbar {
  display: none;
}

.dc-between-team-chip {
  flex: 0 0 auto;
  min-width: 54px;
  padding: 4px 6px;
  border: 1px solid #24343D;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.018);
}

.dc-between-team-chip > strong,
.dc-between-team-chip > small {
  display: block;
  white-space: nowrap;
}

.dc-between-team-chip > strong {
  color: #B7C2C8;
  font-size: 8px;
}

.dc-between-team-chip > small {
  margin-top: 1px;
  color: #F2BE58;
  font-size: 8px;
  font-weight: 750;
}

.dc-between-team-empty {
  color: #75838B;
  font-size: 8px;
}

.dc-roster-guardrails {
  flex: 0 0 auto;
  padding: 0 10px 8px;
}

.dc-roster-guardrails > .dc-rec-section-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 4px;
}

.dc-roster-guardrails > .dc-rec-section-label > small {
  color: #65747D;
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
}

.dc-roster-guardrails > div {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.dc-roster-guardrails > div::-webkit-scrollbar {
  display: none;
}

.dc-roster-warning {
  flex: 0 0 auto;
  padding: 4px 7px;
  border: 1px solid #293941;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.02);
  color: #9DAAB1;
  font-size: 7px;
  font-weight: 700;
  white-space: nowrap;
}

.dc-roster-warning-good {
  border-color: rgba(53, 216, 154, 0.25);
  background: rgba(53, 216, 154, 0.07);
  color: #64DDAE;
}

.dc-roster-warning-warning {
  border-color: rgba(228, 168, 61, 0.30);
  background: rgba(228, 168, 61, 0.07);
  color: #EBC06A;
}

.dc-roster-warning-danger {
  border-color: rgba(233, 104, 104, 0.30);
  background: rgba(233, 104, 104, 0.07);
  color: #F28B8B;
}

.dc-rec-heading {
  min-height: 32px;
}

.dc-rec-primary {
  flex: 0 0 auto;
  min-height: 92px;
  margin: 8px 9px;
  padding: 10px;
}

.dc-rec-avatar {
  width: 44px;
  height: 44px;
  border-radius: 12px;
}

.dc-rec-grade {
  width: 56px;
  height: 56px;
  box-sizing: border-box;
  justify-self: center;
  align-self: center;
  padding: 0;
  border-radius: 12px;
  text-align: center;
}

.dc-rec-grade strong {
  font-size: 21px;
  line-height: 1;
  text-align: center;
}

.dc-rec-grade span {
  width: 100%;
  line-height: 1.05;
  text-align: center;
}

.dc-rec-alternatives {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  margin-top: 0;
  padding: 5px 8px 7px;
}

.dc-rec-alternatives > .dc-rec-section-label {
  grid-column: 1 / -1;
  margin-bottom: 0;
  text-align: center;
}

.dc-rec-alt {
  width: auto;
  min-width: 0;
  min-height: 44px;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: auto auto;
  align-items: center;
  justify-items: center;
  gap: 2px 4px;
  margin-top: 0;
  padding: 4px;
  text-align: center;
}

.dc-rec-alt > span:first-child {
  width: 100%;
  min-width: 0;
  grid-column: 1 / -1;
  text-align: center;
}

.dc-rec-alt > span:first-child strong,
.dc-rec-alt > span:first-child small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dc-rec-alt > .dc-rec-alt-score {
  grid-column: 1;
  justify-self: center;
  text-align: center;
}

.dc-rec-alt > small {
  grid-column: 2;
  justify-self: center;
  line-height: 1.15;
  text-align: center;
}

.dc-stack-targets {
  flex: 0 0 auto;
  padding: 7px 9px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(12, 19, 31, 0.72);
}

.dc-stack-targets > .dc-rec-section-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.dc-stack-targets > .dc-rec-section-label small {
  color: #8694A8;
  font-size: 8px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
}

.dc-stack-target-list {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.dc-stack-target-list::-webkit-scrollbar {
  height: 3px;
}

.dc-stack-target {
  flex: 1 0 142px;
  min-width: 0;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  padding: 6px;
  border: 1px solid rgba(232, 185, 78, 0.22);
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(232, 185, 78, 0.09), rgba(20, 31, 48, 0.9));
  color: #F5F7FA;
  cursor: pointer;
  text-align: left;
}

.dc-stack-target:hover {
  border-color: rgba(232, 185, 78, 0.55);
  transform: translateY(-1px);
}

.dc-stack-avatar {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 50%;
  background: #172235;
  color: #E8B94E;
  font-size: 11px;
  font-weight: 800;
}

.dc-stack-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dc-stack-copy,
.dc-stack-copy strong,
.dc-stack-copy small,
.dc-stack-copy em {
  min-width: 0;
  display: block;
}

.dc-stack-copy strong,
.dc-stack-copy small,
.dc-stack-copy em {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dc-stack-copy strong {
  font-size: 10px;
}

.dc-stack-copy small {
  margin-top: 1px;
  color: #AEB9C8;
  font-size: 8px;
}

.dc-stack-copy em {
  margin-top: 2px;
  color: #E8B94E;
  font-size: 7px;
  font-style: normal;
}

.dc-availability-curve {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  margin-top: 6px;
}

.dc-availability-curve > span {
  padding: 4px;
  border: 1px solid rgba(122, 167, 255, 0.16);
  border-radius: 7px;
  background: rgba(122, 167, 255, 0.06);
  text-align: center;
}

.dc-availability-curve strong,
.dc-availability-curve small {
  display: block;
}

.dc-availability-curve strong {
  color: #DCE7FF;
  font-size: 9px;
}

.dc-availability-curve small {
  margin-top: 1px;
  color: #91A0B4;
  font-size: 7px;
}

.dc-personal-volatility {
  display: block;
  margin-top: 4px;
  color: #8795A9;
  font-size: 7px;
  font-style: normal;
  text-align: center;
}

.dc-draft-paths {
  flex: 0 0 auto;
  padding: 7px 9px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(8, 14, 24, 0.88);
}

.dc-draft-paths > .dc-rec-section-label {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 5px;
}

.dc-draft-paths > .dc-rec-section-label small {
  color: #8290A3;
  font-size: 8px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
}

.dc-draft-path {
  width: 100%;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) 9px minmax(0, 1fr) 9px minmax(0, 1fr) auto;
  align-items: center;
  gap: 3px;
  margin-top: 4px;
  padding: 5px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(20, 30, 45, 0.75);
  color: #EEF3F9;
  cursor: pointer;
  text-align: left;
}

.dc-draft-path-best {
  border-color: rgba(79, 209, 197, 0.35);
  background: linear-gradient(90deg, rgba(79, 209, 197, 0.10), rgba(20, 30, 45, 0.8));
}

.dc-draft-path-rank {
  color: #4FD1C5;
  font-size: 11px;
  font-weight: 900;
  text-align: center;
}

.dc-draft-path-step,
.dc-draft-path-step strong,
.dc-draft-path-step small {
  min-width: 0;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dc-draft-path-step strong {
  font-size: 8px;
}

.dc-draft-path-step small {
  color: #8E9CAE;
  font-size: 7px;
}

.dc-draft-path > i {
  color: #536176;
  font-size: 8px;
  font-style: normal;
}

.dc-draft-path > em {
  color: #4FD1C5;
  font-size: 7px;
  font-style: normal;
  white-space: nowrap;
}

.dc-handcuff-targets {
  border-top-color: rgba(192, 132, 252, 0.16);
}

.dc-handcuff-target {
  border-color: rgba(192, 132, 252, 0.22);
  background: linear-gradient(135deg, rgba(192, 132, 252, 0.08), rgba(20, 31, 48, 0.9));
}

.dc-report-strategies {
  margin-top: 12px;
}

.dc-report-strategies > p {
  margin: 5px 0 8px;
  color: #9AA8B9;
  font-size: 10px;
}

.dc-report-strategy-list {
  display: grid;
  gap: 5px;
}

.dc-report-strategy-row {
  display: grid;
  grid-template-columns: 90px 60px 1fr 90px;
  gap: 7px;
  align-items: center;
  padding: 7px 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(20, 30, 45, 0.62);
  color: #9EABBB;
  font-size: 9px;
}

.dc-report-strategy-row strong {
  color: #EEF3F9;
}

.dc-report-strategy-best {
  border-color: rgba(79, 209, 197, 0.32);
  background: rgba(79, 209, 197, 0.08);
}

.dc-report-calibration {
  margin-top: 12px;
  padding: 11px;
  border: 1px solid #283740;
  border-radius: 11px;
  background: #0D151A;
}

.dc-report-calibration > p {
  margin: 7px 0 9px;
  color: #9AA8B9;
  font-size: 9px;
}

.dc-report-calibration-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin-top: 7px;
}

.dc-report-calibration-metrics > div {
  padding: 8px 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(20, 30, 45, 0.62);
  text-align: center;
}

.dc-report-calibration-metrics span,
.dc-report-calibration-metrics strong {
  display: block;
}

.dc-report-calibration-metrics span {
  color: #7F8B92;
  font-size: 7px;
  font-weight: 750;
  text-transform: uppercase;
}

.dc-report-calibration-metrics strong {
  margin-top: 3px;
  color: #65D6A8;
  font: 800 14px 'IBM Plex Mono', monospace;
}

.dc-report-calibration-list {
  display: grid;
  gap: 4px;
}

.dc-report-calibration-row {
  display: grid;
  grid-template-columns: 55px 65px 1fr 1fr;
  gap: 6px;
  align-items: center;
  padding: 6px 7px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  color: #9EABBB;
  font-size: 8px;
}

.dc-report-calibration-row strong {
  color: #EEF3F9;
}

.dc-recommendation {
  overflow-x: hidden;
  overflow-y: auto;
}

.dc-recommendation::-webkit-scrollbar {
  width: 4px;
}

.dc-recommendation::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(122, 167, 255, 0.24);
}

/* Balanced desktop recommendation summary */
@media (min-width: 1081px) {
  .dc-controls {
    grid-template-columns: minmax(170px, 1fr) max-content 116px;
    grid-template-areas: "search chips sort";
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-right: 0;
    border-left: 1px solid #1E2A32;
  }

  .dc-chips {
    grid-template-columns: repeat(5, 34px);
    gap: 5px;
  }

  .dc-rec-heading {
    min-height: 34px;
    padding: 0 10px;
    font-size: 9px;
  }

  .dc-rec-primary {
    grid-template-columns: 44px minmax(0, 1fr) 56px;
    gap: 8px;
  }

  .dc-between-picks-panel {
    min-height: 0;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    margin: 0 9px 9px;
  }

  .dc-between-picks-heading {
    min-height: 32px;
    padding: 0 10px;
  }

  .dc-between-picks-heading > span,
  .dc-between-picks-heading > small {
    font-size: 9px;
  }

  .dc-between-picks-panel .dc-rec-decision-row {
    min-height: 64px;
    flex: 0 0 auto;
    gap: 9px;
    padding: 10px;
  }

  .dc-rec-urgency {
    padding: 6px 8px;
    font-size: 10px;
  }

  .dc-rec-probability strong {
    font-size: 16px;
  }

  .dc-rec-probability > span:not(.dc-rec-probability-track) {
    font-size: 9px;
  }

  .dc-rec-probability-track {
    margin-top: 6px;
  }

  .dc-personal-adp {
    min-height: 0;
    flex: 1 1 auto;
    grid-template-columns: auto minmax(0, 1fr);
    align-content: center;
    gap: 4px 8px;
    padding: 11px 10px;
  }

  .dc-personal-adp > span {
    font-size: 9px;
    white-space: nowrap;
  }

  .dc-personal-adp-title > em {
    margin-top: 4px;
    font-size: 9px;
  }

  .dc-mock-goal-track {
    width: 62px;
    height: 4px;
    margin-top: 4px;
  }

  .dc-personal-adp > strong {
    font-size: 10px;
  }

  .dc-personal-adp > small {
    font-size: 9px;
  }

  .dc-availability-curve {
    grid-column: 1 / -1;
    gap: 6px;
    margin-top: 8px;
  }

  .dc-availability-curve > span {
    padding: 6px 4px;
  }

  .dc-availability-curve strong {
    font-size: 10px;
  }

  .dc-availability-curve small {
    margin-top: 2px;
    font-size: 8px;
  }

  .dc-personal-volatility {
    grid-column: 1 / -1;
    margin-top: 2px;
    font-size: 8px;
    line-height: 1.3;
  }
}

@media (max-width: 1080px) {
  .dc-draft-context-card {
    padding-right: 7px;
    padding-left: 7px;
  }

  .dc-draft-sync-card {
    padding-left: 18px;
  }

  .dc-draft-context-card > strong {
    font-size: 10px;
  }
}

`;
