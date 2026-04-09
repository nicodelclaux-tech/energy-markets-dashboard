// Application entry point — Axiom Institutional Design System.
// loadData → init state → build DOM → first render.
var APP = (function () {

  var _data = null;

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  function _subtractMonths(dateStr, months) {
    var d = new Date(dateStr + 'T00:00:00Z');
    d.setMonth(d.getMonth() - months);
    return d.toISOString().slice(0, 10);
  }

  function _scheduleChartResize() {
    if (typeof requestAnimationFrame !== 'function') {
      Charts.resizeAll();
      return;
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        Charts.resizeAll();
      });
    });
  }

  // ------------------------------------------------------------------
  // Live clock
  // ------------------------------------------------------------------

  function _startClock() {
    var el = document.getElementById('app-clock');
    if (!el) return;
    function tick() {
      var now = new Date();
      var hh = String(now.getUTCHours()).padStart(2, '0');
      var mm = String(now.getUTCMinutes()).padStart(2, '0');
      var ss = String(now.getUTCSeconds()).padStart(2, '0');
      el.textContent = 'TIME: ' + hh + ':' + mm + ':' + ss + ' GMT';
    }
    tick();
    setInterval(tick, 1000);
  }

  // ------------------------------------------------------------------
  // Tab / sidebar nav activation
  // ------------------------------------------------------------------

  function _activateTab(tabName) {
    // Sidebar nav items
    document.querySelectorAll('.axiom-nav-item').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tabName);
    });
    // Legacy tab-btn (none in new HTML but keep for safety)
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tabName);
    });
    document.querySelectorAll('.page').forEach(function (p) {
      p.classList.toggle('active', p.id === 'page-' + tabName);
    });

    _scheduleChartResize();

    if (tabName === 'power') {
      var s = AppState.getState();
      UI.renderMainChart(s, _data);
      UI.renderRanking(s, _data);
      UI.renderSpread(s, _data);
      UI.renderDistribution(s, _data);
      UI.renderMonthlySummary(s, _data);
      UI.renderHeatmap(s, _data);
      UI.renderNews(s, _data);
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

  // ------------------------------------------------------------------
  // Theme
  // ------------------------------------------------------------------

  function _applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('energy_theme', theme); } catch (e) {}
    var iconFile  = theme === 'dark' ? 'light-mode.svg' : 'dark-mode.svg';
    var ariaLabel = 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' theme';
    document.querySelectorAll('[data-action="toggle-theme"]').forEach(function (btn) {
      btn.innerHTML = '<img src="assets/icons/' + iconFile + '" alt="' + ariaLabel + '" class="theme-toggle-icon">';
      btn.setAttribute('aria-label', ariaLabel);
    });
  }

  function _initTheme() {
    var saved = null;
    try { saved = localStorage.getItem('energy_theme'); } catch (e) {}
    _applyTheme((saved === 'light' || saved === 'dark') ? saved : 'dark');

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action="toggle-theme"]');
      if (!btn) return;
      var current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      _applyTheme(current === 'light' ? 'dark' : 'light');
      renderApp();
      _scheduleChartResize();
    });
  }

  // ------------------------------------------------------------------
  // Density toggle (Compact / Standard)
  // ------------------------------------------------------------------

  function _initDensity() {
    var saved = null;
    try { saved = localStorage.getItem('energy_density'); } catch (e) {}
    if (saved === 'compact') {
      document.getElementById('app-body').classList.add('density-compact');
    }

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action="toggle-density"]');
      if (!btn) return;
      var body = document.getElementById('app-body');
      body.classList.toggle('density-compact');
      try {
        localStorage.setItem('energy_density', body.classList.contains('density-compact') ? 'compact' : 'standard');
      } catch (e) {}
    });
  }

  // ------------------------------------------------------------------
  // Ticker bar
  // ------------------------------------------------------------------

  function _buildTicker(data) {
    var inner = document.getElementById('ticker-inner');
    if (!inner) return;

    var items = [];

    // Power markets — show latest price + 1-day delta
    data.countryOrder.forEach(function (iso) {
      var s = data.seriesByIso[iso];
      if (!s || s.length < 2) return;
      var last  = s[s.length - 1].price;
      var prev  = s[s.length - 2].price;
      var delta = last - prev;
      var name  = ((data.countriesByIso[iso] || {}).name || iso).slice(0, 3).toUpperCase();
      items.push({ label: name + ' DA', price: last, delta: delta, unit: '' });
    });

    // Commodities
    data.commodityOrder.forEach(function (id) {
      var s = data.seriesByIso[id];
      if (!s || s.length < 2) return;
      var last  = s[s.length - 1].price;
      var prev  = s[s.length - 2].price;
      var delta = last - prev;
      items.push({ label: id, price: last, delta: delta, unit: '' });
    });

    if (items.length === 0) {
      inner.textContent = 'No data available';
      return;
    }

    inner.innerHTML = items.map(function (item) {
      var cls   = item.delta > 0.01 ? 'axiom-ticker-item-up' : item.delta < -0.01 ? 'axiom-ticker-item-down' : 'axiom-ticker-item-flat';
      var arrow = item.delta > 0.01 ? '\u2191' : item.delta < -0.01 ? '\u2193' : '\u2014';
      var priceStr = Math.abs(item.price) < 10 ? item.price.toFixed(2) : Math.round(item.price).toString();
      var deltaStr = Math.abs(item.delta) > 0.01
        ? (item.delta > 0 ? '+' : '') + item.delta.toFixed(1)
        : '';
      return '<span class="axiom-ticker-item">'
        + '<span class="axiom-ticker-item-label">' + item.label + '</span>'
        + '<span class="axiom-ticker-item-price">' + priceStr + '</span>'
        + '<span class="' + cls + '">' + arrow + (deltaStr ? ' ' + deltaStr : '') + '</span>'
        + '</span>';
    }).join('');
  }

  // ------------------------------------------------------------------
  // Command palette
  // ------------------------------------------------------------------

  var _cmdOpen = false;
  var _cmdSelected = 0;
  var _cmdFilteredItems = [];

  function _setRange(months) {
    if (!_data) return;
    var end   = _data.latestDate;
    var start = months === 0 ? _data.earliestDate : _subtractMonths(end, months);
    AppState.setState({ dateRange: { start: start, end: end }, periodPreset: months });
  }

  function _buildCmdItems() {
    var items = [
      { icon: '\u229e', label: 'Overview',           hint: '',   action: function () { _activateTab('overview'); } },
      { icon: '\u26a1', label: 'Power Markets',      hint: '',   action: function () { _activateTab('power'); } },
      { icon: '\u26bd', label: 'Commodity Markets',  hint: '',   action: function () { _activateTab('commodities'); } },
      { icon: '\u25d0', label: 'Toggle Theme',       hint: '',   action: function () {
          var c = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
          _applyTheme(c === 'light' ? 'dark' : 'light'); renderApp(); _scheduleChartResize();
        }
      },
      { icon: '\u2261', label: 'Toggle Density',     hint: 'D',  action: function () {
          document.getElementById('app-body').classList.toggle('density-compact');
        }
      },
      { icon: '1M',  label: 'Range: 1 Month',   hint: '1', action: function () { _setRange(1); } },
      { icon: '3M',  label: 'Range: 3 Months',  hint: '',  action: function () { _setRange(3); } },
      { icon: '6M',  label: 'Range: 6 Months',  hint: '2', action: function () { _setRange(6); } },
      { icon: '1Y',  label: 'Range: 1 Year',    hint: '3', action: function () { _setRange(12); } },
      { icon: '2Y',  label: 'Range: 2 Years',   hint: '',  action: function () { _setRange(24); } },
      { icon: 'ALL', label: 'Range: All Time',  hint: '0', action: function () { _setRange(0); } }
    ];

    // Country-level market switches
    if (_data) {
      _data.countryOrder.forEach(function (iso) {
        var isoCapture = iso;
        var name = (_data.countriesByIso[iso] || {}).name || iso;
        items.push({
          icon: '\u26a1',
          label: 'Power: ' + name,
          hint: iso,
          action: function () {
            _activateTab('power');
            AppState.setState({ primaryCountry: isoCapture });
          }
        });
      });
    }

    return items;
  }

  function _openCmd() {
    var palette = document.getElementById('cmd-palette');
    if (!palette) return;
    palette.classList.remove('hidden');
    palette.setAttribute('aria-hidden', 'false');
    _cmdOpen = true;
    _cmdSelected = 0;
    var input = document.getElementById('cmd-input');
    if (input) { input.value = ''; input.focus(); }
    _renderCmdResults('');
  }

  function _closeCmd() {
    var palette = document.getElementById('cmd-palette');
    if (!palette) return;
    palette.classList.add('hidden');
    palette.setAttribute('aria-hidden', 'true');
    _cmdOpen = false;
  }

  function _renderCmdResults(query) {
    var el = document.getElementById('cmd-results');
    if (!el) return;
    var q = (query || '').toLowerCase().trim();
    var base = _buildCmdItems();
    _cmdFilteredItems = q ? base.filter(function (item) {
      return item.label.toLowerCase().indexOf(q) !== -1 ||
             (item.hint || '').toLowerCase().indexOf(q) !== -1;
    }) : base;

    if (_cmdFilteredItems.length === 0) {
      el.innerHTML = '<div class="axiom-cmd-item" style="opacity:0.5;cursor:default">No results</div>';
      return;
    }
    if (_cmdSelected >= _cmdFilteredItems.length) _cmdSelected = 0;

    el.innerHTML = _cmdFilteredItems.map(function (item, i) {
      return '<div class="axiom-cmd-item' + (i === _cmdSelected ? ' selected' : '') + '" data-cmd-idx="' + i + '">'
        + '<span class="axiom-cmd-item-icon">' + item.icon + '</span>'
        + '<span class="axiom-cmd-item-label">' + item.label + '</span>'
        + (item.hint ? '<span class="axiom-cmd-item-hint">' + item.hint + '</span>' : '')
        + '</div>';
    }).join('');

    el.querySelectorAll('.axiom-cmd-item[data-cmd-idx]').forEach(function (row) {
      row.addEventListener('mouseenter', function () {
        _cmdSelected = parseInt(row.getAttribute('data-cmd-idx'), 10);
        _highlightCmdItem();
      });
      row.addEventListener('click', function () {
        var idx = parseInt(row.getAttribute('data-cmd-idx'), 10);
        if (_cmdFilteredItems[idx]) { _cmdFilteredItems[idx].action(); }
        _closeCmd();
      });
    });
  }

  function _highlightCmdItem() {
    document.querySelectorAll('#cmd-results .axiom-cmd-item').forEach(function (el, i) {
      el.classList.toggle('selected', i === _cmdSelected);
    });
  }

  function _initCommandPalette() {
    var backdrop = document.getElementById('cmd-backdrop');
    if (backdrop) backdrop.addEventListener('click', _closeCmd);

    var input = document.getElementById('cmd-input');
    if (input) {
      input.addEventListener('input', function () {
        _cmdSelected = 0;
        _renderCmdResults(input.value);
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          _cmdSelected = Math.min(_cmdSelected + 1, _cmdFilteredItems.length - 1);
          _highlightCmdItem();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          _cmdSelected = Math.max(_cmdSelected - 1, 0);
          _highlightCmdItem();
        } else if (e.key === 'Enter') {
          if (_cmdFilteredItems[_cmdSelected]) {
            _cmdFilteredItems[_cmdSelected].action();
            _closeCmd();
          }
        } else if (e.key === 'Escape') {
          _closeCmd();
        }
      });
    }

    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-action="open-cmd"]')) { _openCmd(); }
    });
  }

  // ------------------------------------------------------------------
  // Keyboard shortcuts
  // ------------------------------------------------------------------

  function _initKeyboard() {
    document.addEventListener('keydown', function (e) {
      // Cmd+K / Ctrl+K — command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        _cmdOpen ? _closeCmd() : _openCmd();
        return;
      }

      // Ignore shortcuts when typing in inputs
      var tag = document.activeElement ? document.activeElement.tagName : '';
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (_cmdOpen) return;

      // Number keys — time range
      if (e.key === '1') { _setRange(1); }
      else if (e.key === '2') { _setRange(6); }
      else if (e.key === '3') { _setRange(12); }
      else if (e.key === '4') { _setRange(24); }
      else if (e.key === '0') { _setRange(0); }

      // D — density
      if (e.key === 'd' || e.key === 'D') {
        document.getElementById('app-body').classList.toggle('density-compact');
      }

      // Escape
      if (e.key === 'Escape') { _closeCmd(); }
    });
  }

  // ------------------------------------------------------------------
  // renderApp
  // ------------------------------------------------------------------

  function renderApp() {
    var powerState     = AppState.getState();
    var commodityState = AppState.getCommodityState();
    var powerVisible     = document.getElementById('page-power').classList.contains('active');
    var commodityVisible = document.getElementById('page-commodities').classList.contains('active');

    UI.syncControls(powerState);
    UI.renderKPIs(powerState, _data);
    if (powerVisible) {
      UI.renderMainChart(powerState, _data);
      UI.renderRanking(powerState, _data);
      UI.renderSpread(powerState, _data);
      UI.renderDistribution(powerState, _data);
      UI.renderMonthlySummary(powerState, _data);
      UI.renderHeatmap(powerState, _data);
      UI.renderNews(powerState, _data);
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

  // ------------------------------------------------------------------
  // init
  // ------------------------------------------------------------------

  function init() {
    _initTheme();
    _initDensity();
    _data = DataLoader.loadData();

    // Data quality warnings
    UI.renderWarningsBanner(_data);

    // Seed state
    var state = AppState.getState();
    var end   = _data.latestDate;
    var start = end ? _subtractMonths(end, 12) : _data.earliestDate;
    state.dateRange  = { start: start || _data.earliestDate, end: end };
    state.periodPreset = 12;

    AppState.resetCommodityState(_data);

    // Build controls DOM + attach listeners
    UI.initControls(_data);
    CommodityUI.initControls(_data);

    // Render overview (static, no ECharts)
    Overview.render(_data);

    // Ticker bar
    _buildTicker(_data);

    // Footer / ticker coverage text
    var covEl = document.getElementById('footer-coverage');
    if (covEl && _data.earliestDate && _data.latestDate) {
      var populated = Object.keys(_data.dataCoverage).filter(function (iso) {
        return _data.dataCoverage[iso] > 0;
      });
      covEl.textContent = _data.earliestDate + ' \u2014 ' + _data.latestDate + ' \u00b7 ' + populated.length + ' markets';
    }

    // Live clock
    _startClock();

    // Sidebar nav click handlers
    document.querySelectorAll('.axiom-nav-item[data-tab]').forEach(function (btn) {
      if (btn.disabled) return;
      btn.addEventListener('click', function () {
        _activateTab(btn.dataset.tab);
      });
    });

    // Command palette
    _initCommandPalette();

    // Keyboard shortcuts
    _initKeyboard();

    // Window resize -> ECharts resize
    window.addEventListener('resize', function () { _scheduleChartResize(); });

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
    document.body.innerHTML = '<div style="color:#fb7185;padding:48px 32px;font-family:IBM Plex Mono,monospace;background:#020617;min-height:100vh">'
      + '<strong>ECharts failed to load.</strong><br>The local charting assets could not be loaded. '
      + 'Please verify the files under public/vendor/echarts-map and reload the page.</div>';
    return;
  }
  window.APP = APP;
  APP.init();
});
