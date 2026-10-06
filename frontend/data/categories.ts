// data/categories.ts
//
// ⚠️ NOT USED AT RUNTIME since the catalog backend was introduced.
//
// This file is the source of truth for `catalog/management/commands/seed_catalog.py`
// (the `CATEGORY_ICONS` map must stay in sync with the icon names below). To change
// what the sidebar shows, either edit the Django admin at /admin/catalog/category/
// or update `CATEGORY_ICONS` in the seeder and re-run:
//
//     python manage.py seed_catalog --clear
//
// Frontend code must use `catalogApi.categories.list()` from `@/lib/api`
// instead of importing from this file.

export type Category = {
    slug: string;
    name: string;
    href: string;
    /**
     * Lucide icon *name* — not the component itself.
     * The Sidebar resolves it via the ICONS map in
     * `components/categories/Sidebar.tsx`.
     */
    icon: string;
    itemCount: string;
    image: string;
};

export const categories: Category[] = [
    {
        slug: 'smartphones',
        name: 'Smartphones',
        href: '/pages/categories/smartphones',
        icon: 'Smartphone',
        itemCount: '2 items',
        image: '/phone.jpeg',
    },
    {
        slug: 'laptops',
        name: 'Laptops',
        href: '/pages/categories/laptops',
        icon: 'Laptop',
        itemCount: '2 items',
        image: '/Lenovo.jpeg',
    },
    {
        slug: 'tablets',
        name: 'Tablets',
        href: '/pages/categories/tablets',
        icon: 'Tablet',
        itemCount: '1 item',
        image: '/versatiletablets.jpeg',
    },
    {
        slug: 'tvs',
        name: 'TVs',
        href: '/pages/categories/tvs',
        icon: 'Tv',
        itemCount: '1 item',
        image: '/tvs.jpeg',
    },
    {
        slug: 'audio',
        name: 'Audio',
        href: '/pages/categories/audio',
        icon: 'Headphones',
        itemCount: '1 item',
        image: '/Headphone.jpeg',
    },
    {
        slug: 'gaming',
        name: 'Gaming',
        href: '/pages/categories/gaming',
        icon: 'Gamepad2',
        itemCount: '1 item',
        image: '/gamingkeyboard.jpeg',
    },
    {
        slug: 'cameras',
        name: 'Cameras',
        href: '/pages/categories/cameras',
        icon: 'Camera',
        itemCount: '1 item',
        image: '/cameras.jpeg',
    },
    {
        slug: 'wearables',
        name: 'Wearables',
        href: '/pages/categories/wearables',
        icon: 'Watch',
        itemCount: '1 item',
        image: '/smartwatches.jpeg',
    },
    {
        slug: 'speakers',
        name: 'Speakers',
        href: '/pages/categories/speakers',
        icon: 'Speaker',
        itemCount: '1 item',
        image: '/speakers.jpeg',
    },
    {
        slug: 'networking',
        name: 'Networking',
        href: '/pages/categories/networking',
        icon: 'Router',
        itemCount: '1 item',
        image: '/Router.jpeg',
    },
    {
        slug: 'accessories',
        name: 'Accessories',
        href: '/pages/categories/accessories',
        icon: 'Cable',
        itemCount: '1 item',
        image: '/accessories.jpeg',
    },
    {
        slug: 'storage',
        name: 'Storage',
        href: '/pages/categories/storage',
        icon: 'HardDrive',
        itemCount: '1 item',
        image: '/harddrives.jpeg',
    },
];

export const categorySlug = (name: string) =>
    name.toLowerCase().replace(/\s+/g, '-');