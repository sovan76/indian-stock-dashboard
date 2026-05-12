import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowDownRight, ArrowUpRight, Building2, Newspaper, RefreshCw, Search, TrendingUp } from 'lucide-react';
import './styles.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 1
  }).format(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function ChangeBadge({ value }) {
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={`change-badge ${positive ? 'positive' : 'negative'}`}>
      <Icon size={14} />
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

function StatCard({ label, value, detail, icon: Icon }) {
  return (
    <section className="stat-card">
      <div className="stat-icon">
        <Icon size={20} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </section>
  );
}

function CompanyTable({ title, rows }) {
  return (
    <section className="panel company-panel">
      <div className="panel-heading">
        <div>
          <p>Top watchlist</p>
          <h2>{title}</h2>
        </div>
        <Building2 size={22} />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Sector</th>
              <th>Market Cap</th>
              <th>Price</th>
              <th>Move</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((company) => (
              <tr key={company.symbol}>
                <td>
                  <strong>{company.name}</strong>
                  <span>{company.symbol}</span>
                </td>
                <td>{company.sector}</td>
                <td>₹{company.marketCapCr.toLocaleString('en-IN')} Cr</td>
                <td>{formatCurrency(company.price)}</td>
                <td><ChangeBadge value={company.changePercent} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NewsList({ news }) {
  return (
    <section className="panel news-panel">
      <div className="panel-heading">
        <div>
          <p>Daily feed</p>
          <h2>Indian Stock News</h2>
        </div>
        <Newspaper size={22} />
      </div>
      <div className="news-list">
        {news.map((item) => (
          <a className="news-item" href={item.url} target="_blank" rel="noreferrer" key={`${item.title}-${item.publishedAt}`}>
            <span>{item.source} · {formatDate(item.publishedAt)}</span>
            <strong>{item.title}</strong>
            <p>{item.summary}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

function App() {
  const [summary, setSummary] = useState(null);
  const [companies, setCompanies] = useState({ smallCap: [], midCap: [] });
  const [news, setNews] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    setLoading(true);
    const [summaryResponse, companiesResponse, newsResponse] = await Promise.all([
      fetch(`${API_BASE}/api/market-summary`),
      fetch(`${API_BASE}/api/companies`),
      fetch(`${API_BASE}/api/news`)
    ]);

    setSummary(await summaryResponse.json());
    setCompanies(await companiesResponse.json());
    setNews((await newsResponse.json()).news);
    setLoading(false);
  }

  useEffect(() => {
    loadDashboard().catch(() => setLoading(false));
  }, []);

  const filteredCompanies = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    if (!lowerQuery) {
      return companies;
    }

    const filterRows = (rows) => rows.filter((item) =>
      [item.name, item.symbol, item.sector].some((value) => value.toLowerCase().includes(lowerQuery))
    );

    return {
      smallCap: filterRows(companies.smallCap),
      midCap: filterRows(companies.midCap)
    };
  }, [companies, query]);

  return (
    <main>
      <header className="topbar">
        <div>
          <span className="eyebrow">India equities</span>
          <h1>Market Dashboard</h1>
        </div>
        <button className="icon-button" onClick={loadDashboard} aria-label="Refresh dashboard">
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
        </button>
      </header>

      <section className="summary-band">
        <div>
          <p>NIFTY 50</p>
          <strong>{summary?.nifty50.value.toLocaleString('en-IN') || 'Loading'}</strong>
          <span>
            {summary ? `${summary.nifty50.change >= 0 ? '+' : ''}${summary.nifty50.change.toFixed(2)} points today` : 'Fetching market snapshot'}
          </span>
        </div>
        {summary && <ChangeBadge value={summary.nifty50.changePercent} />}
      </section>

      <section className="stats-grid">
        <StatCard label="Advancing" value={summary?.breadth.advancing ?? '--'} detail="NIFTY 50 stocks" icon={TrendingUp} />
        <StatCard label="Declining" value={summary?.breadth.declining ?? '--'} detail="NIFTY 50 stocks" icon={ArrowDownRight} />
        <StatCard label="Day range" value={summary?.nifty50.dayRange ?? '--'} detail={summary?.nifty50.marketStatus ?? 'Waiting for API'} icon={Activity} />
      </section>

      <section className="toolbar">
        <label>
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search company, symbol, or sector"
          />
        </label>
      </section>

      <section className="content-grid">
        <div className="tables-stack">
          <CompanyTable title="Small Cap Companies" rows={filteredCompanies.smallCap} />
          <CompanyTable title="Mid Cap Companies" rows={filteredCompanies.midCap} />
        </div>
        <NewsList news={news} />
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
