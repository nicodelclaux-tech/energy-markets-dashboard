// Pure analytics functions. No DOM or global state touched here.
var Analytics = (function () {

  // --- Filtering -----------------------------------------------------------------

  function getSeriesForCountry(data, iso, dateRange) {
    var series = data.seriesByIso[iso];
    if (!series || series.length === 0) return [];
    if (!dateRange || !dateRange.start || !dateRange.end) return series.slice();
    var s = dateRange.start, e = dateRange.end;
    return series.filter(function (r) { return r.dateString >= s && r.dateString <= e; });
  }

  function getAlignedComparison(data, isos, dateRange) {
    var result = {};
    isos.forEach(function (iso) { result[iso] = getSeriesForCountry(data, iso, dateRange); });
    return result;
  }

  // --- Summary stats -------------------------------------------------------------

  function computeStats(series) {
    var empty = { latest: null, avg: null, median: null, min: null, max: null, stdDev: null };
    if (!series || series.length === 0) return empty;
    var prices = series.map(function (r) { return r.price; });
    var n = prices.length;
    var latest = series[series.length - 1].price;
    var sum = prices.reduce(function (a, b) { return a + b; }, 0);
    var avg = sum / n;
    var sorted = prices.slice().sort(function (a, b) { return a - b; });
    var median = n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];
    var min = sorted[0];
    var max = sorted[sorted.length - 1];
    var variance = prices.reduce(function (acc, p) { return acc + Math.pow(p - avg, 2); }, 0) / n;
    var stdDev = Math.sqrt(variance);
    return { latest: latest, avg: avg, median: median, min: min, max: max, stdDev: stdDev };
  }

  // --- Rolling functions ---------------------------------------------------------

  function rollingAverage(series, window) {
    if (!window || window <= 1) return series.slice();
    return series.map(function (r, i) {
      var slice = series.slice(Math.max(0, i - window + 1), i + 1);
      var avg = slice.reduce(function (a, b) { return a + b.price; }, 0) / slice.length;
      return { date: r.date, dateString: r.dateString, price: avg };
    });
  }

  function rollingVolatility(series, window) {
    var w = window || 30;
    return series.map(function (r, i) {
      var slice = series.slice(Math.max(0, i - w + 1), i + 1);
      var prices = slice.map(function (x) { return x.price; });
      var n = prices.length;
      if (n < 2) return { date: r.date, dateString: r.dateString, price: 0 };
      var avg = prices.reduce(function (a, b) { return a + b; }, 0) / n;
      var variance = prices.reduce(function (acc, p) { return acc + Math.pow(p - avg, 2); }, 0) / n;
      return { date: r.date, dateString: r.dateString, price: Math.sqrt(variance) };
    });
  }

  // --- Spread -------------------------------------------------------------------

  function spreadToBenchmark(data, iso, benchmarkIso, dateRange) {
    if (iso === benchmarkIso) return [];
    var series = getSeriesForCountry(data, iso, dateRange);
    var bench = getSeriesForCountry(data, benchmarkIso, dateRange);
    var benchMap = {};
    bench.forEach(function (r) { benchMap[r.dateString] = r.price; });
    return series
      .filter(function (r) { return benchMap[r.dateString] != null; })
      .map(function (r) {
        return { date: r.date, dateString: r.dateString, price: r.price - benchMap[r.dateString] };
      });
  }

  // --- Rankings -----------------------------------------------------------------

  function rankCountriesByDate(data, dateString) {
    if (!dateString) return [];
    var result = [];
    Object.keys(data.seriesByIso).forEach(function (iso) {
      var series = data.seriesByIso[iso];
      if (!series || series.length === 0) return;
      // Find the closest record on or before the target date
      var match = null;
      for (var i = series.length - 1; i >= 0; i--) {
        if (series[i].dateString <= dateString) { match = series[i]; break; }
      }
      if (match) {
        result.push({
          iso: iso,
          name: data.countriesByIso[iso].name,
          price: match.price,
          dateString: match.dateString
        });
      }
    });
    result.sort(function (a, b) { return b.price - a.price; });
    return result;
  }

  // --- Aggregation --------------------------------------------------------------

  function aggregateMonthly(series) {
    var buckets = {};
    series.forEach(function (r) {
      var key = r.dateString.slice(0, 7);
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(r.price);
    });
    return Object.keys(buckets).sort().map(function (key) {
      var prices = buckets[key];
      var avg = prices.reduce(function (a, b) { return a + b; }, 0) / prices.length;
      return { dateString: key + '-01', price: avg };
    });
  }

  function aggregateYearly(series) {
    var buckets = {};
    series.forEach(function (r) {
      var key = r.dateString.slice(0, 4);
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(r.price);
    });
    return Object.keys(buckets).sort().map(function (key) {
      var prices = buckets[key];
      var avg = prices.reduce(function (a, b) { return a + b; }, 0) / prices.length;
      return { dateString: key + '-07-01', price: avg, label: key };
    });
  }

  function applyAggregation(series, mode) {
    if (mode === 'monthly') return aggregateMonthly(series);
    if (mode === 'yearly') return aggregateYearly(series);
    return series;
  }

  // --- Distribution -------------------------------------------------------------

  function computeDistribution(series, bins) {
    bins = bins || 18;
    if (!series || series.length === 0) return [];
    var prices = series.map(function (r) { return r.price; });
    var min = Math.min.apply(null, prices);
    var max = Math.max.apply(null, prices);
    var range = max - min || 1;
    var step = range / bins;
    var buckets = [];
    for (var i = 0; i < bins; i++) {
      buckets.push({ lo: min + i * step, hi: min + (i + 1) * step, count: 0 });
    }
    prices.forEach(function (p) {
      var idx = Math.min(Math.floor((p - min) / step), bins - 1);
      buckets[idx].count++;
    });
    return buckets;
  }

  // --- Percentile / Regime ------------------------------------------------------

  function percentileValue(sortedPrices, p) {
    var idx = (p / 100) * (sortedPrices.length - 1);
    var lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return sortedPrices[lo];
    return sortedPrices[lo] + (idx - lo) * (sortedPrices[hi] - sortedPrices[lo]);
  }

  function classifyRegime(price, series) {
    if (!series || series.length === 0 || price == null) return 'unknown';
    var sorted = series.map(function (r) { return r.price; }).sort(function (a, b) { return a - b; });
    var p25 = percentileValue(sorted, 25);
    var p75 = percentileValue(sorted, 75);
    if (price <= p25) return 'low';
    if (price >= p75) return 'high';
    return 'normal';
  }

  // --- Peak / Trough ------------------------------------------------------------

  function findPeakTrough(series) {
    var none = { peakDate: null, peakPrice: null, troughDate: null, troughPrice: null };
    if (!series || series.length === 0) return none;
    var peak = series[0], trough = series[0];
    series.forEach(function (r) {
      if (r.price > peak.price) peak = r;
      if (r.price < trough.price) trough = r;
    });
    return { peakDate: peak.dateString, peakPrice: peak.price, troughDate: trough.dateString, troughPrice: trough.price };
  }

  return {
    getSeriesForCountry: getSeriesForCountry,
    getAlignedComparison: getAlignedComparison,
    computeStats: computeStats,
    rollingAverage: rollingAverage,
    rollingVolatility: rollingVolatility,
    spreadToBenchmark: spreadToBenchmark,
    rankCountriesByDate: rankCountriesByDate,
    aggregateMonthly: aggregateMonthly,
    aggregateYearly: aggregateYearly,
    applyAggregation: applyAggregation,
    computeDistribution: computeDistribution,
    classifyRegime: classifyRegime,
    findPeakTrough: findPeakTrough
  };
}());
