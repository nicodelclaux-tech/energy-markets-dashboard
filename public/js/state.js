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
    periodPreset: 0
  };

  function getState() {
    return _state;
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

  function resetState(data) {
    _state.primaryCountry = 'ES';
    _state.comparisonCountries = [];
    _state.benchmarkCountry = 'EU_AVG';
    _state.dateRange = { start: data.earliestDate, end: data.latestDate };
    _state.aggregation = 'daily';
    _state.smoothingWindow = 7;
    _state.rankingDate = data.latestDate;
    _state.periodPreset = 0;
    if (typeof window.renderApp === 'function') {
      window.renderApp();
    }
  }

  return { getState: getState, setState: setState, resetState: resetState };
}());
