'use client';

import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';

// --- TYPES ---
type ReviewStatus = 'Pending' | 'Approved' | 'Rejected';

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
  replies: ReviewReply[];
}

const INITIAL_REVIEWS: ReviewItem[] = [
  {
    id: 'rev-1',
    productName: 'Lenovo ThinkPad X1 Carbon Gen 10',
    productImage: '/Lenovo.jpeg',
    customerName: 'Brian Kiprop',
    customerEmail: 'brian.k@gmail.com',
    rating: 5,
    comment: 'Absolute beast of a machine for development! Ubuntu installed smoothly out of the box, battery life easily lasts through a full day of coding and meetings.',
    date: '2026-09-22 14:10',
    status: 'Pending',
    replies: [],
  },
  {
    id: 'rev-2',
    productName: 'Dell UltraSharp 27 4K USB-C Monitor',
    productImage: '/dellmonitor.jpeg',
    customerName: 'Amina Mohamed',
    customerEmail: 'amina.m@outlook.com',
    rating: 4,
    comment: 'Crisp display quality with fantastic color accuracy. The single USB-C cable setup charging my laptop while extending the display is a game changer.',
    date: '2026-09-21 09:30',
    status: 'Approved',
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
    replies: [],
  },
  {
    id: 'rev-4',
    productName: 'Logitech MX Master 3S Wireless Mouse',
    productImage: '/phone.jpeg',
    customerName: 'Samantha Njeri',
    customerEmail: 'samantha.n@gmail.com',
    rating: 5,
    comment: 'Extremely ergonomic and the silent click buttons are fantastic for late-night work sessions.',
    date: '2026-09-19 16:20',
    status: 'Approved',
    replies: [],
  },
  {
    id: 'rev-5',
    productName: 'Samsung Odyssey OLED G9 Monitor',
    productImage: '/phone.jpeg',
    customerName: 'David Mwangi',
    customerEmail: 'david.m@techcorp.co.ke',
    rating: 2,
    comment: 'Arrived with a dead pixel right in the middle of the screen. Requesting an immediate replacement unit.',
    date: '2026-09-18 12:05',
    status: 'Rejected',
    replies: [
      {
        id: 'rep-2',
        author: 'Support Admin',
        date: '2026-09-18 14:00',
        text: 'Hello David, please contact our returns desk directly via WhatsApp with your order receipt for swift warranty processing.',
      },
    ],
  },
];

export default function ReviewsModerationPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>(INITIAL_REVIEWS);
  const [statusFilter, setStatusFilter] = useState<'All' | ReviewStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [activeSheetReview, setActiveSheetReview] = useState<ReviewItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const totalReviewsCount = reviews.length;
  const pendingCount = reviews.filter((r) => r.status === 'Pending').length;
  const averageRating =
    totalReviewsCount > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviewsCount).toFixed(1)
      : '0.0';

  const filteredReviews = reviews.filter((rev) => {
    if (statusFilter !== 'All' && rev.status !== statusFilter) return false;
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

  const allSelected = filteredReviews.length > 0 && selectedIds.length === filteredReviews.length;
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : filteredReviews.map((r) => r.id));
  const toggleRow = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const updateStatus = (id: string, newStatus: ReviewStatus) => {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
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

  const confirmBulkDelete = () => {
    setReviews((prev) => prev.filter((r) => !selectedIds.includes(r.id)));
    setSelectedIds([]);
    setIsDeleteDialogOpen(false);
    setActiveSheetReview(null);
    setToastMessage('Deleted selected reviews');
  };

  const statusBadge = (status: ReviewStatus) =>
    status === 'Approved'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : status === 'Pending'
      ? 'bg-amber-50 text-amber-700 border-amber-100'
      : 'bg-red-50 text-red-600 border-red-100';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {/* TOAST */}
      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Reviews moderation</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Approve, reject and respond to customer feedback</p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-sm border border-slate-200 overflow-x-auto">
            {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium transition shrink-0 ${
                  statusFilter === status
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

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-slate-500">Average rating</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[15px] font-bold text-slate-900">{averageRating}</span>
                <div className="flex text-amber-500">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3.5 h-3.5 ${
                        s <= Math.round(parseFloat(averageRating)) ? 'fill-current' : 'text-slate-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <span className="w-9 h-9 rounded-sm bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Star className="w-4 h-4 fill-current" />
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-slate-500">Total reviews</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">{totalReviewsCount}</p>
            </div>
            <span className="w-9 h-9 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4" />
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-slate-500">Pending moderation</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">{pendingCount}</p>
            </div>
            <span className="w-9 h-9 rounded-sm bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </span>
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
                onClick={() => setIsDeleteDialogOpen(true)}
                className="bg-red-600 hover:bg-red-500 text-white px-2.5 py-2 rounded-sm text-[13px] font-medium transition inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        )}

        {/* SEARCH */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
          <input
            type="text"
            placeholder="Search by customer, product, or comment…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none py-0.5"
          />
        </div>

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
                  <th className="py-2 px-3 font-medium">Date</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 w-28"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReviews.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 text-[13px]">
                      No reviews match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredReviews.map((rev) => (
                    <tr
                      key={rev.id}
                      onClick={() => setActiveSheetReview(rev)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
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
                        <p className="font-medium text-slate-800 truncate max-w-[160px]">{rev.customerName}</p>
                        <p className="text-[13px] text-slate-400 truncate max-w-[160px]">{rev.customerEmail}</p>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex text-amber-500">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                s <= rev.rating ? 'fill-current' : 'text-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-600 max-w-xs truncate">{rev.comment}</td>
                      <td className="py-2 px-3 text-slate-400 font-mono">{rev.date}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${statusBadge(
                            rev.status
                          )}`}
                        >
                          {rev.status}
                        </span>
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
                    <p className="text-[13px] font-medium text-slate-900">
                      {activeSheetReview.customerName}
                    </p>
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
                      className={`w-4 h-4 ${
                        s <= activeSheetReview.rating ? 'fill-amber-500 text-amber-500' : 'text-slate-200'
                      }`}
                    />
                  ))}
                  <span className="text-[13px] font-medium text-slate-900 ml-1.5">
                    {activeSheetReview.rating}.0
                  </span>
                </div>

                <p className="text-[13px] text-slate-700 leading-relaxed pt-2 border-t border-slate-100">
                  {activeSheetReview.comment}
                </p>
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
                          <span className="text-[13px] font-medium text-blue-950">{rep.author}</span>
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
                className={`inline-block px-2 py-0.5 rounded-sm font-medium text-[13px] border ${statusBadge(
                  activeSheetReview.status
                )}`}
              >
                {activeSheetReview.status}
              </span>
              <div className="flex items-center gap-2">
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
            <h3 className="text-[15px] font-semibold text-slate-900 mt-2">Delete reviews?</h3>
            <p className="text-[13px] text-slate-500 mt-1">
              Permanently delete {selectedIds.length} selected review{selectedIds.length > 1 ? 's' : ''}?
              This cannot be undone.
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
