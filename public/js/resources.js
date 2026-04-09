// news-sources.js — Curated European energy news & data sources
// Static links (no RSS/API) — opens in new tabs

var NewsSources = (function () {
  'use strict';

  // Categories: MARKET, DATA, POLICY, STORAGE, EXCHANGE
  var sources = [
    {
      name: 'ENTSO-E Transparency',
      url: 'https://transparency.entsoe.eu/',
      category: 'DATA',
      description: 'Real-time generation, load & cross-border flow data'
    },
    {
      name: 'EPEX SPOT',
      url: 'https://www.epexspot.com/en/market-data',
      category: 'EXCHANGE',
      description: 'Day-ahead & intraday auction results'
    },
    {
      name: 'Nord Pool',
      url: 'https://www.nordpoolgroup.com/en/Market-data1/',
      category: 'EXCHANGE',
      description: 'Nordic & Baltic day-ahead prices'
    },
    {
      name: 'GIE AGSI+ Gas Storage',
      url: 'https://agsi.gie.eu/',
      category: 'STORAGE',
      description: 'EU gas storage levels — key driver of power prices'
    },
    {
      name: 'Ember Electricity Data',
      url: 'https://ember-climate.org/data/',
      category: 'DATA',
      description: 'Global electricity review, generation mix & CO₂'
    },
    {
      name: 'Energy-Charts (Fraunhofer)',
      url: 'https://energy-charts.info/',
      category: 'DATA',
      description: 'German power system data: generation, prices, imports'
    },
    {
      name: 'ACER Market Report',
      url: 'https://www.acer.europa.eu/electricity/market-monitoring-report',
      category: 'POLICY',
      description: 'EU Agency annual electricity market monitoring'
    },
    {
      name: 'EU Energy Prices Dashboard',
      url: 'https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en',
      category: 'POLICY',
      description: 'European Commission energy price surveillance'
    },
    {
      name: 'Montel News',
      url: 'https://www.montelnews.com/',
      category: 'MARKET',
      description: 'European power & gas market news'
    },
    {
      name: 'ICIS Power Outlook',
      url: 'https://www.icis.com/energy/electricity/',
      category: 'MARKET',
      description: 'European power market analysis & forecasts'
    },
    {
      name: 'Agora Energiewende',
      url: 'https://www.agora-energiewende.de/en/data-tools',
      category: 'DATA',
      description: 'German & EU energy transition data tools'
    },
    {
      name: 'EEX Power Futures',
      url: 'https://www.eex.com/en/market-data/power',
      category: 'EXCHANGE',
      description: 'European power futures & options prices'
    }
  ];

  function getAll() {
    return sources;
  }

  function getByCategory(cat) {
    return sources.filter(function (s) { return s.category === cat; });
  }

  var CATEGORY_COLORS = {
    DATA: '#00acff',
    EXCHANGE: '#00d26a',
    MARKET: '#ffb800',
    POLICY: '#a855f7',
    STORAGE: '#ec4899'
  };

  function getCategoryColor(cat) {
    return CATEGORY_COLORS[cat] || '#666';
  }

  return {
    getAll: getAll,
    getByCategory: getByCategory,
    getCategoryColor: getCategoryColor
  };
})();
