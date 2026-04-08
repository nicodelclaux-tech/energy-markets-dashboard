// Application entry point. Ties all modules together.
// loadData → init state → build DOM → first render.
var APP = (function () {

  var _data = null;

  function _subtractMonths(dateStr, months) {
    var d = new Date(dateStr + 'T00:00:00Z');
    d.setMonth(d.getMonth() - months);
    return d.toISOString().slice(0, 10);
  }

  function _activateTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tabName);
    });
    document.querySelectorAll('.page').forEach(function (p) {
      p.classList.toggle('active', p.id === 'page-' + tabName);
    });

    setTimeout(function () { Charts.resizeAll(); }, 50);

    if (tabName === 'power') {
      var s = AppState.getState();
      UI.renderMainChart(s, _data);
      UI.renderRanking(s, _data);
      UI.renderSpread(s, _data);
      UI.renderDistribution(s, _data);
      UI.renderMonthlySummary(s, _data);
    }

    if (tabName === 'commodities') {
      var cs = AppState.getCommodityState();
      CommodityUI.renderMainChart(cs, _data);
      CommodityUI.renderRanking(cs, _data);
      CommodityUI.renderSpread(cs, _data);
      CommodityUI.renderDistribution(cs, _data);
      CommodityUI.renderMonthlySummary(cs, _data);
    }
  }

  function _applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('energy_theme', theme);
    } catch (e) {
      // Ignore storage errors in locked-down environments
    }
    var btn = document.getElementById('btn-theme');
    if (btn) {
      btn.textContent = theme === 'dark' ? 'Light' : 'Dark';
      btn.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' theme');
    }
  }

  function _initTheme() {
    var saved = null;
    try {
      saved = localStorage.getItem('energy_theme');
    } catch (e) {
      saved = null;
    }
    var initial = (saved === 'light' || saved === 'dark') ? saved : 'dark';
    _applyTheme(initial);

    var btn = document.getElementById('btn-theme');
    if (btn) {
      btn.addEventListener('click', function () {
        var current = document.body.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        _applyTheme(current === 'light' ? 'dark' : 'light');
        renderApp();
        Charts.resizeAll();
      });
    }
  }

  function renderApp() {
    var powerState = AppState.getState();
    var commodityState = AppState.getCommodityState();
    var powerVisible = document.getElementById('page-power').classList.contains('active');
    var commodityVisible = document.getElementById('page-commodities').classList.contains('active');

    UI.syncControls(powerState);
    UI.renderKPIs(powerState, _data);
    if (powerVisible) {
      UI.renderMainChart(powerState, _data);
      UI.renderRanking(powerState, _data);
      UI.renderSpread(powerState, _data);
      UI.renderDistribution(powerState, _data);
      UI.renderMonthlySummary(powerState, _data);
    }

    CommodityUI.syncControls(commodityState);
    CommodityUI.renderKPIs(commodityState, _data);
    if (commodityVisible) {
      CommodityUI.renderMainChart(commodityState, _data);
      CommodityUI.renderRanking(commodityState, _data);
      CommodityUI.renderSpread(commodityState, _data);
      CommodityUI.renderDistribution(commodityState, _data);
      CommodityUI.renderMonthlySummary(commodityState, _data);
    }
  }

  function init() {
    _initTheme();
    _data = DataLoader.loadData();

    // Seed state directly (no render yet)
    var state = AppState.getState();
    var end = _data.latestDate;
    var start = end ? _subtractMonths(end, 12) : _data.earliestDate;
    state.dateRange = { start: start || _data.earliestDate, end: end };
    state.periodPreset = 12;

    // Seed commodity state
    AppState.resetCommodityState(_data);

    // Build controls DOM + attach listeners
    UI.initControls(_data);
    CommodityUI.initControls(_data);

    // Render overview (static, no ECharts)
    Overview.render(_data);

    // Footer coverage text
    var covEl = document.getElementById('footer-coverage');
    if (covEl && _data.earliestDate && _data.latestDate) {
      var populated = Object.keys(_data.dataCoverage).filter(function (iso) { return _data.dataCoverage[iso] > 0; });
      covEl.textContent = _data.earliestDate + ' — ' + _data.latestDate + ' · ' + populated.length + ' markets';
    }

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _activateTab(btn.dataset.tab);
      });
    });

    // Reset button
    document.getElementById('btn-reset').addEventListener('click', function () {
      if (document.getElementById('page-commodities').classList.contains('active')) {
        AppState.resetCommodityState(_data);
      } else {
        AppState.resetState(_data);
      }
    });

    // Window resize → ECharts resize
    window.addEventListener('resize', function () { Charts.resizeAll(); });

    // Expose renderApp globally so AppState.setState() can call it
    window.renderApp = renderApp;

    // First render
    renderApp();
  }

  return {
    init: init,
    activateTab: _activateTab
  };
}());

document.addEventListener('DOMContentLoaded', function () {
  if (typeof echarts === 'undefined') {
    document.body.innerHTML = '<div style="color:#e05252;padding:48px 32px;font-family:monospace;background:#0d1117;min-height:100vh">'
      + '<strong>ECharts failed to load.</strong><br>An internet connection is required to load the charting library. '
      + 'Please check your connection and reload the page.</div>';
    return;
  }
  window.APP = APP;
  APP.init();
});
