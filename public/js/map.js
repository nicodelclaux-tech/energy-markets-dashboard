// Shared Europe map helper for the power heatmap.
// Uses the pre-bundled EUROPE_GEO payload to avoid runtime file fetches.

var EuropeMap = (function () {
  'use strict';

  var MAP_KEY = 'emd-power-europe-map-v2';
  var _registered = false;

  var GEO_NAME_BY_ISO = {
    AT: 'Austria',
    BE: 'Belgium',
    CH: 'Switzerland',
    CZ: 'Czech Republic',
    DE: 'Germany',
    DK: 'Denmark',
    ES: 'Spain',
    FI: 'Finland',
    FR: 'France',
    GB: 'United Kingdom',
    GR: 'Greece',
    HU: 'Hungary',
    IE: 'Ireland',
    IT: 'Italy',
    NL: 'Netherlands',
    NO: 'Norway',
    PL: 'Poland',
    PT: 'Portugal',
    RO: 'Romania',
    SE: 'Sweden',
    SI: 'Slovenia',
    SK: 'Slovakia'
  };

  var GEO_ISO3_BY_ISO = {
    AT: 'AUT',
    BE: 'BEL',
    CH: 'CHE',
    CZ: 'CZE',
    DE: 'DEU',
    DK: 'DNK',
    ES: 'ESP',
    FI: 'FIN',
    FR: 'FRA',
    GB: 'GBR',
    GR: 'GRC',
    HU: 'HUN',
    IE: 'IRL',
    IT: 'ITA',
    NL: 'NLD',
    NO: 'NOR',
    PL: 'POL',
    PT: 'PRT',
    RO: 'ROU',
    SE: 'SWE',
    SI: 'SVN',
    SK: 'SVK'
  };

  function _getProp(feature, keyA, keyB) {
    var props = (feature && feature.properties) || {};
    return props[keyA] || props[keyB] || null;
  }

  function _cloneFeature(feature) {
    return {
      type: feature.type,
      properties: {
        name: _getProp(feature, 'name', 'NAME'),
        iso3: _getProp(feature, 'iso3', 'ISO3')
      },
      geometry: feature.geometry
    };
  }

  function _buildFilteredGeoJson() {
    if (typeof EUROPE_GEO === 'undefined' || !EUROPE_GEO || !EUROPE_GEO.features) {
      return null;
    }

    var allowedIso3 = {};
    Object.keys(GEO_ISO3_BY_ISO).forEach(function (iso) {
      allowedIso3[GEO_ISO3_BY_ISO[iso]] = true;
    });

    var features = EUROPE_GEO.features.filter(function (feature) {
      var iso3 = _getProp(feature, 'iso3', 'ISO3');
      return !!allowedIso3[String(iso3 || '').toUpperCase()];
    }).map(_cloneFeature);

    if (!features.length) return null;

    return {
      type: 'FeatureCollection',
      features: features
    };
  }

  function ensureRegistered() {
    if (_registered) return true;
    if (typeof echarts === 'undefined') return false;

    var geoJson = _buildFilteredGeoJson();
    if (!geoJson) return false;

    try {
      echarts.registerMap(MAP_KEY, geoJson);
      _registered = true;
      return true;
    } catch (err) {
      console.warn('EuropeMap: Failed to register filtered GeoJSON map', err);
      return false;
    }
  }

  function getMapKey() {
    return MAP_KEY;
  }

  function getGeoNameByIso(iso, fallback) {
    return GEO_NAME_BY_ISO[iso] || fallback || iso;
  }

  function getLayout() {
    return {
      center: [10.8, 55.2],
      zoom: 0.92,
      layoutCenter: ['48%', '54%'],
      layoutSize: '88%'
    };
  }

  return {
    ensureRegistered: ensureRegistered,
    getMapKey: getMapKey,
    getGeoNameByIso: getGeoNameByIso,
    getLayout: getLayout
  };
})();
