// data/products.ts

export type ProductFull = {
    id: string;
    name: string;
    brand: string;
    category: string;
    featured: boolean;
    bestSeller: boolean;
    salesVolume?: string;
    images: string[];
    price: number;
    compareAtPrice: number | null;
    stock: 'In Stock' | 'Low Stock' | 'Out of Stock';
    stockQuantity: number;
    rating: number;
    reviewCount: number;
    description: string;
    createdAt: string;

    // ── Deal / promo fields ──
    /** ISO date/time the promotion ends. null = no active promo timer. */
    promoEndDate?: string | null;
    /** Bullet highlights shown on the product detail modal */
    features?: string[];
    /** Key/value specification table on the product detail modal */
    specs?: Record<string, string>;
};

export type ProductSummary = {
    id: string;
    brand: string;
    name: string;
    price: number;
    compareAtPrice: number | null;
    rating: number;
    reviewCount: number;
    stock: 'In Stock' | 'Low Stock' | 'Out of Stock';
    image: string;
    category: string;
    href: string;
};

export const products: ProductFull[] = [
    // ─── CATALOG / FEATURED / BEST SELLERS ─────────────────────────────
    {
        id: 'prod_8f29s7',
        name: 'Samsung 55" Crystal UHD 4K Smart TV',
        brand: 'Samsung',
        category: 'TVs',
        featured: true,
        bestSeller: true,
        salesVolume: '2.4k+ sold this month',
        images: ['/tvs.jpeg', '/tvs1.jpeg', '/tvs2.jpeg'],
        price: 89999,
        compareAtPrice: 104999,
        stock: 'In Stock',
        stockQuantity: 12,
        rating: 4.7,
        reviewCount: 32,
        description:
            'Bring the cinema home with the Samsung 55" Crystal UHD. The Crystal Processor 4K upscales everything you watch — from streaming shows to legacy DVDs — into sharp, true-to-life 4K, while PurColor expands the color spectrum so sunsets, wildlife footage, and action sequences feel vivid rather than flat.\n\nHDR10+ support dynamically adjusts brightness and contrast scene by scene, keeping dark details visible without washing out bright moments, and Motion Xcelerator 120Hz keeps fast-moving sports and games blur-free. Tizen OS puts Netflix, YouTube, Prime Video, and DSTV Now on the home screen, and built-in voice assistants let you search by talking instead of typing.\n\nWith three HDMI ports, two USB inputs, and Wi-Fi built in, it slots into any living room setup without extra adapters. A clean choice for anyone upgrading from an older 1080p panel — the difference is immediately visible.',
        createdAt: '2025-08-12',
        promoEndDate: '2026-12-31T23:59:59Z',
        features: [
            'Crystal Processor 4K upscaling',
            'PurColor and HDR10+ support',
            'Motion Xcelerator 120Hz',
            'Smart TV powered by Tizen',
        ],
        specs: {
            'Screen Size': '55 inches',
            'Resolution': '3840 x 2160',
            'Refresh Rate': '120Hz',
            'Connectivity': '3x HDMI, 2x USB, Wi-Fi',
        },
    },
    {
        id: 'prod_39xka1',
        name: 'HP Pavilion 15 Core i5 12th Gen Laptop',
        brand: 'HP',
        category: 'Laptops',
        featured: true,
        bestSeller: true,
        salesVolume: '1.8k+ sold this month',
        images: ['/laptop2.jpeg', '/laptop3.jpeg', '/Lenovo.jpeg'],
        price: 78500,
        compareAtPrice: 89000,
        stock: 'In Stock',
        stockQuantity: 8,
        rating: 4.8,
        reviewCount: 45,
        description:
            'The HP Pavilion 15 is built for the way most people actually work — a dozen browser tabs, Slack, Word, a Zoom call, and Spotify in the background, all at once. The 12th Gen Intel Core i5-1235U pairs two performance cores with eight efficiency cores, so heavy tasks get speed when they need it and the laptop sips power the rest of the time, giving you up to eight hours off the charger.\n\n16GB of DDR4 RAM means apps open instantly and stay responsive even with everything running, and the 512GB NVMe SSD boots Windows 11 in seconds and loads large files without lag. The 15.6-inch Full HD IPS display is bright and color-accurate at wide viewing angles, and the backlit keyboard makes late-night work comfortable.\n\nIt is the laptop to buy when you want reliability, not hype. If your work involves Office, browsers, video calls, and light photo editing, this will handle it for years.',
        createdAt: '2025-07-30',
        promoEndDate: '2026-11-15T23:59:59Z',
        features: [
            'Intel Core i5 12th Gen',
            '16GB DDR4 RAM, 512GB NVMe SSD',
            '15.6" Full HD IPS display',
            'Up to 8 hours battery life',
        ],
        specs: {
            'Processor': 'Intel Core i5-1235U',
            'RAM': '16GB',
            'Storage': '512GB SSD',
            'OS': 'Windows 11 Home',
        },
    },
    {
        id: 'prod_91klas',
        name: 'Apple iPhone 13 128GB - Midnight',
        brand: 'Apple',
        category: 'Phones',
        featured: true,
        bestSeller: true,
        salesVolume: '3.1k+ sold this month',
        images: ['/phone.jpeg', '/smartphone2.jpeg', '/smartphone3.jpeg'],
        price: 94999,
        compareAtPrice: 105000,
        stock: 'Low Stock',
        stockQuantity: 3,
        rating: 4.9,
        reviewCount: 88,
        description:
            'The iPhone 13 remains one of the smartest buys in Apple\u2019s lineup. The A15 Bionic chip still benchmarks above most current Android flagships, and it does so while running cooler and sipping battery — you get up to 19 hours of video playback on a single charge.\n\nThe dual 12MP camera system captures sharp, true-to-life photos in any light, with Night mode extending your shooting window well past sunset and Cinematic mode adding a professional depth-of-field effect to video. The 6.1-inch Super Retina XDR display is bright enough to read outdoors, and Ceramic Shield front glass makes it four times more drop-resistant than typical smartphone glass.\n\niOS keeps it supported with updates for years, so this is a phone that will still feel fast in 2028. For anyone coming from an older iPhone or switching from Android, it hits the sweet spot of price, performance, and longevity.',
        createdAt: '2025-06-14',
        promoEndDate: '2026-10-20T23:59:59Z',
        features: [
            'A15 Bionic chip with 6-core CPU',
            'Dual 12MP camera with Cinematic mode',
            '6.1" Super Retina XDR display',
            'Up to 19 hours video playback',
        ],
        specs: {
            'Display': '6.1 inches',
            'Processor': 'A15 Bionic',
            'Storage': '128GB',
            'Battery': '3240 mAh',
        },
    },
    {
        id: 'prod_72ndbc',
        name: 'Sony WH-1000XM4 Wireless Noise Canceling Headphones',
        brand: 'Sony',
        category: 'Audio',
        featured: true,
        bestSeller: true,
        salesVolume: '2.0k+ sold this month',
        images: ['/Headphone.jpeg', '/Headphone2.jpeg', '/Headphone3.jpeg'],
        price: 34500,
        compareAtPrice: 41000,
        stock: 'In Stock',
        stockQuantity: 15,
        rating: 4.9,
        reviewCount: 112,
        description:
            'Sony\u2019s WH-1000XM4 are the headphones that made noise cancellation a must-have. Dual Noise Sensor microphones — one outside, one inside each earcup — read ambient sound 700 times per second and cancel it in real time, silencing airplane engines, office chatter, and city traffic with an eeriness that has to be heard to be believed.\n\nWhen you need to hear someone, Speak-to-Chat pauses your music automatically the moment you start talking, and Quick Attention lets you cup your hand over the right earcup to lower volume without removing the headphones. Up to 30 hours of battery means you can fly Nairobi to London and back without charging, and USB-C fast charge gives you five hours of playback from a 10-minute top-up.\n\nLDAC support streams high-resolution audio over Bluetooth, and the touch-sensitive right earcup handles playback, volume, and calls with simple taps and swipes. Still the reference point years after release.',
        createdAt: '2025-05-22',
        promoEndDate: '2026-12-15T23:59:59Z',
        features: [
            'Industry-leading noise cancellation',
            'Up to 30 hours battery life',
            'Touch sensor controls',
            'Speak-to-Chat and Quick Attention',
        ],
        specs: {
            'Battery': '30 hours',
            'Connectivity': 'Bluetooth 5.0 / Aux',
            'Weight': '254g',
            'Charging': 'USB-C',
        },
    },
    {
        id: 'prod_66plmw',
        name: 'JBL Charge 5 Portable Waterproof Bluetooth Speaker',
        brand: 'JBL',
        category: 'Audio',
        featured: true,
        bestSeller: true,
        salesVolume: '1.5k+ sold this month',
        images: ['/jbl.jpeg', '/jbl2.jpeg', '/jbl3.jpeg'],
        price: 19500,
        compareAtPrice: 23000,
        stock: 'In Stock',
        stockQuantity: 20,
        rating: 4.6,
        reviewCount: 64,
        description:
            'The JBL Charge 5 is the speaker you grab on the way out the door. Its long-excursion driver, separate tweeter, and dual passive bass radiators produce sound that is far bigger than the speaker itself — enough to fill a garden, a beach, or a small party.\n\nIP67 rating means it survives dust, sand, and being dunked in the pool, so it goes anywhere without worry. Twenty hours of playtime covers a whole weekend, and USB-C fast charge gets you back to music in a couple of hours. The built-in powerbank lets you top up your phone mid-party, and PartyBoost pairs two Charge 5 units together for true stereo sound.\n\nBluetooth 5.1 keeps the connection stable up to 30 meters away, and the rugged fabric and rubber housing means it will look the same after a year of abuse as the day you bought it.',
        createdAt: '2025-08-05',
        promoEndDate: '2026-11-30T23:59:59Z',
        features: [
            'JBL Original Pro Sound',
            '20 hours of playtime',
            'IP67 waterproof and dustproof',
            'Built-in powerbank',
        ],
        specs: {
            'Battery Life': '20 hours',
            'Water Resistance': 'IP67',
            'Bluetooth': '5.1',
            'Charging': 'USB-C',
        },
    },
    {
        id: 'prod_54gmrx',
        name: 'Sony PlayStation 5 DualSense Wireless Controller',
        brand: 'Sony',
        category: 'Gaming',
        featured: true,
        bestSeller: true,
        salesVolume: '1.2k+ sold this month',
        images: ['/gamecontroller.jpeg', '/gamecontroller1.jpeg', '/gamecontroller3.jpeg'],
        price: 11500,
        compareAtPrice: 13500,
        stock: 'In Stock',
        stockQuantity: 25,
        rating: 4.8,
        reviewCount: 95,
        description:
            'The DualSense is not just a controller — it is the reason the PS5 feels different. Haptic feedback replaces rumble with nuanced vibration that simulates everything from the tension of a bowstring to the patter of rain, and adaptive triggers resist your finger differently depending on what you are doing in-game.\n\nThe built-in microphone lets you chat with friends without a headset, and the Create button captures screenshots and short clips without leaving the game. Its sculpted grips and balanced weight make it comfortable for marathon sessions, and the rechargeable battery lasts around 12 hours of typical play.\n\nWorks natively with the PS5 and is fully compatible with Windows PCs via USB-C or Bluetooth. A meaningful upgrade if you are still using the standard PS4 controller.',
        createdAt: '2025-09-01',
        promoEndDate: '2026-12-05T23:59:59Z',
        features: [
            'Haptic feedback',
            'Adaptive triggers',
            'Built-in microphone',
            'Create button for sharing',
        ],
        specs: {
            'Connectivity': 'Bluetooth 5.1 / USB-C',
            'Battery': '1560 mAh',
            'Weight': '280g',
            'Compatibility': 'PlayStation 5, PC',
        },
    },
    {
        id: 'prod_21tpac',
        name: 'TP-Link Archer AX50 Wi-Fi 6 Gigabit Router',
        brand: 'TP-Link',
        category: 'Networking',
        featured: true,
        bestSeller: true,
        salesVolume: '950+ sold this month',
        images: ['/Router.jpeg', '/router2.jpeg', '/router3.jpeg'],
        price: 12500,
        compareAtPrice: 15000,
        stock: 'In Stock',
        stockQuantity: 10,
        rating: 4.5,
        reviewCount: 38,
        description:
            'If your house has more than five connected devices, Wi-Fi 6 is the upgrade that actually matters. The Archer AX50 uses OFDMA and MU-MIMO to talk to multiple devices simultaneously instead of one at a time, which means a 4K stream in the lounge no longer stutters when someone downloads a game upstairs.\n\nCombined speeds reach 3 Gbps across the 2.4GHz and 5GHz bands, and four external antennas with beamforming concentrate the signal toward each device rather than spraying it everywhere. The Intel Home Wi-Fi chipset handles dozens of clients without overheating.\n\nTP-Link HomeShield provides parental controls, guest networks, and IoT isolation out of the box. Setup takes five minutes through the TP-Link Tether app, and it works with Amazon Alexa for voice control. The right router if you want to stop thinking about Wi-Fi.',
        createdAt: '2025-04-19',
        promoEndDate: '2026-10-31T23:59:59Z',
        features: [
            'Wi-Fi 6 (802.11ax) technology',
            'Up to 3 Gbps dual-band speeds',
            'Intel Home Wi-Fi Chipset',
            'Works with Alexa',
        ],
        specs: {
            'Standard': 'Wi-Fi 6 (802.11ax)',
            'Speed': '3000 Mbps',
            'Antennas': '4 external',
            'Ports': '1x WAN, 4x LAN Gigabit',
        },
    },
    {
        id: 'prod_88smrt',
        name: 'Xiaomi Mi Smart Band 7 Fitness Tracker',
        brand: 'Xiaomi',
        category: 'Accessories',
        featured: true,
        bestSeller: true,
        salesVolume: '1.6k+ sold this month',
        images: ['/xiaomiwatch.jpeg', '/xiaomiwatch2.jpeg', '/xiaomiwatch3.jpeg'],
        price: 6200,
        compareAtPrice: 7500,
        stock: 'In Stock',
        stockQuantity: 30,
        rating: 4.7,
        reviewCount: 79,
        description:
            'The Mi Band 7 is the tracker most people should buy first. Its 1.62-inch AMOLED display is bright, crisp, and large enough to actually read notifications on, and the band weighs almost nothing, so you forget you are wearing it.\n\n120 workout modes cover every sport from running and cycling to yoga and swimming (it is water-resistant to 5ATM, so pools and showers are fine), and all-day SpO2 and heart-rate monitoring watch for warning signs during sleep and exercise. Sleep tracking distinguishes light, deep, and REM stages and gives you a morning report on how well you actually rested.\n\nBattery life runs up to 14 days on a single charge — far longer than most smartwatches — and USB magnetic charging tops it up in under two hours. Works with both Android and iOS, and pairs with Strava for serious athletes.',
        createdAt: '2025-07-11',
        promoEndDate: '2026-11-20T23:59:59Z',
        features: [
            '1.62" AMOLED display',
            '120 workout modes',
            'SpO2 and heart rate monitoring',
            'Up to 14 days battery life',
        ],
        specs: {
            'Display': '1.62" AMOLED',
            'Battery': '180 mAh',
            'Water Resistance': '5 ATM',
            'Connectivity': 'Bluetooth 5.2',
        },
    },

    // ─── NEW ARRIVALS ──────────────────────────────────────────────────
    {
        id: 'prd_new_01',
        name: 'MacBook Pro 16" M3 Max 36GB RAM 1TB SSD',
        brand: 'Apple',
        category: 'Laptops',
        featured: false,
        bestSeller: false,
        images: ['/macbook.jpeg', '/Lenovo.jpeg', '/laptop3.jpeg'],
        price: 349999,
        compareAtPrice: 379999,
        stock: 'In Stock',
        stockQuantity: 5,
        rating: 4.9,
        reviewCount: 14,
        description:
            'The MacBook Pro 16 with M3 Max is the laptop for people whose work does not fit in a browser tab. The 16-core CPU and 40-core GPU are fast enough to compile large codebases, render 8K video timelines, or train small machine learning models without breaking a sweat — and it does all of that while running silently on battery for up to 22 hours.\n\n36GB of unified memory means Final Cut Pro, Xcode, and Docker can all be open at once without swapping to disk, and the 1TB SSD moves data at over 7GB/s. The 16.2-inch Liquid Retina XDR display is the best laptop screen you can buy: 1600 nits peak brightness for HDR content, 1,000,000:1 contrast ratio, and ProMotion 120Hz for buttery scrolling.\n\nSix speakers, three Thunderbolt 4 ports, HDMI 2.1, SD card slot, and MagSafe 3 round out the ports professionals actually need. Expensive, yes — but if you earn your living on a laptop, nothing else comes close.',
        createdAt: '2026-09-18T10:00:00Z',
        promoEndDate: null,
        features: [
            'Apple M3 Max chip (16-core CPU, 40-core GPU)',
            '36GB unified memory',
            '1TB SSD storage',
            '16.2" Liquid Retina XDR display',
        ],
        specs: {
            'Processor': 'Apple M3 Max',
            'RAM': '36GB unified',
            'Storage': '1TB SSD',
            'Display': '16.2" Liquid Retina XDR',
        },
    },
    {
        id: 'prd_new_02',
        name: 'Samsung Galaxy S24 Ultra 5G 512GB',
        brand: 'Samsung',
        category: 'Phones',
        featured: false,
        bestSeller: false,
        images: ['/smartphone2.jpeg', '/smartphone3.jpeg', '/phone.jpeg'],
        price: 154999,
        compareAtPrice: 169999,
        stock: 'In Stock',
        stockQuantity: 8,
        rating: 4.8,
        reviewCount: 29,
        description:
            'The S24 Ultra is the phone you buy if you want every feature Samsung knows how to make, in one device. The titanium frame is lighter and tougher than aluminum, the flat 6.8-inch Dynamic AMOLED 2X panel is the brightest display on any Samsung phone — 2600 nits peak, enough to read in direct Nairobi sun — and the integrated S Pen means you can take notes, sign documents, or sketch ideas without pulling out a separate device.\n\nThe 200MP main camera captures detail so fine you can crop a photo to a fifth of its frame and still have a printable image, and Galaxy AI adds real-time translation on calls, generative photo editing, and instant transcription of voice memos. Snapdragon 8 Gen 3 for Galaxy is tuned specifically for this phone and handles everything from heavy games to AI workloads without throttling.\n\n512GB storage means you never think about space again, and the 5000mAh battery comfortably lasts a full day of heavy use. This is the Android flagship to beat in 2026.',
        createdAt: '2026-09-15T14:30:00Z',
        promoEndDate: null,
        features: [
            'Snapdragon 8 Gen 3 for Galaxy',
            '200MP main camera with AI processing',
            'Integrated S Pen',
            '6.8" Dynamic AMOLED 2X 120Hz',
        ],
        specs: {
            'Display': '6.8 inches',
            'Processor': 'Snapdragon 8 Gen 3',
            'Storage': '512GB',
            'Battery': '5000 mAh',
        },
    },
    {
        id: 'prd_new_03',
        name: 'Dell UltraSharp 27" 4K USB-C Hub Monitor',
        brand: 'Dell',
        category: 'Accessories',
        featured: false,
        bestSeller: false,
        images: ['/dellmonitor.jpeg', '/monitor2.jpeg', '/monitor3.jpeg'],
        price: 68500,
        compareAtPrice: 75000,
        stock: 'Low Stock',
        stockQuantity: 3,
        rating: 4.7,
        reviewCount: 8,
        description:
            'The Dell UltraSharp 27 is the monitor that quietly makes every other screen in the office look cheap. Its 4K UHD resolution at 27 inches gives you 163 pixels per inch — crisp enough that text looks like paper and photos show detail you would miss on a 1080p panel.\n\nThe IPS panel delivers accurate color across a 178-degree viewing angle, and ComfortView Plus reduces blue-light emissions without the yellow tint that cheap low-blue-light modes introduce. The USB-C port carries video, data, and up to 90W of power delivery over a single cable, so you plug your laptop in once and everything — display, ethernet, USB peripherals, charging — connects through the monitor.\n\nA built-in KVM lets you switch between two computers (say, a work laptop and a personal desktop) with the same keyboard and mouse. Factory-calibrated to 99% sRGB, with a three-year warranty and Dell\u2019s Premium Panel Exchange. If you stare at a screen for eight hours a day, this is not a luxury — it is prevention.',
        createdAt: '2026-09-12T09:15:00Z',
        promoEndDate: null,
        features: [
            '4K UHD 3840 x 2160 resolution',
            'USB-C with 90W power delivery',
            'ComfortView Plus low blue light',
            'InfinityEdge bezel-less design',
        ],
        specs: {
            'Screen Size': '27 inches',
            'Resolution': '3840 x 2160',
            'Panel': 'IPS',
            'Connectivity': 'USB-C, HDMI, DisplayPort',
        },
    },
    {
        id: 'prd_new_04',
        name: 'Anker PowerHouse 767 Portable Power Station',
        brand: 'Anker',
        category: 'Smart Home',
        featured: false,
        bestSeller: false,
        images: ['/powerstation.jpeg', '/powerstation2.jpeg', '/powerstation3.jpeg'],
        price: 189999,
        compareAtPrice: 205000,
        stock: 'In Stock',
        stockQuantity: 4,
        rating: 4.9,
        reviewCount: 19,
        description:
            'The PowerHouse 767 is what you plug things into when the grid goes down or when the grid was never there to begin with. 2,048Wh of LiFePO4 battery storage — the same chemistry used in electric vehicles — holds enough energy to run a fridge for 12 hours, a CPAP machine for 3 nights, or charge a laptop 60 times.\n\n2,400W of AC output runs almost anything you would plug into a wall socket, including power tools and small appliances, with a 3,600W surge capacity for motors and compressors. LiFePO4 cells are rated for 3,000 charge cycles (about 10 years of weekly use) and are dramatically safer than older lithium-ion chemistries.\n\nIt recharges from 0 to 80% in just 1.5 hours from a wall outlet, and supports solar input up to 1,000W for off-grid charging. Wi-Fi and Bluetooth let you monitor charge, set schedules, and receive alerts through the Anker app. The kind of purchase you make once and forget about for a decade.',
        createdAt: '2026-09-10T16:45:00Z',
        promoEndDate: null,
        features: [
            '2048Wh capacity',
            '2400W AC output',
            'LFP batteries with 10-year lifespan',
            'Smart app control via Wi-Fi',
        ],
        specs: {
            'Capacity': '2048Wh',
            'Output': '2400W',
            'Battery Type': 'LiFePO4 (LFP)',
            'Recharge Time': '1.5 hours',
        },
    },
    {
        id: 'prd_new_05',
        name: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones',
        brand: 'Sony',
        category: 'Audio',
        featured: false,
        bestSeller: false,
        images: ['/Headphone.jpeg', '/headphone2.jpeg', '/headphone3.jpeg'],
        price: 48999,
        compareAtPrice: 55000,
        stock: 'In Stock',
        stockQuantity: 12,
        rating: 4.9,
        reviewCount: 42,
        description:
            'The WH-1000XM5 is Sony taking its own benchmark and redefining it. Eight microphones and two dedicated processors work together to cancel noise across a wider frequency range than the XM4 — airplane engine drone, open-plan office chatter, and the low rumble of air conditioning all disappear into a strange, welcome silence.\n\nAuto NC Optimizer adjusts cancellation in real time based on how the headphones sit on your head and whether you are walking or stationary, so you never touch a setting. Up to 30 hours of battery life on a 3-minute quick charge gives you 3 hours of playback, and the new lightweight design (250g vs. 254g on the XM4) with soft-fit leather means you can wear them on a nine-hour flight without discomfort.\n\nPrecise Voice Pickup technology uses AI to isolate your voice on calls, so meetings sound like you are in a quiet room even when you are in a busy one. Multipoint Bluetooth connects to two devices at once — laptop and phone — and switches automatically to whichever is playing. The XM5 is what happens when a company that already made the best product in its category decides to raise its own bar.',
        createdAt: '2026-09-08T11:20:00Z',
        promoEndDate: null,
        features: [
            'Two processors, 8 microphones for ANC',
            'Up to 30 hours battery life',
            'Crystal clear hands-free calling',
            'Multipoint Bluetooth connection',
        ],
        specs: {
            'Battery': '30 hours',
            'Connectivity': 'Bluetooth 5.2 / Aux',
            'Weight': '250g',
            'Charging': 'USB-C fast charge',
        },
    },
    {
        id: 'prd_new_06',
        name: 'LG C4 65" OLED evo 4K Smart TV',
        brand: 'LG',
        category: 'TVs',
        featured: false,
        bestSeller: false,
        images: ['/tvs.jpeg', '/tvs2.jpeg', '/tvs3.jpeg'],
        price: 215000,
        compareAtPrice: 240000,
        stock: 'Out of Stock',
        stockQuantity: 0,
        rating: 4.8,
        reviewCount: 11,
        description:
            'The LG C4 is the TV enthusiasts recommend to anyone who asks, because nothing else at this size delivers OLED picture quality at this price. OLED evo panels are self-lit — every one of the 8.3 million pixels produces its own light and can turn completely off — which gives you infinite contrast and true blacks that no LCD screen can match. The result is depth and realism that makes even ordinary content look cinematic.\n\nThe α9 AI Processor Gen7 handles upscaling, motion smoothing, and tone mapping, and its AI Picture Pro analyzes each scene to optimize brightness and color in real time. For gaming, the C4 is a monster: four HDMI 2.1 ports, 4K at 120Hz, VRR, G-SYNC, and a 0.1ms response time mean PS5 and Xbox Series X games run at their best.\n\nwebOS 24 puts every streaming app on the home screen, supports voice search across apps, and lets you create profiles for each family member. If you watch anything — sport, film, series, games — this is the screen that makes it better.',
        createdAt: '2026-09-05T08:00:00Z',
        promoEndDate: null,
        features: [
            'OLED evo self-lit pixels',
            'α9 AI Processor Gen7',
            'Dolby Vision and Dolby Atmos',
            '0.1ms response time for gaming',
        ],
        specs: {
            'Screen Size': '65 inches',
            'Resolution': '3840 x 2160',
            'Refresh Rate': '120Hz',
            'HDR': 'Dolby Vision, HDR10, HLG',
        },
    },
    {
        id: 'prd_new_07',
        name: 'Keychron Q1 Pro Wireless Custom Mechanical Keyboard',
        brand: 'Keychron',
        category: 'Accessories',
        featured: false,
        bestSeller: false,
        images: ['/slimkeyboard.jpeg', '/slimkeyboard2.jpeg', '/slimkeyboard3.jpeg'],
        price: 24500,
        compareAtPrice: 28000,
        stock: 'In Stock',
        stockQuantity: 15,
        rating: 4.6,
        reviewCount: 31,
        description:
            'The Q1 Pro is a mechanical keyboard for people who have gotten tired of buying plastic keyboards every two years. Its 75% layout keeps the arrow keys and function row but drops the numpad, giving you a compact footprint without losing the keys you actually use.\n\nThe body is CNC-machined from a single block of aluminum, and the double-gasket mounting design lets the PCB and plate flex slightly under each keystroke, which produces a softer, deeper, more satisfying typing feel than the stiff metal keyboards most brands sell. Switches are hot-swappable, meaning you can pull them out and replace them without soldering — try linear switches for gaming, tactile switches for typing, and swap back whenever you like.\n\nQMK and VIA support means you can remap every key, create multiple layers, and save profiles without installing custom firmware. Connects wirelessly via Bluetooth 5.1 to three devices, or over USB-C for the lowest latency. A 4000mAh battery lasts weeks between charges. This is the last keyboard you will need to buy — not because it will never wear out, but because you can replace any part of it yourself.',
        createdAt: '2026-09-02T13:10:00Z',
        promoEndDate: null,
        features: [
            'Full aluminum body',
            '75% compact layout',
            'Hot-swappable switches',
            'QMK/VIA support',
        ],
        specs: {
            'Layout': '75% (81 keys)',
            'Body': 'CNC aluminum',
            'Connectivity': 'Bluetooth 5.1 / USB-C',
            'Battery': '4000 mAh',
        },
    },
    {
        id: 'prd_new_08',
        name: 'iPad Pro 13" M4 Wi-Fi 256GB - Standard Glass',
        brand: 'Apple',
        category: 'Laptops',
        featured: false,
        bestSeller: false,
        images: ['/laptop2.jpeg', '/laptop3.jpeg', '/Lenovo.jpeg'],
        price: 179999,
        compareAtPrice: 194999,
        stock: 'In Stock',
        stockQuantity: 7,
        rating: 4.9,
        reviewCount: 23,
        description:
            'The iPad Pro 13 with M4 is not a bigger iPad — it is a fundamentally different device. Its M4 chip is faster than most laptops sold today, handling video editing, 3D modeling, and iPad multitasking without a stutter. The Ultra Retina XDR display uses Tandem OLED — two OLED panels stacked and driven in perfect sync — to achieve 1,600 nits of peak HDR brightness and 1,000,000:1 contrast, with the deep blacks and precise color that OLED is known for.\n\nAt just 5.1mm thick, it feels impossibly light for its size, yet the aluminum unibody is rigid enough that flex and creak are non-issues. Compatible with the Apple Pencil Pro (with squeeze and barrel-roll gestures for creatives) and the new Magic Keyboard, which turns it into a laptop-like device with a proper trackpad and function row.\n\nFor photographers, designers, musicians, doctors, and anyone whose work benefits from a bright, color-accurate display paired with serious compute power, this is a legitimate alternative to a MacBook. For everyone else, it is an extremely nice luxury.',
        createdAt: '2026-08-30T15:00:00Z',
        promoEndDate: null,
        features: [
            'Apple M4 chip',
            'Ultra Retina XDR Tandem OLED',
            '5.1mm ultra-thin design',
            'All-day battery life',
        ],
        specs: {
            'Display': '13" Ultra Retina XDR',
            'Processor': 'Apple M4',
            'Storage': '256GB',
            'Connectivity': 'Wi-Fi 6E, USB-C Thunderbolt',
        },
    },
];

export const categorySlug = (name: string) =>
    name.toLowerCase().replace(/\s+/g, '-');

export const toSummary = (p: ProductFull): ProductSummary => ({
    id: p.id,
    brand: p.brand,
    name: p.name,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    rating: p.rating,
    reviewCount: p.reviewCount,
    stock: p.stock,
    image: p.images[0] ?? '/placeholder.jpeg',
    category: p.category,
    href: `/pages/products/${p.id}`,
});