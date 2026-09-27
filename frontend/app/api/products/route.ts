import { NextRequest, NextResponse } from 'next/server';
import { products, categorySlug, toSummary } from '@/data/products';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);

    const categoryParam = searchParams.get('category');
    const q = (searchParams.get('q') ?? '').toLowerCase().trim();
    const stock = searchParams.get('stock') ?? 'all';
    const sort = searchParams.get('sort') ?? 'featured';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') ?? '24', 10));
    const full = searchParams.get('full') === '1';

    // Filter
    let result = [...products];

    if (categoryParam) {
        result = result.filter((p) => categorySlug(p.category) === categoryParam);
    }

    if (q) {
        result = result.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                p.brand.toLowerCase().includes(q) ||
                p.category.toLowerCase().includes(q)
        );
    }

    if (stock === 'in-stock') {
        result = result.filter((p) => p.stock === 'In Stock');
    } else if (stock === 'low-stock') {
        result = result.filter((p) => p.stock === 'Low Stock');
    }

    // Sort
    switch (sort) {
        case 'price-low': result.sort((a, b) => a.price - b.price); break;
        case 'price-high': result.sort((a, b) => b.price - a.price); break;
        case 'newest':
            result.sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            break;
        case 'rating': result.sort((a, b) => b.rating - a.rating); break;
        default: break;
    }

    // Paginate
    const total = result.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const slice = result.slice(start, start + limit);

    // Shape response
    const items = full ? slice : slice.map(toSummary);
    const categoryName = categoryParam
        ? products.find((p) => categorySlug(p.category) === categoryParam)?.category ?? null
        : null;

    return NextResponse.json({
        products: items,
        total,
        page,
        pages,
        limit,
        category: categoryName ? { name: categoryName } : null,
    });
}