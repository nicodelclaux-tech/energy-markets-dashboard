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
    NL: { 'May-26': 85,  'Jun-26': 90,  'Jul-26': 96,  'Aug-26': 100, 'Sep-26': 99,  'Oct-26': 112 }
  },
  commodities: {
    WTI:   { unit: 'USD/bbl', spot: 113, 'May-26': 113, 'Jun-26': 99,  'Jul-26': 91,  'Aug-26': 85, 'Sep-26': 81, 'Oct-26': 78 },
    Brent: { unit: 'USD/bbl', spot: 109, 'May-26': 109, 'Jun-26': 100, 'Jul-26': 93,  'Aug-26': 88, 'Sep-26': 85, 'Oct-26': 83 },
    TTF:   { unit: 'EUR/MWh', spot: 50,  'May-26': 53,  'Jun-26': 53,  'Jul-26': 53,  'Aug-26': 53,  'Sep-26': 53,  'Oct-26': 53 }
  }
};
