// Dummy forward curve data — replace with live feed when available.
// Structure: power prices = EUR/MWh per country ISO; commodities include unit + spot price.
window.FUTURES_DATA = {
  months: ['May-26', 'Jun-26', 'Jul-26', 'Aug-26', 'Sep-26', 'Oct-26'],
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
  commodities: {
    WTI:        { unit: 'USD/bbl', spot: 113, 'May-26': 113, 'Jun-26': 99,  'Jul-26': 91,  'Aug-26': 85,  'Sep-26': 81,  'Oct-26': 78  },
    Brent:      { unit: 'USD/bbl', spot: 109, 'May-26': 109, 'Jun-26': 100, 'Jul-26': 93,  'Aug-26': 88,  'Sep-26': 85,  'Oct-26': 83  },
    'Henry Hub':{ unit: 'USD/MMBtu', spot: 3.8, 'May-26': 3.9, 'Jun-26': 4.0, 'Jul-26': 4.1, 'Aug-26': 4.1, 'Sep-26': 3.9, 'Oct-26': 3.8 },
    TTF:        { unit: 'EUR/MWh', spot: 50,  'May-26': 53,  'Jun-26': 53,  'Jul-26': 53,  'Aug-26': 53,  'Sep-26': 53,  'Oct-26': 53  },
    Gold:       { unit: 'USD/troy oz', spot: 2320, 'May-26': 2350, 'Jun-26': 2370, 'Jul-26': 2390, 'Aug-26': 2400, 'Sep-26': 2410, 'Oct-26': 2420 },
    Diesel:     { unit: 'USD/bbl', spot: 98,  'May-26': 99,  'Jun-26': 97,  'Jul-26': 95,  'Aug-26': 93,  'Sep-26': 91,  'Oct-26': 90  }
  }
};
