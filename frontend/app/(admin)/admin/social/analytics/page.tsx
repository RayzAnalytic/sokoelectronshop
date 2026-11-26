'use client';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, BarChart3, ChevronDown, Download, Info, Loader2, RefreshCw, ShoppingBag, Users } from 'lucide-react';
import { adminApi as api } from '@/lib/admin-api';

type PlatformId = 'youtube' | 'facebook' | 'instagram' | 'tiktok';
type Metric = { value: number | null; previous: number | null; available: boolean; };
type AnalyticsPayload = any;

function emptyPayload(): AnalyticsPayload {
  return {
    accounts: [],
    platform_summaries: ['youtube','facebook','instagram','tiktok'].map(p => ({
      platform: p, accounts: [],
      followers: { value: null, previous: null, available: false },
      follower_growth: { value: null, previous: null, available: false },
      reach: { value: null, previous: null, available: false },
      impressions: { value: null, previous: null, available: false },
      views: { value: null, previous: null, available: false },
      engagement: { value: null, previous: null, available: false },
      engagement_rate: { value: null, previous: null, available: false },
      link_clicks: { value: null, previous: null, available: false },
      profile_visits: { value: null, previous: null, available: false },
      published_content: { value: null, previous: null, available: false },
      unavailable: []
    })),
    campaigns: [], content: [], products: [], funnel: [
      { key: 'clicks', label: 'Social clicks', value: 0, definition: 'Clicks' },
      { key: 'visits', label: 'Website visits', value: 0, definition: 'Sessions' },
      { key: 'cart', label: 'Add to cart', value: 0, definition: 'Add to cart' },
      { key: 'orders', label: 'Orders', value: 0, definition: 'Orders' },
      { key: 'revenue', label: 'Revenue', value: 0, definition: 'Revenue' }
    ],
    revenue_breakdown: [], audience_growth: [],
    audit: { attribution_model: 'last_click', reporting_window_days: 30, generated_at: new Date().toISOString(), currency: 'KES' }
  };
}

async function fetchAnalyticsReport(query: any): Promise<AnalyticsPayload> {
  try {
    const a = api as any;
    let res = null;
    if (a.social?.analytics) res = await a.social.analytics(query);
    else if (a.social?.analytics?.report) res = await a.social.analytics.report(query);
    else if (a.social?.overview) res = await a.social.overview(query).catch(()=>null);
    if (res?.platform_summaries) return res;
    if (res?.data?.platform_summaries) return res.data;
    return emptyPayload();
  } catch { return emptyPayload(); }
}

function formatNumber(n: any) { if (n===null||n===undefined||isNaN(n)) return '—'; const num=Number(n); if(Math.abs(num)>=1e6) return `${(num/1e6).toFixed(1)}M`; if(Math.abs(num)>=1e4) return `${(num/1e3).toFixed(1)}K`; return num.toLocaleString(); }
function formatCurrency(n: any, cur='KES') { if(n===null||n===undefined||isNaN(n)) return '—'; try { return new Intl.NumberFormat(undefined,{style:'currency',currency:cur}).format(Number(n)); } catch { return `${cur} ${Number(n).toFixed(2)}`; } }
function formatPercent(n: any) { if(n===null||n===undefined||isNaN(n)) return '—'; return `${Number(n).toFixed(1)}%`; }
function metricValue(m: any) { if(!m||!m.available) return null; return m.value; }

function StatCard({ label, value }: any) {
  return <div className="bg-white border border-slate-200 rounded p-3"><div className="text- text-slate-500">{label}</div><div className="text- font-semibold mt-1">{value}</div></div>;
}

function PageContent() {
  const [data, setData] = useState<AnalyticsPayload>(emptyPayload());
  const [loading, setLoading] = useState(true);
  const query = useMemo(() => ({ range: 'last_30_days' }), []);

  const load = useCallback(async () => {
    setLoading(true);
    const payload = await fetchAnalyticsReport(query);
    setData(payload || emptyPayload());
    setLoading(false);
  }, [query]);

  useEffect(() => { void load(); }, [load]);

  const audit = data?.audit || { currency: 'KES', attribution_model: 'last_click', reporting_window_days: 30, generated_at: new Date().toISOString() };
  const currency = audit?.currency || 'KES';
  const summaries = data?.platform_summaries || [];
  const accounts = data?.accounts || [];

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-5 space-y-3">
      <header className="bg-white border rounded p-4 flex justify-between">
        <div><h1 className="text- font-semibold flex gap-2"><BarChart3 className="w-4 h-4" />Analytics & Reports</h1><p className="text- text-slate-500">Live data from {accounts.length} accounts</p></div>
        <button onClick={()=>load()} className="border px-3 py-1.5 rounded text- flex gap-1 items-center"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {summaries.map((s: any) => (
          <StatCard key={s.platform} label={s.platform} value={formatNumber(metricValue(s.followers) ?? metricValue(s.reach))} />
        ))}
      </div>

      <div className="bg-white border rounded">
        <div className="p-3 border-b font-medium text-">Platform Performance</div>
        <div className="overflow-x-auto">
          <table className="w-full text-">
            <thead><tr className="text-left text-slate-500 border-b"><th className="py-2 px-3">Platform</th><th className="text-right px-2">Followers</th><th className="text-right px-2">Reach</th><th className="text-right px-2">Views</th></tr></thead>
            <tbody>
              {summaries.map((s: any) => (
                <tr key={s.platform} className="border-b"><td className="px-3 py-2 font-medium">{s.platform}</td><td className="text-right px-2">{formatNumber(metricValue(s.followers))}</td><td className="text-right px-2">{formatNumber(metricValue(s.reach))}</td><td className="text-right px-2">{formatNumber(metricValue(s.views))}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border rounded p-4">
        <h2 className="font-medium text-">Sync Status</h2>
        <div className="mt-2 space-y-1 text-">
          {accounts.length ? accounts.map((a: any) => <div key={a.id} className="flex justify-between border-b py-1"><span>{a.platform} - {a.handle}</span><span className="text-slate-500">{a.sync_status || 'ok'}</span></div>) : <div className="text-slate-500">No accounts connected - connect in Accounts tab</div>}
        </div>
        <div className="mt-3 text- text-slate-500">Currency: {currency} | Model: {audit?.attribution_model || 'last_click'} | Generated: {audit?.generated_at ? new Date(audit.generated_at).toLocaleString() : '—'}</div>
      </div>
    </div>
  );
}

export default function SocialAnalyticsPage() {
  return <Suspense fallback={<div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>}><PageContent /></Suspense>;
}
