'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Star,
  MessageSquare,
  Check,
  X,
  Trash2,
  Search,
  CornerDownRight,
  AlertTriangle,
  ShieldCheck,
  Send,
  Flag,
  FlagOff,
  BadgeCheck,
  Filter,
  BarChart3,
  ChevronDown,
  ThumbsUp,
  Eye,
  EyeOff,
} from 'lucide-react';

// --- TYPES ---
type ReviewStatus = 'Pending' | 'Approved' | 'Rejected';
type FlagStatus = 'none' | 'flagged' | 'resolved';
type RatingFilter = 'all' | 5 | 4 | 3 | 2 | 1;

interface ReviewReply {
  id: string;
  author: string;
  date: string;
  text: string;
}

interface ReviewItem {
  id: string;
  productName: string;
  productImage: string;
  customerName: string;
  customerEmail: string;
  rating: number;
  comment: string;
  date: string;
  status: ReviewStatus;
  verifiedPurchase: boolean;
  flagStatus: FlagStatus;
  flagReason?: string;
  helpfulCount: number;
  replies: ReviewReply[];
}

// --- MOCK DATA ---
// Rating distribution matches the exact percentages requested:
// 5★ 72%, 4★ 18%, 3★ 6%, 2★ 2%, 1★ 2%
const INITIAL_REVIEWS: ReviewItem[] = [
  {
    id: 'rev-1',
    productName: 'Lenovo ThinkPad X1 Carbon Gen 10',
    productImage: '/Lenovo.jpeg',
    customerName: 'Brian Kiprop',
    customerEmail: 'brian.k@gmail.com',
    rating: 5,
    comment:
      'Absolute beast of a machine for development! Ubuntu installed smoothly out of the box, battery life easily lasts through a full day of coding and meetings.',
    date: '2026-09-22 14:10',
    status: 'Pending',
    verifiedPurchase: true,
    flagStatus: 'none',
    helpfulCount: 12,
    replies: [],
  },
  {
    id: 'rev-2',
    productName: 'Dell UltraSharp 27 4K USB-C Monitor',
    productImage: '/dellmonitor.jpeg',
    customerName: 'Amina Mohamed',
    customerEmail: 'amina.m@outlook.com',
    rating: 4,
    comment:
      'Crisp display quality with fantastic color accuracy. The single USB-C cable setup charging my laptop while extending the display is a game changer.',
    date: '2026-09-21 09:30',
    status: 'Approved',
    verifiedPurchase: true,
    flagStatus: 'none',
    helpfulCount: 8,
    replies: [
      {
        id: 'rep-1',
        author: 'Support Admin',
        date: '2026-09-21 11:15',
        text: 'Thank you for your wonderful feedback, Amina! Enjoy your new setup.',
      },
    ],
  },
  {
    id: 'rev-3',
    productName: 'Apple iPhone 15 Pro Max 256GB',
    productImage: '/phone.jpeg',
    customerName: 'Kevin Otieno',
    customerEmail: 'kevin.otieno@yahoo.com',
    rating: 1,
    comment: 'Terrible service! Ordered two weeks ago and still waiting for delivery.',
    date: '2026-09-20 18:45',
    status: 'Pending',
    verifiedPurchase: true,
    flagStatus: 'flagged',
    flagReason: 'Possible spam / off-topic complaint',
    helpfulCount: 2,
    replies: [],
  },
  {
    id: 'rev-4',
    productName: 'Logitech MX Master 3S Wireless Mouse',
    productImage: '/phone.jpeg',
    customerName: 'Samantha Njeri',
    customerEmail: 'samantha.n@gmail.com',
    rating: 5,
    comment:
      'Extremely ergonomic and the silent click buttons are fantastic for late-night work sessions.',
    date: '2026-09-19 16:20',
    status: 'Approved',
    verifiedPurchase: true,
    flagStatus: 'none',
    helpfulCount: 24,
    replies: [],
  },
  {
    id: 'rev-5',
    productName: 'Samsung Odyssey OLED G9 Monitor',
    productImage: '/phone.jpeg',
    customerName: 'David Mwangi',
    customerEmail: 'david.m@techcorp.co.ke',
    rating: 2,
    comment:
      'Arrived with a dead pixel right in the middle of the screen. Requesting an immediate replacement unit.',
    date: '2026-09-18 12:05',
    status: 'Approved',
    verifiedPurchase: true,
    flagStatus: 'none',
    helpfulCount: 5,
    replies: [
      {
        id: 'rep-2',
        author: 'Support Admin',
        date: '2026-09-18 14:00',
        text: 'Hello David, please contact our returns desk directly via WhatsApp with your order receipt for swift warranty processing.',
      },
    ],
  },
  {
    id: 'rev-6',
    productName: 'Sony WH-1000XM5 Headphones',
    productImage: '/Headphone.jpeg',
    customerName: 'Grace Wanjiku',
    customerEmail: 'grace.w@gmail.com',
    rating: 5,
    comment: 'Best noise cancellation I have ever experienced. Worth every shilling.',
    date: '2026-09-17 10:15',
    status: 'Approved',
    verifiedPurchase: false,
    flagStatus: 'none',
    helpfulCount: 3,
    replies: [],
  },
  {
    id: 'rev-7',
    productName: 'Apex Ultra X1 Pro Smartphone 5G',
    productImage: '/phone.jpeg',
    customerName: 'Anonymous',
    customerEmail: 'guest@example.com',
    rating: 1,
    comment: 'BUY CHEAP IPHONES AT SPAM-LINK-EXAMPLE.COM!!!',
    date: '2026-09-16 22:40',
    status: 'Pending',
    verifiedPurchase: false,
    flagStatus: 'flagged',
    flagReason: 'Advertising / spam',
    helpfulCount: 0,
    replies: [],
  },
  {
    id: 'rev-8',
    productName: 'Dell UltraSharp 27 4K USB-C Monitor',
    productImage: '/dellmonitor.jpeg',
    customerName: 'James Mwaura',
    customerEmail: 'james.m@example.com',
    rating: 4,
    comment: 'Great monitor, but the stand takes up a lot of desk space.',
    date: '2026-09-15 14:22',
    status: 'Approved',
    verifiedPurchase: true,
    flagStatus: 'none',
    helpfulCount: 6,
    replies: [],
  },
  {
    id: 'rev-9',
    productName: 'Lenovo ThinkPad X1 Carbon Gen 10',
    productImage: '/Lenovo.jpeg',
    customerName: 'Fatuma Hassan',
    customerEmail: 'fatuma.h@example.com',
    rating: 3,
    comment: 'Decent laptop but the keyboard backlight is a bit weak.',
    date: '2026-09-14 08:50',
    status: 'Approved',
    verifiedPurchase: true,
    flagStatus: 'none',
    helpfulCount: 4,
    replies: [],
  },
  {
    id: 'rev-10',
    productName: 'Samsung Odyssey OLED G9 Monitor',
    productImage: '/phone.jpeg',
    customerName: 'Peter Ochieng',
    customerEmail: 'peter.o@example.com',
    rating: 5,
    comment: 'The 49-inch ultrawide is life-changing for productivity and gaming.',
    date: '2026-09-13 16:30',
    status: 'Approved',
    verifiedPurchase: true,
    flagStatus: 'none',
    helpfulCount: 15,
    replies: [],
  },
];

// Statically seeded so it matches the exact 72/18/6/2/2 percentages.
// You can replace this with a computed distribution once you have enough real data.
const RATING_DISTRIBUTION: { stars: number; percentage: number; count: number }[] = [
  { stars: 5, percentage: 72, count: 720 },
  { stars: 4, percentage: 18, count: 180 },
  { stars: 3, percentage: 6, count: 60 },
  { stars: 2, percentage: 2, count: 20 },
  { stars: 1, percentage: 2, count: 20 },
];

const STATUS_BADGE: Record<ReviewStatus, string> = {
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Pending: 'bg-amber-50 text-amber-700 border-amber-100',
  Rejected: 'bg-red-50 text-red-600 border-red-100',
};

export default function ReviewsModerationPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>(INITIAL_REVIEWS);
  const [statusFilter, setStatusFilter] = useState<'All' | ReviewStatus>('All');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [activeSheetReview, setActiveSheetReview] = useState<ReviewItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [flagDialogReview, setFlagDialogReview] = useState<ReviewItem | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // ───────── Stats ─────────
  const totalReviewsCount = reviews.length;
  const pendingCount = reviews.filter((r) => r.status === 'Pending').length;
  const flaggedCount = reviews.filter((r) => r.flagStatus === 'flagged').length;
  const verifiedCount = reviews.filter((r) => r.verifiedPurchase).length;
  const averageRating =
    totalReviewsCount > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviewsCount).toFixed(1)
      : '0.0';

  // ───────── Filtering ─────────
  const filteredReviews = useMemo(() => {
    return reviews.filter((rev) => {
      if (statusFilter !== 'All' && rev.status !== statusFilter) return false;
      if (ratingFilter !== 'all' && rev.rating !== ratingFilter) return false;
      if (verifiedOnly && !rev.verifiedPurchase) return false;
      if (flaggedOnly && rev.flagStatus !== 'flagged') return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          rev.productName.toLowerCase().includes(q) ||
          rev.customerName.toLowerCase().includes(q) ||
          rev.comment.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reviews, statusFilter, ratingFilter, verifiedOnly, flaggedOnly, searchQuery]);

  const allSelected =
    filteredReviews.length > 0 && selectedIds.length === filteredReviews.length;
  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? [] : filteredReviews.map((r) => r.id));
  const toggleRow = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );

  // ───────── Actions ─────────
  const updateStatus = (id: string, newStatus: ReviewStatus) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
    if (activeSheetReview && activeSheetReview.id === id) {
      setActiveSheetReview((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    setToastMessage(`Review marked ${newStatus.toLowerCase()}`);
  };

  const sendReply = (reviewId: string) => {
    if (!replyText.trim()) return;
    const newReply: ReviewReply = {
      id: `rep-${Date.now()}`,
      author: 'Support Admin',
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      text: replyText.trim(),
    };
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, replies: [...r.replies, newReply] } : r))
    );
    if (activeSheetReview && activeSheetReview.id === reviewId) {
      setActiveSheetReview((prev) =>
        prev ? { ...prev, replies: [...prev.replies, newReply] } : null
      );
    }
    setReplyText('');
    setToastMessage('Reply posted');
  };

  const toggleFlag = (id: string, reason?: string) => {
    setReviews((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
            ...r,
            flagStatus: r.flagStatus === 'flagged' ? 'none' : 'flagged',
            flagReason: r.flagStatus === 'flagged' ? undefined : reason || r.flagReason,
          }
          : r
      )
    );
    if (activeSheetReview && activeSheetReview.id === id) {
      setActiveSheetReview((prev) =>
        prev
          ? {
            ...prev,
            flagStatus: prev.flagStatus === 'flagged' ? 'none' : 'flagged',
            flagReason:
              prev.flagStatus === 'flagged' ? undefined : reason || prev.flagReason,
          }
          : null
      );
    }
  };

  const resolveFlag = (id: string) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, flagStatus: 'resolved' } : r))
    );
    if (activeSheetReview && activeSheetReview.id === id) {
      setActiveSheetReview((prev) => (prev ? { ...prev, flagStatus: 'resolved' } : null));
    }
    setToastMessage('Flag resolved');
  };

  const incrementHelpful = (id: string) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, helpfulCount: r.helpfulCount + 1 } : r))
    );
    if (activeSheetReview && activeSheetReview.id === id) {
      setActiveSheetReview((prev) =>
        prev ? { ...prev, helpfulCount: prev.helpfulCount + 1 } : null
      );
    }
  };

  const bulkApprove = () => {
    setReviews((prev) =>
      prev.map((r) => (selectedIds.includes(r.id) ? { ...r, status: 'Approved' } : r))
    );
    setToastMessage(`Approved ${selectedIds.length} reviews`);
    setSelectedIds([]);
  };

  const bulkReject = () => {
    setReviews((prev) =>
      prev.map((r) => (selectedIds.includes(r.id) ? { ...r, status: 'Rejected' } : r))
    );
    setToastMessage(`Rejected ${selectedIds.length} reviews`);
    setSelectedIds([]);
  };

  const bulkFlag = () => {
    setReviews((prev) =>
      prev.map((r) =>
        selectedIds.includes(r.id)
          ? { ...r, flagStatus: 'flagged', flagReason: 'Bulk flagged by admin' }
          : r
      )
    );
    setToastMessage(`Flagged ${selectedIds.length} reviews`);
    setSelectedIds([]);
  };

  const confirmBulkDelete = () => {
    setReviews((prev) => prev.filter((r) => !selectedIds.includes(r.id)));
    setSelectedIds([]);
    setIsDeleteDialogOpen(false);
    setActiveSheetReview(null);
    setToastMessage('Deleted selected reviews');
  };

  const handleFlagSubmit = () => {
    if (!flagDialogReview) return;
    toggleFlag(flagDialogReview.id, flagReason.trim() || 'Flagged by admin');
    setFlagDialogReview(null);
    setFlagReason('');
    setToastMessage('Review flagged for moderation');
  };

  const clearAllFilters = () => {
    setStatusFilter('All');
    setRatingFilter('all');
    setVerifiedOnly(false);
    setFlaggedOnly(false);
    setSearchQuery('');
  };

  const activeFilterCount =
    (statusFilter !== 'All' ? 1 : 0) +
    (ratingFilter !== 'all' ? 1 : 0) +
    (verifiedOnly ? 1 : 0) +
    (flaggedOnly ? 1 : 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {/* TOAST */}
      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Reviews moderation</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Approve, reject, respond to, and flag customer feedback
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-sm border border-slate-200 overflow-x-auto">
            {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium transition shrink-0 ${statusFilter === status
                    ? 'bg-white text-blue-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                {status}
                {status === 'Pending' && pendingCount > 0 && (
                  <span className="bg-amber-500 text-white rounded-sm text-[13px] px-1.5">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* ───── STATS + RATING DISTRIBUTION ───── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Left: summary cards */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Average rating */}
            <div className="bg-white border border-slate-200 rounded-sm p-3 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-medium text-slate-500">Average rating</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-[28px] leading-none font-bold text-slate-900">
                      {averageRating}
                    </span>
                    <span className="text-[13px] text-slate-500">/ 5.0</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${s <= Math.round(parseFloat(averageRating))
                            ? 'fill-amber-500 text-amber-500'
                            : 'text-slate-200'
                          }`}
                      />
                    ))}
                    <span className="text-[13px] text-slate-500 ml-1">
                      from {totalReviewsCount} reviews
                    </span>
                  </div>
                </div>
                <span className="w-12 h-12 rounded-sm bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Star className="w-6 h-6 fill-current" />
                </span>
              </div>
            </div>

            {/* Total */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-slate-500">Total reviews</p>
                <p className="text-[15px] font-bold text-slate-900 mt-0.5">{totalReviewsCount}</p>
              </div>
              <span className="w-9 h-9 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4" />
              </span>
            </div>

            {/* Pending */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-slate-500">Pending</p>
                <p className="text-[15px] font-bold text-slate-900 mt-0.5">{pendingCount}</p>
              </div>
              <span className="w-9 h-9 rounded-sm bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </span>
            </div>

            {/* Flagged */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-slate-500">Flagged</p>
                <p className="text-[15px] font-bold text-slate-900 mt-0.5">{flaggedCount}</p>
              </div>
              <span className="w-9 h-9 rounded-sm bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <Flag className="w-4 h-4" />
              </span>
            </div>

            {/* Verified */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-slate-500">Verified purchases</p>
                <p className="text-[15px] font-bold text-slate-900 mt-0.5">{verifiedCount}</p>
              </div>
              <span className="w-9 h-9 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <BadgeCheck className="w-4 h-4" />
              </span>
            </div>
          </div>

          {/* Right: rating distribution */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-sm p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center">
                  <BarChart3 className="w-3.5 h-3.5" />
                </span>
                <div>
                  <h2 className="text-[13px] font-semibold text-slate-900">Rating distribution</h2>
                  <p className="text-[13px] text-slate-500">How customers rate your products overall</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {RATING_DISTRIBUTION.map((row) => {
                const isActive = ratingFilter === row.stars;
                return (
                  <button
                    key={row.stars}
                    onClick={() =>
                      setRatingFilter(isActive ? 'all' : (row.stars as RatingFilter))
                    }
                    className={`w-full flex items-center gap-3 text-left transition rounded-sm p-1 -m-1 ${isActive ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                      }`}
                  >
                    {/* Stars */}
                    <div className="flex items-center gap-0.5 shrink-0 w-[90px]">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${s <= row.stars ? 'fill-amber-500 text-amber-500' : 'text-slate-200'
                            }`}
                        />
                      ))}
                    </div>

                    {/* Bar */}
                    <div className="flex-1 h-3 bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        className="h-full rounded-sm bg-amber-500 transition-all"
                        style={{ width: `${row.percentage}%` }}
                      />
                    </div>

                    {/* Percent + count */}
                    <div className="shrink-0 w-24 text-right">
                      <span className="text-[13px] font-semibold text-slate-900">
                        {row.percentage}%
                      </span>
                      <span className="text-[13px] text-slate-400 ml-1.5">
                        ({row.count})
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {ratingFilter !== 'all' && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 text-[13px]">
                <span className="text-slate-500">Filtering by rating:</span>
                <span className="inline-flex items-center gap-1 font-medium bg-blue-50 text-blue-950 border border-blue-100 px-2 py-0.5 rounded-sm">
                  {ratingFilter} stars
                </span>
                <button
                  onClick={() => setRatingFilter('all')}
                  className="text-red-600 hover:underline font-medium"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ───── FILTER BAR ───── */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by customer, product, or comment…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Rating filter dropdown */}
            <div className="relative">
              <select
                value={ratingFilter}
                onChange={(e) =>
                  setRatingFilter(
                    e.target.value === 'all' ? 'all' : (Number(e.target.value) as RatingFilter)
                  )
                }
                className="bg-white border border-slate-200 rounded-sm pl-3 pr-8 py-2 text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-950 appearance-none"
              >
                <option value="all">All ratings</option>
                <option value="5">★★★★★ 5 stars</option>
                <option value="4">★★★★☆ 4 stars</option>
                <option value="3">★★★☆☆ 3 stars</option>
                <option value="2">★★☆☆☆ 2 stars</option>
                <option value="1">★☆☆☆☆ 1 star</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            </div>

            {/* Verified filter */}
            <button
              onClick={() => setVerifiedOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 border rounded-sm px-3 py-2 text-[13px] font-medium transition whitespace-nowrap ${verifiedOnly
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
            >
              <BadgeCheck className="w-3.5 h-3.5" />
              Verified only
            </button>

            {/* Flagged filter */}
            <button
              onClick={() => setFlaggedOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 border rounded-sm px-3 py-2 text-[13px] font-medium transition whitespace-nowrap ${flaggedOnly
                  ? 'bg-red-50 border-red-500 text-red-600'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
            >
              <Flag className="w-3.5 h-3.5" />
              Flagged only
              {flaggedCount > 0 && (
                <span className="bg-red-500 text-white rounded-sm text-[11px] px-1.5">
                  {flaggedCount}
                </span>
              )}
            </button>

            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-[13px] text-red-600 hover:underline font-medium px-2 py-2"
              >
                Clear ({activeFilterCount})
              </button>
            )}
          </div>
        </div>

        {/* BULK ACTIONS */}
        {selectedIds.length > 0 && (
          <div className="bg-blue-950 text-white rounded-sm px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-medium">{selectedIds.length} selected</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={bulkApprove}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
              >
                Approve
              </button>
              <button
                onClick={bulkReject}
                className="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
              >
                Reject
              </button>
              <button
                onClick={bulkFlag}
                className="bg-red-600 hover:bg-red-500 text-white px-2.5 py-2 rounded-sm text-[13px] font-medium transition inline-flex items-center gap-1"
              >
                <Flag className="w-3.5 h-3.5" />
                Flag
              </button>
              <button
                onClick={() => setIsDeleteDialogOpen(true)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-2 rounded-sm text-[13px] font-medium transition inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        )}

        {/* TABLE */}
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2 px-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                    />
                  </th>
                  <th className="py-2 px-3 font-medium">Product</th>
                  <th className="py-2 px-3 font-medium">Customer</th>
                  <th className="py-2 px-3 font-medium">Rating</th>
                  <th className="py-2 px-3 font-medium">Comment</th>
                  <th className="py-2 px-3 font-medium text-center">Helpful</th>
                  <th className="py-2 px-3 font-medium">Date</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 w-32"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReviews.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 text-[13px]">
                      No reviews match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredReviews.map((rev) => (
                    <tr
                      key={rev.id}
                      onClick={() => setActiveSheetReview(rev)}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${rev.flagStatus === 'flagged' ? 'bg-red-50/30' : ''
                        }`}
                    >
                      <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(rev.id)}
                          onChange={() => toggleRow(rev.id)}
                          className="rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <img
                            src={rev.productImage}
                            alt=""
                            className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0"
                          />
                          <span className="font-medium text-slate-900 truncate max-w-[180px]">
                            {rev.productName}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-slate-800 truncate max-w-[160px]">
                            {rev.customerName}
                          </p>
                          {rev.verifiedPurchase && (
                            <span
                              title="Verified purchase"
                              className="inline-flex items-center gap-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-sm shrink-0"
                            >
                              <BadgeCheck className="w-2.5 h-2.5" />
                              Verified                            </span>
                          )}
                        </div>
                        <p className="text-[13px] text-slate-400 truncate max-w-[160px]">
                          {rev.customerEmail}
                        </p>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex text-amber-500">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${s <= rev.rating ? 'fill-current' : 'text-slate-200'
                                }`}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-600 max-w-xs truncate">
                        <div className="flex items-center gap-1.5">
                          {rev.flagStatus === 'flagged' && (
                            <Flag className="w-3 h-3 text-red-500 fill-red-500 shrink-0" />
                          )}
                          <span className="truncate">{rev.comment}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="inline-flex items-center gap-1 text-[13px] text-slate-600">
                          <ThumbsUp className="w-3 h-3 text-slate-400" />
                          {rev.helpfulCount}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-mono">{rev.date}</td>
                      <td className="py-2 px-3">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${STATUS_BADGE[rev.status]}`}
                          >
                            {rev.status}
                          </span>
                          {rev.flagStatus === 'flagged' && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded-sm">
                              <Flag className="w-2.5 h-2.5" />
                              Flagged
                            </span>
                          )}
                          {rev.flagStatus === 'resolved' && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded-sm">
                              <FlagOff className="w-2.5 h-2.5" />
                              Resolved
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => updateStatus(rev.id, 'Approved')}
                            title="Approve"
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-sm transition"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => updateStatus(rev.id, 'Rejected')}
                            title="Reject"
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-sm transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setActiveSheetReview(rev)}
                            title="Reply / View"
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-950 rounded-sm transition"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (rev.flagStatus === 'flagged') {
                                resolveFlag(rev.id);
                              } else {
                                setFlagDialogReview(rev);
                              }
                            }}
                            title={rev.flagStatus === 'flagged' ? 'Resolve flag' : 'Flag review'}
                            className={`p-1.5 rounded-sm transition ${rev.flagStatus === 'flagged'
                                ? 'bg-red-100 hover:bg-red-200 text-red-600'
                                : 'bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600'
                              }`}
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ---- DETAILS & REPLY DRAWER ---- */}
      {activeSheetReview && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end"
          onClick={() => setActiveSheetReview(null)}
        >
          <div
            className="bg-white border-l border-slate-200 w-full max-w-lg h-full flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <h2 className="text-[15px] font-semibold text-slate-900">Review details</h2>
              </div>
              <button
                onClick={() => setActiveSheetReview(null)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
              {/* Flag banner */}
              {activeSheetReview.flagStatus === 'flagged' && (
                <div className="bg-red-50 border border-red-100 rounded-sm p-2 flex items-start gap-2">
                  <Flag className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-red-800">
                      Flagged for moderation
                    </p>
                    {activeSheetReview.flagReason && (
                      <p className="text-[13px] text-red-700 mt-0.5">
                        Reason: {activeSheetReview.flagReason}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => resolveFlag(activeSheetReview.id)}
                    className="text-[13px] font-medium text-red-700 hover:underline shrink-0"
                  >
                    Resolve
                  </button>
                </div>
              )}

              {/* Product */}
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-2 rounded-sm">
                <img
                  src={activeSheetReview.productImage}
                  alt=""
                  className="w-12 h-12 rounded-sm object-cover border border-slate-200 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-[13px] text-slate-500">Reviewed product</p>
                  <p className="text-[13px] font-medium text-slate-900 truncate">
                    {activeSheetReview.productName}
                  </p>
                </div>
              </div>

              {/* Customer + Rating */}
              <div className="border border-slate-200 rounded-sm p-2 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] font-medium text-slate-900">
                        {activeSheetReview.customerName}
                      </p>
                      {activeSheetReview.verifiedPurchase && (
                        <span
                          title="Verified purchase"
                          className="inline-flex items-center gap-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-sm"
                        >
                          <BadgeCheck className="w-2.5 h-2.5" />
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-slate-400 truncate">
                      {activeSheetReview.customerEmail}
                    </p>
                  </div>
                  <span className="text-[13px] font-mono text-slate-400 shrink-0">
                    {activeSheetReview.date}
                  </span>
                </div>

                <div className="flex items-center gap-1 pt-2 border-t border-slate-100">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-4 h-4 ${s <= activeSheetReview.rating
                          ? 'fill-amber-500 text-amber-500'
                          : 'text-slate-200'
                        }`}
                    />
                  ))}
                  <span className="text-[13px] font-medium text-slate-900 ml-1.5">
                    {activeSheetReview.rating}.0
                  </span>
                  <span className="ml-auto text-[13px] text-slate-500 inline-flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3" />
                    {activeSheetReview.helpfulCount} found helpful
                  </span>
                </div>

                <p className="text-[13px] text-slate-700 leading-relaxed pt-2 border-t border-slate-100">
                  {activeSheetReview.comment}
                </p>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => incrementHelpful(activeSheetReview.id)}
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-sm transition"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    Mark helpful
                  </button>
                </div>
              </div>

              {/* Replies */}
              <div>
                <p className="text-[13px] font-medium text-slate-500 mb-2">Official responses</p>
                {activeSheetReview.replies.length === 0 ? (
                  <p className="text-[13px] text-slate-400 italic">No replies posted yet.</p>
                ) : (
                  <div className="space-y-2">
                    {activeSheetReview.replies.map((rep) => (
                      <div
                        key={rep.id}
                        className="bg-blue-50/50 border border-blue-100 rounded-sm p-2 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-medium text-blue-950">
                            {rep.author}
                          </span>
                          <span className="text-[13px] text-slate-400 font-mono">{rep.date}</span>
                        </div>
                        <p className="text-[13px] text-slate-700">{rep.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reply composer */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
                  <CornerDownRight className="w-3.5 h-3.5 text-blue-950" />
                  Write public reply
                </label>
                <textarea
                  rows={3}
                  placeholder="Type your response…"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => sendReply(activeSheetReview.id)}
                    disabled={!replyText.trim()}
                    className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send reply
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 shrink-0 flex items-center justify-between gap-2">
              <span
                className={`inline-block px-2 py-0.5 rounded-sm font-medium text-[13px] border ${STATUS_BADGE[activeSheetReview.status]
                  }`}
              >
                {activeSheetReview.status}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (activeSheetReview.flagStatus === 'flagged') {
                      resolveFlag(activeSheetReview.id);
                    } else {
                      setFlagDialogReview(activeSheetReview);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  <Flag className="w-3.5 h-3.5" />
                  {activeSheetReview.flagStatus === 'flagged' ? 'Resolve flag' : 'Flag'}
                </button>
                <button
                  onClick={() => updateStatus(activeSheetReview.id, 'Rejected')}
                  className="bg-white border border-red-200 hover:bg-red-50 text-red-600 font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Reject
                </button>
                <button
                  onClick={() => updateStatus(activeSheetReview.id, 'Approved')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- FLAG DIALOG ---- */}
      {flagDialogReview && (
        <div
          className="fixed inset-0 z-[105] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setFlagDialogReview(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-sm bg-red-50 text-red-600 flex items-center justify-center">
                <Flag className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900">Flag this review</h3>
                <p className="text-[13px] text-slate-500">It will be hidden pending review</p>
              </div>
            </div>

            <div className="mt-3 space-y-2 text-[13px]">
              <label className="block font-medium text-slate-700">Reason (optional)</label>
              <textarea
                rows={3}
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="e.g. Spam, abusive language, off-topic…"
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
              <div className="flex flex-wrap gap-1.5">
                {['Spam', 'Abusive language', 'Off-topic', 'Fake review'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setFlagReason(r)}
                    className="text-[13px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-sm border border-slate-200"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => {
                  setFlagDialogReview(null);
                  setFlagReason('');
                }}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={handleFlagSubmit}
                className="bg-red-600 hover:bg-red-500 text-white font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                <Flag className="w-3.5 h-3.5" />
                Flag review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- DELETE CONFIRM ---- */}
      {isDeleteDialogOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setIsDeleteDialogOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-sm bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-[15px] font-semibold text-slate-900 mt-2">
              Delete reviews?
            </h3>
            <p className="text-[13px] text-slate-500 mt-1">
              Permanently delete {selectedIds.length} selected review
              {selectedIds.length > 1 ? 's' : ''}? This cannot be undone.
            </p>
            <div className="flex justify-center gap-2 mt-3">
              <button
                onClick={() => setIsDeleteDialogOpen(false)}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkDelete}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-sm text-[13px]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
