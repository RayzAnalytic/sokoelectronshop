'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Star, MessageSquare, Clock, Image as ImageIcon, Pencil, Trash2,
    ExternalLink, X, Check, AlertCircle, Loader2, ShoppingBag,
    Upload, Package,
} from 'lucide-react';
import {
    accountApi,
    ApiError,
    type PendingReviewItem,
    type ReviewRow,
    type ReviewWriteInput,
} from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Local view types
// ─────────────────────────────────────────────────────────────────────────────
type ReviewStatus = 'Published' | 'Pending' | 'Rejected';

interface Review {
    id: number;
    productId: string;
    productName: string;
    productVariant?: string;
    productImage: string;
    productSlug: string;
    rating: number;
    title: string;
    body: string;
    images: string[];
    date: string;
    status: ReviewStatus;
    rejectionReason?: string;
    orderReference: string;
}

interface ReviewDraft {
    rating: number;
    title: string;
    body: string;
    images: string[];
}

interface ProductPreview {
    name: string;
    image: string;
    brand?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping: backend row → local view
// ─────────────────────────────────────────────────────────────────────────────
const titleCase = (s: string): string =>
    s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;

function rowToReview(row: ReviewRow): Review {
    return {
        id: row.id,
        productId: row.product.id,
        productName: row.product.name,
        productVariant: row.variant_label || undefined,
        productImage: row.product.image,
        productSlug: row.product.slug,
        rating: row.rating,
        title: row.title,
        body: row.body,
        images: row.images || [],
        date: row.created_at,
        status: titleCase(row.status) as ReviewStatus,
        rejectionReason: row.rejection_reason || undefined,
        orderReference: row.order_reference || '',
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE_MB = 5;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const TITLE_MAX = 80;
const BODY_MIN = 10;
const BODY_MAX = 1200;
const PAGE_SIZE = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('en-KE', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return iso;
    }
}

function statusStyle(s: ReviewStatus): string {
    switch (s) {
        case 'Published':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'Pending':
            return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'Rejected':
            return 'bg-red-50 text-red-700 border-red-200';
    }
}

function statusIcon(s: ReviewStatus) {
    switch (s) {
        case 'Published':
            return <Check className="h-3 w-3" />;
        case 'Pending':
            return <Clock className="h-3 w-3" />;
        case 'Rejected':
            return <AlertCircle className="h-3 w-3" />;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Editor state
// ─────────────────────────────────────────────────────────────────────────────
type EditorState =
    | {
        mode: 'edit';
        reviewId: number;
        preview: ProductPreview;
        draft: ReviewDraft;
    }
    | {
        mode: 'create';
        pending: PendingReviewItem;
        preview: ProductPreview;
        draft: ReviewDraft;
    };

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function ReviewsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [reviews, setReviews] = useState<Review[]>([]);
    const [pending, setPending] = useState<PendingReviewItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [editorOpen, setEditorOpen] = useState<EditorState | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const flash = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    };

    // ── Initial fetch ──
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const [rows, pend] = await Promise.all([
                    accountApi.reviews.list(),
                    accountApi.reviews.pending(),
                ]);
                if (cancelled) return;
                setReviews(rows.map(rowToReview));
                setPending(pend);
            } catch (err) {
                if (cancelled) return;
                setLoadError(
                    err instanceof ApiError
                        ? err.message || 'Could not load your reviews.'
                        : 'Could not load your reviews.',
                );
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // ── Deep-link: ?order=REF or ?product=ID ──
    useEffect(() => {
        if (pending.length === 0) return;

        const orderRef = searchParams.get('order');
        const productId = searchParams.get('product');
        if (!orderRef && !productId) return;

        const match = pending.find(
            (p) =>
                (orderRef && p.order_reference === orderRef) ||
                (productId && p.product_id === productId),
        );

        if (match) {
            openCreateEditor(match);
            router.replace('/pages/account/reviews');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pending, searchParams, router]);

    // ── Summary stats ──
    const stats = useMemo(() => {
        const total = reviews.length;
        const avg =
            total === 0
                ? 0
                : reviews.reduce((acc, r) => acc + r.rating, 0) / total;
        const pendingCount = reviews.filter((r) => r.status === 'Pending').length;
        const withPhotos = reviews.filter((r) => r.images.length > 0).length;
        return { total, avg, pending: pendingCount, withPhotos };
    }, [reviews]);

    // Reset pagination when the review list changes identity.
    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [reviews.length]);

    const visible = useMemo(
        () => reviews.slice(0, visibleCount),
        [reviews, visibleCount],
    );

    const hasMore = visibleCount < reviews.length;

    // ── Open editors ──
    const openEdit = (review: Review) => {
        setEditorOpen({
            mode: 'edit',
            reviewId: review.id,
            preview: {
                name: review.productName,
                image: review.productImage,
            },
            draft: {
                rating: review.rating,
                title: review.title,
                body: review.body,
                images: [...review.images],
            },
        });
    };

    const openCreateEditor = (item: PendingReviewItem) => {
        setEditorOpen({
            mode: 'create',
            pending: item,
            preview: {
                name: item.product_name,
                image: item.product_image,
                brand: item.product_brand,
            },
            draft: {
                rating: 0,
                title: '',
                body: '',
                images: [],
            },
        });
    };

    const closeEditor = () => setEditorOpen(null);

    // ── Save (create or update) ──
    const saveReview = async (draft: ReviewDraft) => {
        const open = editorOpen;
        if (!open) return;

        const base = {
            rating: draft.rating,
            title: draft.title.trim(),
            body: draft.body.trim(),
            images: draft.images,
        };

        try {
            if (open.mode === 'edit') {
                const updated = await accountApi.reviews.update(
                    open.reviewId,
                    base,
                );
                const mapped = rowToReview(updated);
                setReviews((prev) =>
                    prev.map((r) => (r.id === mapped.id ? mapped : r)),
                );
                flash('Review updated and resubmitted for moderation.');
                setEditorOpen(null);
            } else {
                const p = open.pending;

                const payload: ReviewWriteInput = {
                    ...base,
                    product_id: p.product_id,
                    product_name: p.product_name,
                    product_image: p.product_image,
                    product_brand: p.product_brand,
                    order_reference: p.order_reference,
                };

                const created = await accountApi.reviews.create(payload);
                const mapped = rowToReview(created);

                setReviews((prev) => [mapped, ...prev]);
                setPending((prev) =>
                    prev.filter((x) => x.product_id !== p.product_id),
                );

                flash('Review submitted for moderation.');
                setEditorOpen(null);
            }
        } catch (err) {
            flash(
                err instanceof ApiError
                    ? err.message ||
                    `Could not ${open.mode === 'edit' ? 'update' : 'submit'} the review.`
                    : `Could not ${open.mode === 'edit' ? 'update' : 'submit'} the review.`,
            );
        }
    };

    // ── Delete ──
    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const target = deleteTarget;
        const previous = reviews;

        setReviews((prev) => prev.filter((r) => r.id !== target.id));
        setDeleteTarget(null);

        try {
            await accountApi.reviews.remove(target.id);
            flash('Review deleted.');

            if (target.orderReference) {
                accountApi.reviews.pending().then(setPending).catch(() => { });
            }
        } catch (err) {
            setReviews(previous);
            flash(
                err instanceof ApiError
                    ? err.message || 'Could not delete the review.'
                    : 'Could not delete the review.',
            );
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-5">
            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-[80] bg-slate-900 text-white text-xs px-4 py-3 rounded-sm shadow-lg flex items-start gap-2 max-w-md">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{toast}</span>
                </div>
            )}

            {/* Header */}
            <div className="bg-white border border-slate-200 rounded-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-blue-950" />
                        My Reviews
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {isLoading
                            ? 'Loading…'
                            : pending.length > 0
                                ? `${pending.length} item${pending.length > 1 ? 's' : ''} awaiting your review`
                                : 'View and manage your product reviews.'}
                    </p>
                </div>
                <Link
                    href="/pages/products"
                    className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs transition-colors"
                >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    Shop Products
                </Link>
            </div>

            {/* Load error */}
            {loadError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm text-xs flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {loadError}
                </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryCard
                    label="Total Reviews"
                    value={stats.total.toLocaleString()}
                    icon={<MessageSquare className="h-4 w-4" />}
                    tint="bg-blue-50 text-blue-950"
                />
                <SummaryCard
                    label="Average Rating"
                    value={stats.total > 0 ? stats.avg.toFixed(1) : '—'}
                    icon={<Star className="h-4 w-4 fill-current" />}
                    tint="bg-amber-50 text-amber-900"
                    sub={
                        stats.total > 0 ? (
                            <Stars value={stats.avg} size="xs" />
                        ) : null
                    }
                />
                <SummaryCard
                    label="Awaiting Review"
                    value={pending.length.toLocaleString()}
                    icon={<Clock className="h-4 w-4" />}
                    tint="bg-orange-50 text-orange-900"
                />
                <SummaryCard
                    label="With Photos"
                    value={stats.withPhotos.toLocaleString()}
                    icon={<ImageIcon className="h-4 w-4" />}
                    tint="bg-emerald-50 text-emerald-700"
                />
            </div>

            {/* Awaiting Your Review */}
            {!isLoading && pending.length > 0 && (
                <section className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        <h2 className="text-sm font-semibold text-slate-900">
                            Awaiting Your Review
                        </h2>
                        <span className="text-[11px] text-slate-500">
                            ({pending.length})
                        </span>
                    </div>
                    <ul className="space-y-3">
                        {pending.map((item) => (
                            <li key={`${item.order_reference}-${item.product_id}`}>
                                <PendingCard
                                    item={item}
                                    onWrite={() => openCreateEditor(item)}
                                />
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Your Reviews */}
            <section className="space-y-3">
                {!isLoading && reviews.length > 0 && (
                    <h2 className="text-sm font-semibold text-slate-900 px-1">
                        Your Reviews ({reviews.length})
                    </h2>
                )}

                {isLoading ? (
                    <div className="space-y-3">
                        {[0, 1, 2].map((i) => (
                            <ReviewSkeleton key={i} />
                        ))}
                    </div>
                ) : reviews.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-sm p-12 text-center">
                        <MessageSquare className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                        <h2 className="text-sm font-semibold text-slate-900">
                            You haven&apos;t written any reviews yet.
                        </h2>
                        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                            {pending.length > 0
                                ? 'Pick one of the items above to get started.'
                                : 'Shop products and share your experience with other customers.'}
                        </p>
                        {pending.length === 0 && (
                            <Link
                                href="/pages/products"
                                className="mt-4 inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs transition-colors"
                            >
                                <ShoppingBag className="h-3.5 w-3.5" />
                                Start Shopping
                            </Link>
                        )}
                    </div>
                ) : (
                    <>
                        <ul className="space-y-3">
                            {visible.map((review) => (
                                <li key={review.id}>
                                    <ReviewCard
                                        review={review}
                                        onEdit={() => openEdit(review)}
                                        onDelete={() => setDeleteTarget(review)}
                                    />
                                </li>
                            ))}
                        </ul>

                        {hasMore && (
                            <div className="flex justify-center pt-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setVisibleCount((c) => c + PAGE_SIZE)
                                    }
                                    className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-sm text-xs transition"
                                >
                                    Load more reviews
                                </button>
                            </div>
                        )}
                    </>
                )}
            </section>

            {/* Editor modal */}
            {editorOpen && (
                <ReviewEditor
                    title={
                        editorOpen.mode === 'edit'
                            ? 'Edit Review'
                            : 'Write a Review'
                    }
                    preview={editorOpen.preview}
                    draft={editorOpen.draft}
                    onCancel={closeEditor}
                    onSave={saveReview}
                />
            )}

            {/* Delete confirmation */}
            {deleteTarget && (
                <DeleteConfirm
                    review={deleteTarget}
                    onCancel={() => setDeleteTarget(null)}
                    onConfirm={confirmDelete}
                />
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SummaryCard({
    label,
    value,
    icon,
    tint,
    sub,
}: {
    label: string;
    value: string;
    icon: React.ReactNode;
    tint: string;
    sub?: React.ReactNode;
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-sm p-4">
            <div className="flex items-center justify-between mb-2">
                <span
                    className={`w-9 h-9 rounded-sm flex items-center justify-center ${tint}`}
                >
                    {icon}
                </span>
            </div>
            <p className="text-xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            {sub && <div className="mt-1.5">{sub}</div>}
        </div>
    );
}

function Stars({
    value,
    size = 'sm',
}: {
    value: number;
    size?: 'xs' | 'sm';
}) {
    const cls = size === 'xs' ? 'h-3 w-3' : 'h-4 w-4';
    const full = Math.floor(value);
    const hasHalf = value - full >= 0.5;

    return (
        <div
            className="flex items-center gap-0.5"
            aria-label={`${value.toFixed(1)} out of 5 stars`}
        >
            {[1, 2, 3, 4, 5].map((n) => {
                const filled = n <= full;
                const half = !filled && hasHalf && n === full + 1;
                return (
                    <Star
                        key={n}
                        className={`${cls} ${filled || half
                            ? 'text-amber-500 fill-current'
                            : 'text-slate-300'
                            }`}
                    />
                );
            })}
        </div>
    );
}

function PendingCard({
    item,
    onWrite,
}: {
    item: PendingReviewItem;
    onWrite: () => void;
}) {
    return (
        <article className="bg-white border border-slate-200 rounded-sm p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <img
                src={item.product_image || '/placeholder.png'}
                alt={item.product_name}
                className="w-16 h-16 rounded-sm object-cover border border-slate-200 shrink-0"
            />
            <div className="flex-1 min-w-0">
                {item.product_brand && (
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
                        {item.product_brand}
                    </p>
                )}
                <p className="text-sm font-semibold text-slate-900 truncate">
                    {item.product_name}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        Order #{item.order_reference}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>Delivered {formatDate(item.delivered_at)}</span>
                    {item.quantity > 1 && (
                        <>
                            <span className="text-slate-300">•</span>
                            <span>Qty {item.quantity}</span>
                        </>
                    )}
                </p>
            </div>
            <button
                type="button"
                onClick={onWrite}
                className="shrink-0 inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs transition"
            >
                <Pencil className="h-3 w-3" />
                Write Review
            </button>
        </article>
    );
}

function ReviewCard({
    review,
    onEdit,
    onDelete,
}: {
    review: Review;
    onEdit: () => void;
    onDelete: () => void;
}) {
    // Reviews created before the catalog FK existed may have an empty
    // slug — fall back to a search query so the link never 404s.
    const productHref = review.productSlug
        ? `/pages/products/${review.productSlug}`
        : `/pages/products?q=${encodeURIComponent(review.productName)}`;

    return (
        <article className="bg-white border border-slate-200 rounded-sm p-5">
            <div className="flex flex-col sm:flex-row gap-4">
                <Link
                    href={productHref}
                    className="shrink-0 self-start"
                    aria-label={`View ${review.productName}`}
                >
                    <img
                        src={review.productImage}
                        alt={review.productName}
                        className="w-20 h-20 rounded-sm object-cover border border-slate-200"
                    />
                </Link>

                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                            <Link
                                href={productHref}
                                className="text-sm font-semibold text-slate-900 hover:text-blue-950 line-clamp-1"
                            >
                                {review.productName}
                            </Link>
                            {review.productVariant && (
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    {review.productVariant}
                                </p>
                            )}
                        </div>

                        <span
                            className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border ${statusStyle(
                                review.status,
                            )}`}
                        >
                            {statusIcon(review.status)}
                            {review.status}
                        </span>
                    </div>

                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <Stars value={review.rating} />
                        <span className="text-[11px] text-slate-500">
                            {review.rating.toFixed(1)}
                        </span>
                        {review.orderReference && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                <Check className="h-2.5 w-2.5" />
                                Verified purchase
                            </span>
                        )}
                    </div>

                    {review.title && (
                        <p className="text-[13px] font-semibold text-slate-900 mt-2">
                            {review.title}
                        </p>
                    )}

                    {review.body && (
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-line">
                            {review.body}
                        </p>
                    )}

                    {review.images.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {review.images.map((src, idx) => (
                                <a
                                    key={idx}
                                    href={src}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block"
                                    aria-label={`Review image ${idx + 1}`}
                                >
                                    <img
                                        src={src}
                                        alt={`Review image ${idx + 1}`}
                                        className="w-16 h-16 rounded-sm object-cover border border-slate-200 hover:border-blue-950 transition-colors"
                                    />
                                </a>
                            ))}
                        </div>
                    )}

                    {review.status === 'Rejected' && review.rejectionReason && (
                        <div className="mt-3 bg-red-50 border border-red-100 rounded-sm px-3 py-2 flex items-start gap-2">
                            <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-red-800 leading-relaxed">
                                {review.rejectionReason}
                            </p>
                        </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[11px] text-slate-500">
                            Reviewed {formatDate(review.date)}
                        </p>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onEdit}
                                className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-3 py-1.5 rounded-sm text-[11px] transition"
                            >
                                <Pencil className="h-3 w-3" />
                                Edit Review
                            </button>
                            <Link
                                href={productHref}
                                className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-3 py-1.5 rounded-sm text-[11px] transition"
                            >
                                <ExternalLink className="h-3 w-3" />
                                View Product
                            </Link>
                            <button
                                type="button"
                                onClick={onDelete}
                                aria-label="Delete review"
                                className="inline-flex items-center justify-center h-7 w-7 rounded-sm border border-slate-200 hover:bg-red-50 hover:border-red-200 text-red-600 transition"
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}

function ReviewSkeleton() {
    return (
        <div className="bg-white border border-slate-200 rounded-sm p-5 animate-pulse">
            <div className="flex gap-4">
                <div className="w-20 h-20 rounded-sm bg-slate-200 shrink-0" />
                <div className="flex-1 space-y-3">
                    <div className="h-3 w-1/3 bg-slate-200 rounded" />
                    <div className="h-3 w-1/2 bg-slate-200 rounded" />
                    <div className="h-3 w-full bg-slate-200 rounded" />
                    <div className="h-3 w-2/3 bg-slate-200 rounded" />
                    <div className="h-6 w-24 bg-slate-200 rounded mt-4" />
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Review editor — handles both create and edit
// ─────────────────────────────────────────────────────────────────────────────
function ReviewEditor({
    title,
    preview,
    draft: initialDraft,
    onCancel,
    onSave,
}: {
    title: string;
    preview: ProductPreview;
    draft: ReviewDraft;
    onCancel: () => void;
    onSave: (draft: ReviewDraft) => Promise<void> | void;
}) {
    const [draft, setDraft] = useState<ReviewDraft>(initialDraft);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const validate = (d: ReviewDraft) => {
        const e: Record<string, string> = {};
        if (!d.rating || d.rating < 1 || d.rating > 5)
            e.rating = 'Please select a rating.';
        if (!d.body.trim()) e.body = 'Review text is required.';
        else if (d.body.trim().length < BODY_MIN)
            e.body = `Review text must be at least ${BODY_MIN} characters.`;
        else if (d.body.length > BODY_MAX)
            e.body = `Review text must be under ${BODY_MAX} characters.`;
        if (d.title.length > TITLE_MAX)
            e.title = `Title must be under ${TITLE_MAX} characters.`;
        return e;
    };

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const remaining = MAX_IMAGES - draft.images.length;
        if (remaining <= 0) {
            setErrors((p) => ({
                ...p,
                images: `Maximum ${MAX_IMAGES} images.`,
            }));
            return;
        }

        const toProcess = Array.from(files).slice(0, remaining);
        setUploading(true);

        const accepted: string[] = [];
        const rejected: string[] = [];

        for (const file of toProcess) {
            if (!ACCEPTED_TYPES.includes(file.type)) {
                rejected.push(`${file.name}: unsupported type`);
                continue;
            }
            if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
                rejected.push(`${file.name}: over ${MAX_IMAGE_SIZE_MB}MB`);
                continue;
            }
            try {
                const { url } = await accountApi.reviews.uploadImage(file);
                accepted.push(url);
            } catch {
                rejected.push(`${file.name}: upload failed`);
            }
        }

        setUploading(false);

        if (accepted.length > 0) {
            setDraft((p) => ({ ...p, images: [...p.images, ...accepted] }));
            setErrors((p) => {
                const n = { ...p };
                delete n.images;
                return n;
            });
        }

        if (rejected.length > 0) {
            setErrors((p) => ({ ...p, images: rejected.join(' • ') }));
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeImage = (idx: number) => {
        setDraft((p) => ({
            ...p,
            images: p.images.filter((_, i) => i !== idx),
        }));
    };

    const handleSubmit = async () => {
        const e = validate(draft);
        setErrors(e);
        if (Object.keys(e).length > 0) return;
        if (uploading) return;

        setSubmitting(true);
        try {
            await onSave(draft);
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !submitting && !uploading) onCancel();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onCancel, submitting, uploading]);

    const busy = submitting || uploading;

    return (
        <div
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
            onClick={() => !busy && onCancel()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-editor-title"
        >
            <div
                className="bg-white border border-slate-200 rounded-sm shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                    <h2
                        id="review-editor-title"
                        className="text-sm font-semibold text-slate-900"
                    >
                        {title}
                    </h2>
                    <button
                        type="button"
                        onClick={() => !busy && onCancel()}
                        className="h-7 w-7 flex items-center justify-center rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </header>

                <div className="p-5 overflow-y-auto space-y-5">
                    {/* Product context */}
                    <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-sm">
                        <img
                            src={preview.image || '/placeholder.png'}
                            alt={preview.name}
                            className="w-12 h-12 rounded-sm object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                            {preview.brand && (
                                <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
                                    {preview.brand}
                                </p>
                            )}
                            <p className="text-xs font-semibold text-slate-900 truncate">
                                {preview.name}
                            </p>
                        </div>
                    </div>

                    {/* Rating */}
                    <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                            Rating <span className="text-red-500">*</span>
                        </label>
                        <StarSelector
                            value={draft.rating}
                            onChange={(v) => {
                                setDraft((p) => ({ ...p, rating: v }));
                                if (errors.rating)
                                    setErrors((p) => {
                                        const n = { ...p };
                                        delete n.rating;
                                        return n;
                                    });
                            }}
                        />
                        {errors.rating && (
                            <p className="text-[11px] text-red-600 mt-1">
                                {errors.rating}
                            </p>
                        )}
                    </div>

                    {/* Title */}
                    <div>
                        <div className="flex items-baseline justify-between mb-1">
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Title
                            </label>
                            <span
                                className={`text-[10px] ${draft.title.length > TITLE_MAX
                                    ? 'text-red-600'
                                    : 'text-slate-400'
                                    }`}
                            >
                                {draft.title.length}/{TITLE_MAX}
                            </span>
                        </div>
                        <input
                            type="text"
                            value={draft.title}
                            onChange={(e) =>
                                setDraft((p) => ({ ...p, title: e.target.value }))
                            }
                            placeholder="Summarize your experience"
                            maxLength={TITLE_MAX + 20}
                            className={`w-full bg-slate-50 border rounded-sm py-2 px-3 text-xs text-slate-900 focus:outline-none focus:ring-1 ${errors.title
                                ? 'border-red-400 focus:ring-red-600'
                                : 'border-slate-200 focus:ring-blue-950'
                                }`}
                        />
                        {errors.title && (
                            <p className="text-[11px] text-red-600 mt-1">
                                {errors.title}
                            </p>
                        )}
                    </div>

                    {/* Body */}
                    <div>
                        <div className="flex items-baseline justify-between mb-1">
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Review <span className="text-red-500">*</span>
                            </label>
                            <span
                                className={`text-[10px] ${draft.body.length > BODY_MAX
                                    ? 'text-red-600'
                                    : 'text-slate-400'
                                    }`}
                            >
                                {draft.body.length}/{BODY_MAX}
                            </span>
                        </div>
                        <textarea
                            value={draft.body}
                            onChange={(e) =>
                                setDraft((p) => ({ ...p, body: e.target.value }))
                            }
                            rows={5}
                            placeholder="Share what you liked or didn't like…"
                            className={`w-full bg-slate-50 border rounded-sm py-2 px-3 text-xs text-slate-900 resize-none focus:outline-none focus:ring-1 ${errors.body
                                ? 'border-red-400 focus:ring-red-600'
                                : 'border-slate-200 focus:ring-blue-950'
                                }`}
                        />
                        {errors.body && (
                            <p className="text-[11px] text-red-600 mt-1">
                                {errors.body}
                            </p>
                        )}
                    </div>

                    {/* Images */}
                    <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                            Photos ({draft.images.length}/{MAX_IMAGES})
                        </label>

                        <div className="flex flex-wrap gap-2 mb-2">
                            {draft.images.map((src, idx) => (
                                <div key={idx} className="relative group">
                                    <img
                                        src={src}
                                        alt={`Upload ${idx + 1}`}
                                        className="w-20 h-20 rounded-sm object-cover border border-slate-200"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeImage(idx)}
                                        disabled={uploading}
                                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-slate-900 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40"
                                        aria-label="Remove image"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}

                            {draft.images.length < MAX_IMAGES && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="w-20 h-20 rounded-sm border-2 border-dashed border-slate-300 hover:border-blue-950 hover:bg-blue-50/30 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-blue-950 transition disabled:opacity-60 disabled:cursor-wait"
                                >
                                    {uploading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Upload className="h-4 w-4" />
                                            <span className="text-[10px] font-medium">
                                                Add
                                            </span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={ACCEPTED_TYPES.join(',')}
                            multiple
                            onChange={(e) => handleFiles(e.target.files)}
                            className="hidden"
                        />

                        <p className="text-[10px] text-slate-400">
                            JPG, PNG, or WEBP. Max {MAX_IMAGE_SIZE_MB}MB each, up
                            to {MAX_IMAGES} photos.
                        </p>

                        {errors.images && (
                            <p className="text-[11px] text-red-600 mt-1">
                                {errors.images}
                            </p>
                        )}
                    </div>
                </div>

                <footer className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-sm text-xs transition disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={busy}
                        aria-busy={submitting}
                        className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Submitting…
                            </>
                        ) : uploading ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Uploading…
                            </>
                        ) : (
                            'Submit Review'
                        )}
                    </button>
                </footer>
            </div>
        </div>
    );
}

function StarSelector({
    value,
    onChange,
}: {
    value: number;
    onChange: (v: number) => void;
}) {
    const [hover, setHover] = useState(0);
    const active = hover || value;

    return (
        <div
            className="flex items-center gap-1"
            role="radiogroup"
            aria-label="Rating"
        >
            {[1, 2, 3, 4, 5].map((n) => (
                <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={value === n}
                    aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => onChange(n)}
                    className="p-0.5 transition-transform hover:scale-110"
                >
                    <Star
                        className={`h-6 w-6 ${n <= active
                            ? 'text-amber-500 fill-current'
                            : 'text-slate-300'
                            }`}
                    />
                </button>
            ))}
            {value > 0 && (
                <span className="ml-2 text-[11px] font-medium text-slate-600">
                    {value} / 5
                </span>
            )}
        </div>
    );
}

function DeleteConfirm({
    review,
    onCancel,
    onConfirm,
}: {
    review: Review;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !deleting) onCancel();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onCancel, deleting]);

    const handleConfirm = async () => {
        setDeleting(true);
        try {
            await onConfirm();
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
            onClick={() => !deleting && onCancel()}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="bg-white border border-slate-200 rounded-sm shadow-2xl w-full max-w-md p-5"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-3">
                    <span className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                        <Trash2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900">
                            Delete this review?
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Your review of{' '}
                            <span className="font-medium text-slate-700">
                                {review.productName}
                            </span>{' '}
                            will be permanently removed. This cannot be undone.
                        </p>
                    </div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={deleting}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-sm text-xs transition disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={deleting}
                        aria-busy={deleting}
                        className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-sm text-xs transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {deleting ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Deleting…
                            </>
                        ) : (
                            'Delete Review'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}