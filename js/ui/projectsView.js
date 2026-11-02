// ui/projectsView.js — the Projects tab.
window.Mayor = window.Mayor || {};
Mayor.ui = Mayor.ui || {};

(function () {
  const U = Mayor.util;
  let onBuild = () => {};

  function init(handlers) {
    onBuild = handlers.onBuild;
    document.getElementById('projects-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-build]');
      if (btn && !btn.disabled) onBuild(btn.dataset.build);
    });
  }

  function effectChips(def) {
    const chips = Mayor.events.describe({ modifiers: Object.entries(def.effects).map(([key, amount]) => ({ key, amount, turns: 0 })) });
    return chips.map((c) => `<span class="chip chip--${c.tone}">${c.text.replace(' for 0 qtrs', '')}</span>`).join('');
  }

  function render(state) {
    const html = Mayor.projects.CATALOG.map((def) => {
      const status = Mayor.projects.statusOf(state, def.id);
      const entry = state.projects.find((p) => p.id === def.id);
      let footer;
      if (status === 'built') {
        footer = '<span class="chip chip--good" style="justify-content:center">Open and running</span>';
      } else if (status === 'building') {
        const done = def.buildTime - entry.turnsLeft;
        footer = `
          <div class="progress"><span style="width:${(done / def.buildTime) * 100}%"></span></div>
          <div class="reason">Under construction · ${entry.turnsLeft} quarter${entry.turnsLeft === 1 ? '' : 's'} left</div>`;
      } else {
        const check = Mayor.projects.canBuild(state, def.id);
        footer = `
          <button class="btn ${check.ok ? 'btn--accent' : ''} btn--block" data-build="${def.id}" ${check.ok ? '' : 'disabled'}>
            Build for ${U.money(def.cost)}
          </button>
          ${check.ok ? '' : `<div class="reason">${check.reason}</div>`}`;
      }
      return `
        <article class="card project ${status === 'built' ? 'is-built' : ''}">
          <div class="project-head">
            <h4>${def.name}</h4>
            <span class="chip">${def.category}</span>
          </div>
          <p>${def.description}</p>
          <div class="project-stats">
            <div><span>Cost</span><b>${U.money(def.cost)}</b></div>
            <div><span>Build</span><b>${def.buildTime} qtrs</b></div>
            <div><span>Upkeep</span><b class="${def.upkeep < 0 ? 'pos' : ''}">${def.upkeep < 0 ? 'Saves ' + U.money(-def.upkeep) : U.money(def.upkeep)}</b></div>
          </div>
          <div class="effect-chips">${effectChips(def)}</div>
          ${footer}
        </article>`;
    }).join('');
    document.getElementById('projects-grid').innerHTML = html;
  }

  Mayor.ui.projectsView = { init, render };
})();
