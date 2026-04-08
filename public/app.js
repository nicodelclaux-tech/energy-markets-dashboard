// Application entry point. Ties all modules together.
// loadData → init state → build DOM → first render.
var APP = (function () {

  var _data = null;

  function renderApp() {
    var state = AppState.getState();
    // Only render the active tab's charts to avoid hidden-canvas sizing issues
    var analysisVisible = document.getElementById('page-analysis').classList.contains('active');
    UI.syncControls(state);
    UI.renderKPIs(state, _data);
    if (analysisVisible) {
      UI.renderMainChart(state, _data);
      UI.renderRanking(state, _data);
      UI.renderSpread(state, _data);
      UI.renderDistribution(state, _data);
      UI.renderMonthlySummary(state, _data);
    }
  }

  function init() {
    _data = DataLoader.loadData();

    // Seed state directly (no render yet)
    var state = AppState.getState();
    state.dateRange = { start: _data.earliestDate, end: _data.latestDate };
    state.rankingDate = _data.latestDate;

    // Build controls DOM + attach listeners
    UI.initControls(_data);

    // Render overview (static, no ECharts)
    Overview.render(_data);

    // Header coverage text
    var covEl = document.getElementById('header-coverage');
    if (covEl && _data.earliestDate && _data.latestDate) {
      var populated = Object.keys(_data.dataCoverage).filter(function (iso) { return _data.dataCoverage[iso] > 0; });
      covEl.textContent = _data.earliestDate + ' — ' + _data.latestDate + ' · ' + populated.length + ' markets';
    }

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
        document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
        btn.classList.add('active');
        document.getElementById('page-' + btn.dataset.tab).classList.add('active');
        // ECharts needs a resize call after becoming visible
        setTimeout(function () { Charts.resizeAll(); }, 50);
        // Also ensure analysis charts are rendered if switching to analysis
        if (btn.dataset.tab === 'analysis') {
          var s = AppState.getState();
          UI.renderMainChart(s, _data);
          UI.renderRanking(s, _data);
          UI.renderSpread(s, _data);
          UI.renderDistribution(s, _data);
          UI.renderMonthlySummary(s, _data);
        }
      });
    });

    // Reset button
    document.getElementById('btn-reset').addEventListener('click', function () {
      AppState.resetState(_data);
    });

    // Window resize → ECharts resize
    window.addEventListener('resize', function () { Charts.resizeAll(); });

    // Expose renderApp globally so AppState.setState() can call it
    window.renderApp = renderApp;

    // First render
    renderApp();
  }

  return { init: init };
}());

document.addEventListener('DOMContentLoaded', function () {
  if (typeof echarts === 'undefined') {
    document.body.innerHTML = '<div style="color:#e05252;padding:48px 32px;font-family:monospace;background:#0d1117;min-height:100vh">'
      + '<strong>ECharts failed to load.</strong><br>An internet connection is required to load the charting library. '
      + 'Please check your connection and reload the page.</div>';
    return;
  }
  APP.init();
});
