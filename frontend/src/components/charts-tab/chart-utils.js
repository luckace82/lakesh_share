export function avg(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }

export function calcRSI(closes, period) {
  if (closes.length < period + 1) return null;
  const recent = closes.slice(-(period + 1));
  let gains = 0, losses = 0;
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff > 0) gains += diff; else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcEMA(arr, period) {
  const k = 2 / (period + 1);
  let ema = arr[0];
  for (let i = 1; i < arr.length; i++) {
    ema = arr[i] * k + ema * (1 - k);
  }
  return ema;
}

export function calcMACD(closes) {
  if (closes.length < 26) return null;
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macd = ema12 - ema26;
  const macdHistory = [];
  for (let i = 26; i < closes.length; i++) {
    macdHistory.push(calcEMA(closes.slice(0, i + 1), 12) - calcEMA(closes.slice(0, i + 1), 26));
  }
  const signal = calcEMA(macdHistory.slice(-9), 9);
  return { macd, signal, histogram: macd - signal };
}

export function calcStochastic(data) {
  if (data.length < 14) return null;
  const recent = data.slice(-14);
  const highs = recent.map(d => parseFloat(d.high));
  const lows = recent.map(d => parseFloat(d.low));
  const closes = recent.map(d => parseFloat(d.close));
  const high14 = Math.max(...highs);
  const low14 = Math.min(...lows);
  const k = ((closes[closes.length - 1] - low14) / (high14 - low14)) * 100;
  return { k, d: k };
}

export function calcWilliamsR(data) {
  if (data.length < 14) return null;
  const recent = data.slice(-14);
  const highs = recent.map(d => parseFloat(d.high));
  const lows = recent.map(d => parseFloat(d.low));
  const closes = recent.map(d => parseFloat(d.close));
  const high14 = Math.max(...highs);
  const low14 = Math.min(...lows);
  return ((high14 - closes[closes.length - 1]) / (high14 - low14)) * -100;
}

export function calcIchimoku(data) {
  if (data.length < 52) return null;
  const recent9 = data.slice(-9);
  const tenkan = (Math.max(...recent9.map(d => d.high)) + Math.min(...recent9.map(d => d.low))) / 2;
  const recent26 = data.slice(-26);
  const kijun = (Math.max(...recent26.map(d => d.high)) + Math.min(...recent26.map(d => d.low))) / 2;
  const senkouA = (tenkan + kijun) / 2;
  const recent52 = data.slice(-52);
  const senkouB = (Math.max(...recent52.map(d => d.high)) + Math.min(...recent52.map(d => d.low))) / 2;
  return { tenkan, kijun, senkouA, senkouB };
}
