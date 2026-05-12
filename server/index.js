import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const nifty50 = {
  symbol: 'NIFTY 50',
  value: 22682.15,
  change: 128.4,
  changePercent: 0.57,
  asOf: new Date().toISOString(),
  dayRange: '22,512.35 - 22,724.80',
  marketStatus: 'Sample market snapshot'
};

const companies = {
  smallCap: [
    { name: 'Central Depository Services', symbol: 'CDSL', sector: 'Financial Services', marketCapCr: 26780, price: 1674.2, changePercent: 1.42 },
    { name: 'Kaynes Technology India', symbol: 'KAYNES', sector: 'Electronics Manufacturing', marketCapCr: 32450, price: 5021.3, changePercent: -0.38 },
    { name: 'KFin Technologies', symbol: 'KFINTECH', sector: 'Capital Markets', marketCapCr: 20340, price: 1192.7, changePercent: 0.84 },
    { name: 'Affle India', symbol: 'AFFLE', sector: 'Digital Advertising', marketCapCr: 19120, price: 1364.1, changePercent: 2.06 },
    { name: 'Data Patterns', symbol: 'DATAPATTNS', sector: 'Defence Electronics', marketCapCr: 15280, price: 2732.5, changePercent: -0.73 }
  ],
  midCap: [
    { name: 'Max Healthcare Institute', symbol: 'MAXHEALTH', sector: 'Healthcare', marketCapCr: 93210, price: 960.4, changePercent: 0.44 },
    { name: 'Persistent Systems', symbol: 'PERSISTENT', sector: 'IT Services', marketCapCr: 82760, price: 5331.8, changePercent: 1.18 },
    { name: 'Indian Hotels Company', symbol: 'INDHOTEL', sector: 'Hotels', marketCapCr: 82150, price: 577.9, changePercent: -0.21 },
    { name: 'Dixon Technologies', symbol: 'DIXON', sector: 'Electronics Manufacturing', marketCapCr: 68540, price: 11445.0, changePercent: 1.71 },
    { name: 'Bharat Forge', symbol: 'BHARATFORG', sector: 'Auto Components', marketCapCr: 60280, price: 1294.6, changePercent: 0.12 }
  ]
};

const fallbackNews = [
  {
    title: 'Indian equities end higher as banks and IT stocks support gains',
    source: 'Market Desk',
    url: 'https://www.nseindia.com/',
    publishedAt: new Date().toISOString(),
    summary: 'Benchmark indices saw broad participation while investors tracked earnings, crude prices, and global cues.'
  },
  {
    title: 'Small and mid cap names remain active amid stock-specific earnings momentum',
    source: 'Daily Equity Brief',
    url: 'https://www.bseindia.com/',
    publishedAt: new Date().toISOString(),
    summary: 'Analysts continue to prefer companies with steady cash flows, clean balance sheets, and visible order books.'
  },
  {
    title: 'Nifty 50 watchlist: financials, autos, and consumption stocks in focus',
    source: 'India Markets',
    url: 'https://www.nseindia.com/market-data/live-equity-market',
    publishedAt: new Date().toISOString(),
    summary: 'Traders are watching index heavyweights and sector rotation before the next macro data print.'
  }
];

async function fetchNews() {
  if (!process.env.NEWS_API_KEY) {
    return fallbackNews;
  }

  const params = new URLSearchParams({
    q: 'Nifty 50 OR NSE OR Indian stocks',
    language: 'en',
    sortBy: 'publishedAt',
    pageSize: '8',
    apiKey: process.env.NEWS_API_KEY
  });

  const response = await fetch(`https://newsapi.org/v2/everything?${params}`);
  if (!response.ok) {
    return fallbackNews;
  }

  const payload = await response.json();
  return (payload.articles || []).map((article) => ({
    title: article.title,
    source: article.source?.name || 'News',
    url: article.url,
    publishedAt: article.publishedAt,
    summary: article.description || 'Latest Indian market update.'
  }));
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/market-summary', (_req, res) => {
  res.json({
    nifty50,
    breadth: {
      advancing: 31,
      declining: 19,
      unchanged: 0
    },
    sectors: [
      { name: 'Banking', changePercent: 0.91 },
      { name: 'IT', changePercent: 0.63 },
      { name: 'Auto', changePercent: -0.18 },
      { name: 'Pharma', changePercent: 0.34 }
    ]
  });
});

app.get('/api/companies', (req, res) => {
  const segment = req.query.segment;
  if (segment && companies[segment]) {
    return res.json({ segment, companies: companies[segment] });
  }

  res.json(companies);
});

app.get('/api/news', async (_req, res) => {
  try {
    const news = await fetchNews();
    res.json({ news });
  } catch (error) {
    res.json({ news: fallbackNews, warning: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
