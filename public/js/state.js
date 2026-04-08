// Application state — plain JS, no framework.
// setState() calls window.renderApp() which is wired in app.js after init.
var AppState = (function () {
  var _state = {
    primaryCountry: 'ES',
    comparisonCountries: [],
    benchmarkCountry: 'EU_AVG',
    dateRange: { start: null, end: null },
    aggregation: 'daily',     // 'daily' | 'monthly' | 'yearly'
    smoothingWindow: 7,       // 0 = none
    rankingDate: null,        // ISO date string, set to latest on load
    periodPreset: 0,
    mapWindow: 'CURRENT'
  };

  var _commodityState = {
    primaryCountry: 'WTI',
    comparisonCountries: [],
    benchmarkCountry: 'Brent',
    dateRange: { start: null, end: null },
    aggregation: 'daily',
    smoothingWindow: 7,
    rankingDate: null,
    periodPreset: 12
  };

  function getState() {
    return _state;
  }

  function _subtractMonths(dateStr, months) {
    var d = new Date(dateStr + 'T00:00:00Z');
    d.setMonth(d.getMonth() - months);
    return d.toISOString().slice(0, 10);
  }

  function setState(patch) {
    if (patch.dateRange) {
      _state.dateRange = Object.assign({}, _state.dateRange, patch.dateRange);
      delete patch.dateRange;
    }
    Object.assign(_state, patch);
    if (typeof window.renderApp === 'function') {
      window.renderApp();
    }
  }

  function getCommodityState() {
    return _commodityState;
  }

  function setCommodityState(patch) {
    if (patch.dateRange) {
      _commodityState.dateRange = Object.assign({}, _commodityState.dateRange, patch.dateRange);
      delete patch.dateRange;
    }
    Object.assign(_commodityState, patch);
    if (typeof window.renderApp === 'function') {
      window.renderApp();
    }
  }

  function resetState(data) {
    _state.primaryCountry = 'ES';
    _state.comparisonCountries = [];
    _state.benchmarkCountry = 'EU_AVG';
    var end = data.latestDate;
    var start = end ? _subtractMonths(end, 12) : data.earliestDate;
    _state.dateRange = { start: start || data.earliestDate, end: end };
    _state.aggregation = 'daily';
    _state.smoothingWindow = 7;
    _state.rankingDate = data.latestDate;
    _state.periodPreset = 12;
    _state.mapWindow = 'CURRENT';
    if (typeof window.renderApp === 'function') {
      window.renderApp();
    }
  }

  function resetCommodityState(data) {
    var defaultPrimary = (data.commodityOrder && data.commodityOrder[0]) || 'WTI';
    var defaultBenchmark = (data.commodityOrder && data.commodityOrder[1]) || defaultPrimary;
    _commodityState.primaryCountry = defaultPrimary;
    _commodityState.comparisonCountries = [];
    _commodityState.benchmarkCountry = defaultBenchmark;
    var end = data.latestDate;
    var start = end ? _subtractMonths(end, 12) : data.earliestDate;
    _commodityState.dateRange = { start: start || data.earliestDate, end: end };
    _commodityState.aggregation = 'daily';
    _commodityState.smoothingWindow = 7;
    _commodityState.rankingDate = data.latestDate;
    _commodityState.periodPreset = 12;
    if (typeof window.renderApp === 'function') {
      window.renderApp();
    }
  }

  return {
    getState: getState,
    setState: setState,
    resetState: resetState,
    getCommodityState: getCommodityState,
    setCommodityState: setCommodityState,
    resetCommodityState: resetCommodityState
  };
}());
