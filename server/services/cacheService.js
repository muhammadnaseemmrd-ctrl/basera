const NodeCache = require("node-cache");

const cache = new NodeCache({
  stdTTL: 300,
  checkperiod: 120,
  useClones: false
});

const ttl = {
  heatmap: 15 * 60,
  neighbourhood: 7 * 24 * 60 * 60,
  commute: 30 * 24 * 60 * 60,
  filterCounts: 5 * 60,
  recommendations: 10 * 60,
  universities: 24 * 60 * 60,
  platformConfig: 60 * 60,
  dna: 7 * 24 * 60 * 60,
  pulse: 2 * 60,
  finance: 10 * 60
};

const getOrSet = async (key, seconds, producer) => {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const value = await producer();
  cache.set(key, value, seconds);
  return value;
};

const bust = (prefix) => {
  cache.keys().filter((key) => key.startsWith(prefix)).forEach((key) => cache.del(key));
};

module.exports = { cache, ttl, getOrSet, bust };
