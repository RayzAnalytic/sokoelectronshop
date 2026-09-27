// data/categories.ts
import {
    Smartphone,
    Laptop,
    Tablet,
    Tv,
    Headphones,
    Gamepad2,
    Camera,
    Watch,
    Speaker,
    Router,
    Cable,
    HardDrive,
    type LucideIcon,
} from 'lucide-react';

export type Category = {
    slug: string;
    name: string;
    href: string;
    icon: LucideIcon;
    itemCount: string;
    image: string;
};

export const categories: Category[] = [
    {
        slug: 'smartphones',
        name: 'Smartphones',
        href: '/pages/categories/smartphones',
        icon: Smartphone,
        itemCount: '2 items',
        image: '/phone.jpeg',
    },
    {
        slug: 'laptops',
        name: 'Laptops',
        href: '/pages/categories/laptops',
        icon: Laptop,
        itemCount: '2 items',
        image: '/Lenovo.jpeg',
    },
    {
        slug: 'tablets',
        name: 'Tablets',
        href: '/pages/categories/tablets',
        icon: Tablet,
        itemCount: '1 item',
        image: '/versatiletablets.jpeg',
    },
    {
        slug: 'tvs',
        name: 'TVs',
        href: '/pages/categories/tvs',
        icon: Tv,
        itemCount: '1 item',
        image: '/tvs.jpeg',
    },
    {
        slug: 'audio',
        name: 'Audio',
        href: '/pages/categories/audio',
        icon: Headphones,
        itemCount: '1 item',
        image: '/Headphone.jpeg',
    },
    {
        slug: 'gaming',
        name: 'Gaming',
        href: '/pages/categories/gaming',
        icon: Gamepad2,
        itemCount: '1 item',
        image: '/gamingkeyboard.jpeg',
    },
    {
        slug: 'cameras',
        name: 'Cameras',
        href: '/pages/categories/cameras',
        icon: Camera,
        itemCount: '1 item',
        image: '/cameras.jpeg',
    },
    {
        slug: 'wearables',
        name: 'Wearables',
        href: '/pages/categories/wearables',
        icon: Watch,
        itemCount: '1 item',
        image: '/smartwatches.jpeg',
    },
    {
        slug: 'speakers',
        name: 'Speakers',
        href: '/pages/categories/speakers',
        icon: Speaker,
        itemCount: '1 item',
        image: '/speakers.jpeg',
    },
    {
        slug: 'networking',
        name: 'Networking',
        href: '/pages/categories/networking',
        icon: Router,
        itemCount: '1 item',
        image: '/Router.jpeg',
    },
    {
        slug: 'accessories',
        name: 'Accessories',
        href: '/pages/categories/accessories',
        icon: Cable,
        itemCount: '1 item',
        image: '/accessories.jpeg',
    },
    {
        slug: 'storage',
        name: 'Storage',
        href: '/pages/categories/storage',
        icon: HardDrive,
        itemCount: '1 item',
        image: '/harddrives.jpeg',
    },
];