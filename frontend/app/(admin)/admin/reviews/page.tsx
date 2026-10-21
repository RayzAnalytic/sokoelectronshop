'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  BarChart3,
  ChevronDown,
  ThumbsUp,
  Loader2,
  RefreshCw,
  MoreHorizontal,
} from 'lucide-react';

import { adminApi } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import type {
  AdminReview,
  AdminReviewReply,
  AdminReviewStatus,
  AdminReviewFlagStatus,
  AdminReviewStats,
} from '@/lib/admin-types';

type ReviewItem = AdminReview;
type ReviewReply = AdminReviewReply;
type ReviewStatus = AdminReviewStatus;
type FlagStatus = AdminReviewFlagStatus;
type RatingFilter = 'all' | 1 | 2 | 3 | 4 | 5;

const STATUS_BADGE: Record<ReviewStatus, string> = {
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Pending: 'bg-amber-50 text-amber-700 border-amber-100',
  Rejected: 'bg-red-50 text-red-600 border-red-100',
};

const MENU_WIDTH = 176;
const MENU_HEIGHT = 172;

function formatReviewDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function ReviewsModerationPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<AdminReviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const [openMenu, setOpenMenu] = useState<{ id: string; top: number; left: number } | null>(
    null,
  );
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  useEffect(() => {
    if (!openMenu) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (menuRef.current && menuRef.current.contains(target)) return;
      if (target.closest('[data-review-menu-trigger]')) return;
      setOpenMenu(null);
    };
    const onScroll = () => setOpenMenu(null);
    const onResize = () => setOpenMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  const loadAll = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [revs, st] = await Promise.all([
        adminApi.reviews.list({}, signal),
        adminApi.reviews.stats(signal),
      ]);
      setReviews(revs);
      setStats(st);
    } catch (err) {
      if (signal?.aborted) return;
      setLoadError(
        err instanceof ApiError
          ? err.message || 'Could not load reviews.'
          : 'Could not load reviews.',
      );
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const st = await adminApi.reviews.stats();
      setStats(st);
    } catch {
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void loadAll(ctrl.signal);
    return () => ctrl.abort();
  }, [loadAll]);

  const replaceReview = useCallback((updated: ReviewItem) => {
    setReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setActiveSheetReview((prev) =>
      prev && prev.id === updated.id ? updated : prev,
    );
  }, []);

  const showError = useCallback((err: unknown, fallback: string) => {
    setToastMessage(
      err instanceof ApiError ? err.message || fallback : fallback,
    );
  }, []);

  const totalReviewsCount = stats?.total ?? reviews.length;
  const pendingCount = stats?.pending ?? 0;
  const flaggedCount = stats?.flagged ?? 0;
  const verifiedCount = stats?.verified ?? 0;
  const averageRating = (stats?.averageRating ?? 0).toFixed(1);
  const ratingDistribution = stats?.ratingDistribution ?? [];

  const filteredReviews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return reviews.filter((rev) => {
      if (statusFilter !== 'All' && rev.status !== statusFilter) return false;
      if (ratingFilter !== 'all' && rev.rating !== ratingFilter) return false;
      if (verifiedOnly && !rev.verifiedPurchase) return false;
      if (flaggedOnly && rev.flagStatus !== 'flagged') return false;

      if (q) {
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
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );

  const toggleActionMenu = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();

    let left = rect.right - MENU_WIDTH;
    if (left < 8) left = 8;
    if (left + MENU_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - MENU_WIDTH - 8;
    }

    let top = rect.bottom + 4;
    if (top + MENU_HEIGHT > window.innerHeight - 8) {
      top = rect.top - MENU_HEIGHT - 4;
    }
    if (top < 8) top = 8;

    setOpenMenu((prev) => (prev && prev.id === id ? null : { id, top, left }));
  };

  const updateStatus = async (id: string, newStatus: ReviewStatus) => {
    if (busyId) return;
    setBusyId(id);
    try {
      const numericId = Number(id);
      const updated =
        newStatus === 'Approved'
          ? await adminApi.reviews.approve(numericId)
          : await adminApi.reviews.reject(numericId, {});
      replaceReview(updated);
      setToastMessage(`Review marked ${newStatus.toLowerCase()}`);
      void refreshStats();
    } catch (err) {
      showError(err, 'Could not update review status.');
    } finally {
      setBusyId(null);
    }
  };

  const sendReply = async (reviewId: string) => {
    const text = replyText.trim();
    if (!text) return;

    try {
      const newReply = await adminApi.reviews.createReply(
        Number(reviewId),
        { text },
      );

      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? { ...r, replies: [...r.replies, newReply] }
            : r,
        ),
      );
      setActiveSheetReview((prev) =>
        prev && prev.id === reviewId
          ? { ...prev, replies: [...prev.replies, newReply] }
          : prev,
      );

      setReplyText('');
      setToastMessage('Reply posted');
    } catch (err) {
      showError(err, 'Could not post reply.');
    }
  };

  const resolveFlag = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      const updated = await adminApi.reviews.resolveFlag(Number(id));
      replaceReview(updated);
      setToastMessage('Flag resolved');
      void refreshStats();
    } catch (err) {
      showError(err, 'Could not resolve flag.');
    } finally {
      setBusyId(null);
    }
  };

  const incrementHelpful = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      const updated = await adminApi.reviews.markHelpful(Number(id));
      replaceReview(updated);
    } catch (err) {
      showError(err, 'Could not update helpful count.');
    } finally {
      setBusyId(null);
    }
  };

  const bulkApprove = async () => {
    if (selectedIds.length === 0) return;
    try {
      const res = await adminApi.reviews.bulk({
        action: 'approve',
        ids: selectedIds.map(Number),
      });
      setToastMessage(`Approved ${res.affected} review${res.affected === 1 ? '' : 's'}`);
      setSelectedIds([]);
      await loadAll();
    } catch (err) {
      showError(err, 'Could not approve selected reviews.');
    }
  };

  const bulkReject = async () => {
    if (selectedIds.length === 0) return;
    try {
      const res = await adminApi.reviews.bulk({
        action: 'reject',
        ids: selectedIds.map(Number),
      });
      setToastMessage(`Rejected ${res.affected} review${res.affected === 1 ? '' : 's'}`);
      setSelectedIds([]);
      await loadAll();
    } catch (err) {
      showError(err, 'Could not reject selected reviews.');
    }
  };

  const bulkFlag = async () => {
    if (selectedIds.length === 0) return;
    try {
      const res = await adminApi.reviews.bulk({
        action: 'flag',
        ids: selectedIds.map(Number),
        reason: 'Bulk flagged by admin',
      });
      setToastMessage(`Flagged ${res.affected} review${res.affected === 1 ? '' : 's'}`);
      setSelectedIds([]);
      await loadAll();
    } catch (err) {
      showError(err, 'Could not flag selected reviews.');
    }
  };

  const confirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      const res = await adminApi.reviews.bulk({
        action: 'delete',
        ids: selectedIds.map(Number),
      });
      setSelectedIds([]);
      setIsDeleteDialogOpen(false);
      setActiveSheetReview(null);
      setToastMessage(`Deleted ${res.affected} review${res.affected === 1 ? '' : 's'}`);
      await loadAll();
    } catch (err) {
      showError(err, 'Could not delete selected reviews.');
    }
  };

  const handleFlagSubmit = async () => {
    if (!flagDialogReview) return;
    try {
      const updated = await adminApi.reviews.flag(
        Number(flagDialogReview.id),
        { reason: flagReason.trim() || 'Flagged by admin' },
      );
      replaceReview(updated);
      setFlagDialogReview(null);
      setFlagReason('');
      setToastMessage('Review flagged for moderation');
      void refreshStats();
    } catch (err) {
      showError(err, 'Could not flag review.');
    }
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

  const openReviewSheet = (rev: ReviewItem) => {
    setOpenMenu(null);
    setActiveSheetReview(rev);
  };

  const menuReview = openMenu ? reviews.find((r) => r.id === openMenu.id) : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12 relative">
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-[110] bg-slate-900 text-white px-2 py-2 rounded shadow-lg flex items-center gap-2 text-[13px] max-w-md">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="leading-relaxed">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1700px] mx-auto px-2 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-[14px] font-semibold text-slate-900">
              Reviews moderation
            </h1>
            <p className="text-[13px] text-slate-500 mt-0.5 truncate">
              Approve, reject, respond to, and flag customer feedback
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => void loadAll()}
              disabled={isLoading}
              className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-1.5 rounded text-[13px] transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded border border-slate-200 overflow-x-auto">
              {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[13px] font-medium transition shrink-0 ${
                    statusFilter === status
                      ? 'bg-white text-blue-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {status}
                  {status === 'Pending' && pendingCount > 0 && (
                    <span className="bg-amber-500 text-white rounded text-[13px] px-1.5">
                      {pendingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1700px] mx-auto px-0.5 py-2.5 space-y-2">
        {isLoading && reviews.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded p-10 text-center">
            <Loader2 className="w-4 h-4 mx-auto text-slate-300 animate-spin" />
            <p className="text-[13px] text-slate-500 mt-2">Loading reviews…</p>
          </div>
        ) : loadError ? (
          <div className="bg-red-50 border border-red-100 text-red-700 rounded px-3 py-2.5 flex items-start gap-2 text-[13px]">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Could not load reviews</p>
              <p className="text-red-600 mt-0.5">{loadError}</p>
              <button
                onClick={() => void loadAll()}
                className="mt-1.5 text-red-700 hover:underline font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
              <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div className="bg-white border border-slate-200 rounded p-2 sm:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-medium text-slate-500">
                        Average rating
                      </p>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-[24px] leading-none font-bold text-slate-900">
                          {averageRating}
                        </span>
                        <span className="text-[13px] text-slate-500">/ 5.0</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= Math.round(parseFloat(averageRating))
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
                    <span className="w-10 h-10 rounded bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <Star className="w-5 h-5 fill-current" />
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded p-2 flex items-center gap-2">
                  <span className="w-7 h-7 rounded bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-500 truncate">
                      Total reviews
                    </p>
                    <p className="text-[14px] font-semibold text-slate-900 leading-tight">
                      {totalReviewsCount}
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded p-2 flex items-center gap-2">
                  <span className="w-7 h-7 rounded bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-500 truncate">
                      Pending
                    </p>
                    <p className="text-[14px] font-semibold text-slate-900 leading-tight">
                      {pendingCount}
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded p-2 flex items-center gap-2">
                  <span className="w-7 h-7 rounded bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                    <Flag className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-500 truncate">
                      Flagged
                    </p>
                    <p className="text-[14px] font-semibold text-slate-900 leading-tight">
                      {flaggedCount}
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded p-2 flex items-center gap-2">
                  <span className="w-7 h-7 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <BadgeCheck className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-500 truncate">
                      Verified purchases
                    </p>
                    <p className="text-[14px] font-semibold text-slate-900 leading-tight">
                      {verifiedCount}
                    </p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 bg-white border border-slate-200 rounded p-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded bg-blue-50 text-blue-950 flex items-center justify-center">
                    <BarChart3 className="w-3 h-3" />
                  </span>
                  <div>
                    <h2 className="text-[13px] font-semibold text-slate-900">
                      Rating distribution
                    </h2>
                    <p className="text-[13px] text-slate-500">
                      How customers rate your products overall
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {ratingDistribution.length === 0 ? (
                    <p className="text-[13px] text-slate-400 text-center py-5">
                      No reviews yet.
                    </p>
                  ) : (
                    ratingDistribution.map((row) => {
                      const isActive = ratingFilter === row.stars;
                      return (
                        <button
                          key={row.stars}
                          onClick={() =>
                            setRatingFilter(
                              isActive ? 'all' : (row.stars as RatingFilter),
                            )
                          }
                          className={`w-full flex items-center gap-2.5 text-left transition rounded p-1 -m-1 ${
                            isActive ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-0.5 shrink-0 w-[80px]">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3 h-3 ${
                                  s <= row.stars
                                    ? 'fill-amber-500 text-amber-500'
                                    : 'text-slate-200'
                                }`}
                              />
                            ))}
                          </div>

                          <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                            <div
                              className="h-full rounded bg-amber-500 transition-all"
                              style={{ width: `${row.percentage}%` }}
                            />
                          </div>

                          <div className="shrink-0 w-20 text-right">
                            <span className="text-[13px] font-semibold text-slate-900">
                              {row.percentage}%
                            </span>
                            <span className="text-[13px] text-slate-400 ml-1">
                              ({row.count})
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {ratingFilter !== 'all' && (
                  <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-slate-100 text-[13px]">
                    <span className="text-slate-500">Filtering by rating:</span>
                    <span className="inline-flex items-center gap-1 font-medium bg-blue-50 text-blue-950 border border-blue-100 px-1.5 py-0.5 rounded">
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

            <div className="bg-white border border-slate-200 rounded p-0.5 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by customer, product, or comment…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded pl-8 pr-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <div className="relative">
                  <select
                    value={ratingFilter}
                    onChange={(e) =>
                      setRatingFilter(
                        e.target.value === 'all'
                          ? 'all'
                          : (Number(e.target.value) as RatingFilter),
                      )
                    }
                    className="bg-white border border-slate-200 rounded pl-2.5 pr-7 py-1.5 text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-950 appearance-none"
                  >
                    <option value="all">All ratings</option>
                    <option value="5">★★★★★ 5 stars</option>
                    <option value="4">★★★★☆ 4 stars</option>
                    <option value="3">★★★☆☆ 3 stars</option>
                    <option value="2">★★☆☆☆ 2 stars</option>
                    <option value="1">★☆☆☆☆ 1 star</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                </div>

                <button
                  onClick={() => setVerifiedOnly((v) => !v)}
                  className={`inline-flex items-center gap-1 border rounded px-2.5 py-1.5 text-[13px] font-medium transition whitespace-nowrap ${
                    verifiedOnly
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <BadgeCheck className="w-3 h-3" />
                  Verified only
                </button>

                <button
                  onClick={() => setFlaggedOnly((v) => !v)}
                  className={`inline-flex items-center gap-1 border rounded px-2.5 py-1.5 text-[13px] font-medium transition whitespace-nowrap ${
                    flaggedOnly
                      ? 'bg-red-50 border-red-500 text-red-600'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Flag className="w-3 h-3" />
                  Flagged only
                  {flaggedCount > 0 && (
                    <span className="bg-red-500 text-white rounded text-[13px] px-1.5">
                      {flaggedCount}
                    </span>
                  )}
                </button>

                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="text-[13px] text-red-600 hover:underline font-medium px-1.5 py-1.5"
                  >
                    Clear ({activeFilterCount})
                  </button>
                )}
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div className="bg-blue-950 text-white rounded px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-medium">
                  {selectedIds.length} selected
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    onClick={() => void bulkApprove()}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded text-[13px] font-medium transition"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => void bulkReject()}
                    className="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1.5 rounded text-[13px] font-medium transition"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => void bulkFlag()}
                    className="bg-red-600 hover:bg-red-500 text-white px-2.5 py-1.5 rounded text-[13px] font-medium transition inline-flex items-center gap-1"
                  >
                    <Flag className="w-3 h-3" />
                    Flag
                  </button>
                  <button
                    onClick={() => setIsDeleteDialogOpen(true)}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-1.5 rounded text-[13px] font-medium transition inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-1.5 px-2 w-8">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                        />
                      </th>
                      <th className="py-1.5 px-2 font-medium">Product</th>
                      <th className="py-1.5 px-2 font-medium">Customer</th>
                      <th className="py-1.5 px-2 font-medium">Rating</th>
                      <th className="py-1.5 px-2 font-medium">Comment</th>
                      <th className="py-1.5 px-2 font-medium text-center">Helpful</th>
                      <th className="py-1.5 px-2 font-medium">Date</th>
                      <th className="py-1.5 px-2 font-medium">Status</th>
                      <th className="py-1.5 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReviews.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-slate-400 text-[13px]">
                          {reviews.length === 0
                            ? 'No reviews yet.'
                            : 'No reviews match your filters.'}
                        </td>
                      </tr>
                    ) : (
                      filteredReviews.map((rev) => {
                        const isBusy = busyId === rev.id;
                        const isMenuOpen = openMenu?.id === rev.id;
                        return (
                          <tr
                            key={rev.id}
                            onClick={() => !isBusy && openReviewSheet(rev)}
                            className={`hover:bg-slate-50 transition-colors ${
                              isBusy ? 'opacity-60' : 'cursor-pointer'
                            } ${rev.flagStatus === 'flagged' ? 'bg-red-50/30' : ''}`}
                          >
                            <td className="py-1.5 px-2" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(rev.id)}
                                onChange={() => toggleRow(rev.id)}
                                disabled={isBusy}
                                className="rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <div className="flex items-center gap-1.5">
                                {rev.productImage ? (
                                  <img
                                    src={rev.productImage}
                                    alt=""
                                    className="w-7 h-7 rounded object-cover border border-slate-200 shrink-0"
                                  />
                                ) : (
                                  <span className="w-7 h-7 rounded bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </span>
                                )}
                                <span className="font-medium text-slate-900 truncate max-w-[180px]">
                                  {rev.productName}
                                </span>
                              </div>
                            </td>
                            <td className="py-1.5 px-2">
                              <div className="flex items-center gap-1">
                                <p className="font-medium text-slate-800 truncate max-w-[140px]">
                                  {rev.customerName}
                                </p>
                                {rev.verifiedPurchase && (
                                  <span
                                    title="Verified purchase"
                                    className="inline-flex items-center gap-0.5 text-[13px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 px-1 py-0.5 rounded shrink-0"
                                  >
                                    <BadgeCheck className="w-2.5 h-2.5" />
                                    Verified
                                  </span>
                                )}
                              </div>
                              <p className="text-[13px] text-slate-400 truncate max-w-[140px]">
                                {rev.customerEmail || '—'}
                              </p>
                            </td>
                            <td className="py-1.5 px-2">
                              <div className="flex text-amber-500">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    className={`w-3 h-3 ${
                                      s <= rev.rating ? 'fill-current' : 'text-slate-200'
                                    }`}
                                  />
                                ))}
                              </div>
                            </td>
                            <td className="py-1.5 px-2 text-slate-600 max-w-xs truncate">
                              <div className="flex items-center gap-1">
                                {rev.flagStatus === 'flagged' && (
                                  <Flag className="w-3 h-3 text-red-500 fill-red-500 shrink-0" />
                                )}
                                <span className="truncate">{rev.comment}</span>
                              </div>
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <span className="inline-flex items-center gap-1 text-[13px] text-slate-600">
                                <ThumbsUp className="w-3 h-3 text-slate-400" />
                                {rev.helpfulCount}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 text-slate-400 font-mono text-[13px] whitespace-nowrap">
                              {formatReviewDate(rev.date)}
                            </td>
                            <td className="py-1.5 px-2">
                              <div className="flex flex-col gap-1">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[13px] font-medium border ${STATUS_BADGE[rev.status]}`}
                                >
                                  {rev.status}
                                </span>
                                {rev.flagStatus === 'flagged' && (
                                  <span className="inline-flex items-center gap-0.5 text-[13px] font-medium bg-red-50 text-red-600 border border-red-100 px-1 py-0.5 rounded">
                                    <Flag className="w-2.5 h-2.5" />
                                    Flagged
                                  </span>
                                )}
                                {rev.flagStatus === 'resolved' && (
                                  <span className="inline-flex items-center gap-0.5 text-[13px] font-medium bg-slate-100 text-slate-600 border border-slate-200 px-1 py-0.5 rounded">
                                    <FlagOff className="w-2.5 h-2.5" />
                                    Resolved
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-1.5 px-2" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end">
                                <button
                                  type="button"
                                  data-review-menu-trigger
                                  onClick={(e) => toggleActionMenu(e, rev.id)}
                                  disabled={isBusy}
                                  title="Actions"
                                  className={`p-1 rounded transition disabled:opacity-40 ${
                                    isMenuOpen
                                      ? 'bg-blue-50 text-blue-950'
                                      : 'bg-slate-50 hover:bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {isBusy ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {openMenu && menuReview && (
        <div
          ref={menuRef}
          style={{ top: openMenu.top, left: openMenu.left, width: MENU_WIDTH }}
          className="fixed z-[120] bg-white border border-slate-200 rounded shadow-lg py-1 text-[13px]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setOpenMenu(null);
              void updateStatus(menuReview.id, 'Approved');
            }}
            disabled={busyId === menuReview.id}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            Approve
          </button>

          <button
            type="button"
            onClick={() => {
              setOpenMenu(null);
              void updateStatus(menuReview.id, 'Rejected');
            }}
            disabled={busyId === menuReview.id}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
          >
            <X className="w-3.5 h-3.5 text-amber-600" />
            Reject
          </button>

          <button
            type="button"
            onClick={() => openReviewSheet(menuReview)}
            disabled={busyId === menuReview.id}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-950" />
            Reply / View
          </button>

          <div className="my-1 border-t border-slate-100" />

          <button
            type="button"
            onClick={() => {
              setOpenMenu(null);
              if (menuReview.flagStatus === 'flagged') {
                void resolveFlag(menuReview.id);
              } else {
                setFlagDialogReview(menuReview);
              }
            }}
            disabled={busyId === menuReview.id}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition disabled:opacity-40 ${
              menuReview.flagStatus === 'flagged'
                ? 'text-red-600 hover:bg-red-50'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            {menuReview.flagStatus === 'flagged' ? 'Resolve flag' : 'Flag review'}
          </button>
        </div>
      )}

      {activeSheetReview && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end"
          onClick={() => setActiveSheetReview(null)}
        >
          <div
            className="bg-white border-l border-slate-200 w-full max-w-lg h-full flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded bg-blue-50 text-blue-950 flex items-center justify-center">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </span>
                <h2 className="text-[13px] font-semibold text-slate-900">
                  Review details
                </h2>
              </div>
              <button
                onClick={() => setActiveSheetReview(null)}
                className="h-7 w-7 rounded hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-[13px]">
              {activeSheetReview.flagStatus === 'flagged' && (
                <div className="bg-red-50 border border-red-100 rounded p-2 flex items-start gap-2">
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
                    onClick={() => void resolveFlag(activeSheetReview.id)}
                    className="text-[13px] font-medium text-red-700 hover:underline shrink-0"
                  >
                    Resolve
                  </button>
                </div>
              )}

              {activeSheetReview.status === 'Rejected' &&
                activeSheetReview.rejectionReason && (
                  <div className="bg-red-50 border border-red-100 rounded p-2">
                    <p className="text-[13px] font-medium text-red-800">
                      Rejection reason
                    </p>
                    <p className="text-[13px] text-red-700 mt-0.5">
                      {activeSheetReview.rejectionReason}
                    </p>
                  </div>
                )}

              <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 p-2 rounded">
                {activeSheetReview.productImage ? (
                  <img
                    src={activeSheetReview.productImage}
                    alt=""
                    className="w-10 h-10 rounded object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <span className="w-10 h-10 rounded bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-[13px] text-slate-500">Reviewed product</p>
                  <p className="text-[13px] font-medium text-slate-900 truncate">
                    {activeSheetReview.productName}
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 rounded p-2 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-[13px] font-medium text-slate-900">
                        {activeSheetReview.customerName}
                      </p>
                      {activeSheetReview.verifiedPurchase && (
                        <span
                          title="Verified purchase"
                          className="inline-flex items-center gap-0.5 text-[13px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 px-1 py-0.5 rounded"
                        >
                          <BadgeCheck className="w-2.5 h-2.5" />
                          Verified
                        </span>
                      )}
                    </div>
                    {activeSheetReview.customerEmail && (
                      <p className="text-[13px] text-slate-400 truncate">
                        {activeSheetReview.customerEmail}
                      </p>
                    )}
                  </div>
                  <span className="text-[13px] font-mono text-slate-400 shrink-0">
                    {formatReviewDate(activeSheetReview.date)}
                  </span>
                </div>

                <div className="flex items-center gap-1 pt-2 border-t border-slate-100">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3.5 h-3.5 ${
                        s <= activeSheetReview.rating
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

                {activeSheetReview.title && (
                  <p className="text-[12px] font-medium text-slate-900 pt-2 border-t border-slate-100">
                    {activeSheetReview.title}
                  </p>
                )}

                <p className="text-[13px] text-slate-700 leading-relaxed pt-2 border-t border-slate-100">
                  {activeSheetReview.comment}
                </p>

                {activeSheetReview.images.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                    {activeSheetReview.images.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt=""
                        className="w-14 h-14 rounded object-cover border border-slate-200"
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => void incrementHelpful(activeSheetReview.id)}
                    className="inline-flex items-center gap-1 text-[13px] font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1.5 rounded transition"
                  >
                    <ThumbsUp className="w-3 h-3" />
                    Mark helpful
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[13px] font-medium text-slate-500 mb-1.5">
                  Official responses
                </p>
                {activeSheetReview.replies.length === 0 ? (
                  <p className="text-[13px] text-slate-400 italic">
                    No replies posted yet.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {activeSheetReview.replies.map((rep) => (
                      <div
                        key={rep.id}
                        className="bg-blue-50/50 border border-blue-100 rounded p-2 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-medium text-blue-950">
                            {rep.author}
                          </span>
                          <span className="text-[13px] text-slate-400 font-mono">
                            {formatReviewDate(rep.date)}
                          </span>
                        </div>
                        <p className="text-[13px] text-slate-700">{rep.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
                  <CornerDownRight className="w-3 h-3 text-blue-950" />
                  Write public reply
                </label>
                <textarea
                  rows={3}
                  placeholder="Type your response…"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => void sendReply(activeSheetReview.id)}
                    disabled={!replyText.trim()}
                    className="inline-flex items-center gap-1 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded text-[13px] disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    Send reply
                  </button>
                </div>
              </div>
            </div>

            <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 shrink-0 flex items-center justify-between gap-2">
              <span
                className={`inline-block px-1.5 py-0.5 rounded text-[13px] font-medium border ${
                  STATUS_BADGE[activeSheetReview.status]
                }`}
              >
                {activeSheetReview.status}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    if (activeSheetReview.flagStatus === 'flagged') {
                      void resolveFlag(activeSheetReview.id);
                    } else {
                      setFlagDialogReview(activeSheetReview);
                    }
                  }}
                  className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-1.5 rounded text-[13px]"
                >
                  <Flag className="w-3 h-3" />
                  {activeSheetReview.flagStatus === 'flagged'
                    ? 'Resolve flag'
                    : 'Flag'}
                </button>
                <button
                  onClick={() => void updateStatus(activeSheetReview.id, 'Rejected')}
                  className="bg-white border border-red-200 hover:bg-red-50 text-red-600 font-medium px-2.5 py-1.5 rounded text-[13px]"
                >
                  Reject
                </button>
                <button
                  onClick={() => void updateStatus(activeSheetReview.id, 'Approved')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-2.5 py-1.5 rounded text-[13px]"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {flagDialogReview && (
        <div
          className="fixed inset-0 z-[105] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2"
          onClick={() => setFlagDialogReview(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded max-w-md w-full p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-md bg-red-50 text-red-600 flex items-center justify-center">
                <Flag className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-[13px] font-semibold text-slate-900">
                  Flag this review
                </h3>
                <p className="text-[13px] text-slate-500">
                  It will be hidden pending review
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2 text-[13px]">
              <label className="block font-medium text-slate-700 text-[13px]">
                Reason (optional)
              </label>
              <textarea
                rows={3}
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="e.g. Spam, abusive language, off-topic…"
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
              <div className="flex flex-wrap gap-1">
                {['Spam', 'Abusive language', 'Off-topic', 'Fake review'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setFlagReason(r)}
                    className="text-[13px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded border border-slate-200"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-1.5 mt-2">
              <button
                onClick={() => {
                  setFlagDialogReview(null);
                  setFlagReason('');
                }}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-1.5 rounded text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleFlagSubmit()}
                className="bg-red-600 hover:bg-red-500 text-white font-medium px-2.5 py-1.5 rounded text-[13px] inline-flex items-center gap-1"
              >
                <Flag className="w-3 h-3" />
                Flag review
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteDialogOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2"
          onClick={() => setIsDeleteDialogOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded max-w-md w-full p-2 shadow-xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-9 h-9 rounded bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-4 h-4" />
            </div>
            <h3 className="text-[13px] font-semibold text-slate-900 mt-2">
              Delete reviews?
            </h3>
            <p className="text-[13px] text-slate-500 mt-1">
              Permanently delete {selectedIds.length} selected review
              {selectedIds.length > 1 ? 's' : ''}? This cannot be undone.
            </p>
            <div className="flex justify-center gap-1.5 mt-2">
              <button
                onClick={() => setIsDeleteDialogOpen(false)}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-1.5 rounded text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmBulkDelete()}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-1.5 rounded text-[13px]"
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
