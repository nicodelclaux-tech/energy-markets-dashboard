// Forward curve data — replace with live feed when available.
// power / commodities = current (live) curves
// power_1w / commodities_1w = snapshot 1 week ago
// power_1m / commodities_1m = snapshot 1 month ago
window.FUTURES_DATA = {
  months: ['May-26', 'Jun-26', 'Jul-26', 'Aug-26', 'Sep-26', 'Oct-26'],

  // ── Current power forward curves (EUR/MWh) ────────────────────────────────
  power: {
    ES: { 'May-26': 23,  'Jun-26': 31,  'Jul-26': 57,  'Aug-26': 81,  'Sep-26': 79,  'Oct-26': 79  },
    DE: { 'May-26': 82,  'Jun-26': 87,  'Jul-26': 93,  'Aug-26': 97,  'Sep-26': 96,  'Oct-26': 110 },
    FR: { 'May-26': 49,  'Jun-26': 27,  'Jul-26': 29,  'Aug-26': 41,  'Sep-26': 36,  'Oct-26': 49  },
    IT: { 'May-26': 132, 'Jun-26': 129, 'Jul-26': 142, 'Aug-26': 153, 'Sep-26': 147, 'Oct-26': 151 },
    GB: { 'May-26': 86,  'Jun-26': 81,  'Jul-26': 81,  'Aug-26': 85,  'Sep-26': 78,  'Oct-26': 86  },
    NL: { 'May-26': 85,  'Jun-26': 90,  'Jul-26': 96,  'Aug-26': 100, 'Sep-26': 99,  'Oct-26': 112 },
    NO: { 'May-26': 65,  'Jun-26': 61,  'Jul-26': 54,  'Aug-26': 50,  'Sep-26': 49,  'Oct-26': 52  },
    SE: { 'May-26': 43,  'Jun-26': 38,  'Jul-26': 32,  'Aug-26': 29,  'Sep-26': 31,  'Oct-26': 35  },
    FI: { 'May-26': 42,  'Jun-26': 36,  'Jul-26': 33,  'Aug-26': 31,  'Sep-26': 34,  'Oct-26': 39  },
    DK: { 'May-26': 87,  'Jun-26': 90,  'Jul-26': 92,  'Aug-26': 88,  'Sep-26': 91,  'Oct-26': 95  }
  },

  // ── Power curves 1 week ago ────────────────────────────────────────────────
  power_1w: {
    ES: { 'May-26': 26,  'Jun-26': 34,  'Jul-26': 60,  'Aug-26': 84,  'Sep-26': 82,  'Oct-26': 82  },
    DE: { 'May-26': 86,  'Jun-26': 91,  'Jul-26': 97,  'Aug-26': 101, 'Sep-26': 100, 'Oct-26': 114 },
    FR: { 'May-26': 52,  'Jun-26': 30,  'Jul-26': 32,  'Aug-26': 44,  'Sep-26': 39,  'Oct-26': 52  },
    IT: { 'May-26': 136, 'Jun-26': 133, 'Jul-26': 146, 'Aug-26': 157, 'Sep-26': 151, 'Oct-26': 155 },
    GB: { 'May-26': 89,  'Jun-26': 84,  'Jul-26': 84,  'Aug-26': 88,  'Sep-26': 81,  'Oct-26': 89  },
    NL: { 'May-26': 88,  'Jun-26': 93,  'Jul-26': 99,  'Aug-26': 103, 'Sep-26': 102, 'Oct-26': 115 },
    NO: { 'May-26': 68,  'Jun-26': 64,  'Jul-26': 57,  'Aug-26': 53,  'Sep-26': 52,  'Oct-26': 55  },
    SE: { 'May-26': 46,  'Jun-26': 41,  'Jul-26': 35,  'Aug-26': 32,  'Sep-26': 34,  'Oct-26': 38  },
    FI: { 'May-26': 45,  'Jun-26': 39,  'Jul-26': 36,  'Aug-26': 34,  'Sep-26': 37,  'Oct-26': 42  },
    DK: { 'May-26': 90,  'Jun-26': 93,  'Jul-26': 95,  'Aug-26': 91,  'Sep-26': 94,  'Oct-26': 98  }
  },

  // ── Power curves 1 month ago ───────────────────────────────────────────────
  power_1m: {
    ES: { 'May-26': 32,  'Jun-26': 40,  'Jul-26': 66,  'Aug-26': 90,  'Sep-26': 88,  'Oct-26': 88  },
    DE: { 'May-26': 92,  'Jun-26': 97,  'Jul-26': 103, 'Aug-26': 107, 'Sep-26': 106, 'Oct-26': 121 },
    FR: { 'May-26': 58,  'Jun-26': 36,  'Jul-26': 38,  'Aug-26': 50,  'Sep-26': 45,  'Oct-26': 58  },
    IT: { 'May-26': 143, 'Jun-26': 140, 'Jul-26': 153, 'Aug-26': 164, 'Sep-26': 158, 'Oct-26': 162 },
    GB: { 'May-26': 95,  'Jun-26': 90,  'Jul-26': 90,  'Aug-26': 94,  'Sep-26': 87,  'Oct-26': 95  },
    NL: { 'May-26': 94,  'Jun-26': 99,  'Jul-26': 105, 'Aug-26': 109, 'Sep-26': 108, 'Oct-26': 122 },
    NO: { 'May-26': 74,  'Jun-26': 70,  'Jul-26': 63,  'Aug-26': 59,  'Sep-26': 58,  'Oct-26': 61  },
    SE: { 'May-26': 52,  'Jun-26': 47,  'Jul-26': 41,  'Aug-26': 38,  'Sep-26': 40,  'Oct-26': 44  },
    FI: { 'May-26': 51,  'Jun-26': 45,  'Jul-26': 42,  'Aug-26': 40,  'Sep-26': 43,  'Oct-26': 48  },
    DK: { 'May-26': 96,  'Jun-26': 99,  'Jul-26': 101, 'Aug-26': 97,  'Sep-26': 100, 'Oct-26': 104 }
  },

  // ── Current commodity forward curves ──────────────────────────────────────
  commodities: {
    WTI:        { unit: 'USD/bbl', spot: 113, 'May-26': 113, 'Jun-26': 99,  'Jul-26': 91,  'Aug-26': 85,  'Sep-26': 81,  'Oct-26': 78  },
    Brent:      { unit: 'USD/bbl', spot: 109, 'May-26': 109, 'Jun-26': 100, 'Jul-26': 93,  'Aug-26': 88,  'Sep-26': 85,  'Oct-26': 83  },
    'Henry Hub':{ unit: 'USD/MMBtu', spot: 3.8, 'May-26': 3.9, 'Jun-26': 4.0, 'Jul-26': 4.1, 'Aug-26': 4.1, 'Sep-26': 3.9, 'Oct-26': 3.8 },
    TTF:        { unit: 'EUR/MWh', spot: 50,  'May-26': 53,  'Jun-26': 53,  'Jul-26': 53,  'Aug-26': 53,  'Sep-26': 53,  'Oct-26': 53  },
    Gold:       { unit: 'USD/troy oz', spot: 2320, 'May-26': 2350, 'Jun-26': 2370, 'Jul-26': 2390, 'Aug-26': 2400, 'Sep-26': 2410, 'Oct-26': 2420 },
    Diesel:     { unit: 'USD/bbl', spot: 98,  'May-26': 99,  'Jun-26': 97,  'Jul-26': 95,  'Aug-26': 93,  'Sep-26': 91,  'Oct-26': 90  }
    WTI:       { unit: 'USD/bbl',   spot: 62,   'May-26': 62,   'Jun-26': 61,   'Jul-26': 60,   'Aug-26': 60,   'Sep-26': 59,   'Oct-26': 59   },
    Brent:     { unit: 'USD/bbl',   spot: 65,   'May-26': 65,   'Jun-26': 64,   'Jul-26': 63,   'Aug-26': 63,   'Sep-26': 62,   'Oct-26': 62   },
    HENRY_HUB: { unit: 'USD/MMBtu', spot: 2.8,  'May-26': 2.80, 'Jun-26': 2.90, 'Jul-26': 3.10, 'Aug-26': 3.00, 'Sep-26': 2.90, 'Oct-26': 2.85 },
    TTF:       { unit: 'EUR/MWh',   spot: 35,   'May-26': 35,   'Jun-26': 34,   'Jul-26': 33,   'Aug-26': 34,   'Sep-26': 36,   'Oct-26': 38   },
    Diesel:    { unit: 'USD/gal',   spot: 3.25, 'May-26': 3.25, 'Jun-26': 3.20, 'Jul-26': 3.18, 'Aug-26': 3.15, 'Sep-26': 3.12, 'Oct-26': 3.10 }
  },

  // ── Commodity curves 1 week ago ────────────────────────────────────────────
  commodities_1w: {
    WTI:       { 'May-26': 65,   'Jun-26': 64,   'Jul-26': 63,   'Aug-26': 62,   'Sep-26': 61,   'Oct-26': 61   },
    Brent:     { 'May-26': 68,   'Jun-26': 67,   'Jul-26': 66,   'Aug-26': 65,   'Sep-26': 65,   'Oct-26': 64   },
    HENRY_HUB: { 'May-26': 2.90, 'Jun-26': 3.00, 'Jul-26': 3.20, 'Aug-26': 3.10, 'Sep-26': 3.00, 'Oct-26': 2.95 },
    TTF:       { 'May-26': 37,   'Jun-26': 36,   'Jul-26': 35,   'Aug-26': 36,   'Sep-26': 38,   'Oct-26': 40   },
    Diesel:    { 'May-26': 3.30, 'Jun-26': 3.25, 'Jul-26': 3.22, 'Aug-26': 3.19, 'Sep-26': 3.16, 'Oct-26': 3.14 }
  },

  // ── Commodity curves 1 month ago ───────────────────────────────────────────
  commodities_1m: {
    WTI:       { 'May-26': 72,   'Jun-26': 71,   'Jul-26': 70,   'Aug-26': 69,   'Sep-26': 68,   'Oct-26': 68   },
    Brent:     { 'May-26': 75,   'Jun-26': 74,   'Jul-26': 73,   'Aug-26': 72,   'Sep-26': 71,   'Oct-26': 71   },
    HENRY_HUB: { 'May-26': 3.10, 'Jun-26': 3.20, 'Jul-26': 3.40, 'Aug-26': 3.30, 'Sep-26': 3.20, 'Oct-26': 3.15 },
    TTF:       { 'May-26': 42,   'Jun-26': 41,   'Jul-26': 40,   'Aug-26': 41,   'Sep-26': 43,   'Oct-26': 45   },
    Diesel:    { 'May-26': 3.42, 'Jun-26': 3.37, 'Jul-26': 3.33, 'Aug-26': 3.30, 'Sep-26': 3.27, 'Oct-26': 3.25 }
  }
};
