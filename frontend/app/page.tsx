'use client';

import Navbar from '@/components/homepage/Navbar';
import Hero from '@/components/homepage/Hero';
import Categories from '@/components/homepage/Categories';
import FeaturedProducts from '@/components/homepage/FeaturedProducts';
import BestSellingProducts from '@/components/homepage/BestSellingProducts';
import DealsSection from '@/components/homepage/DealsSection';
import TrustSection from '@/components/homepage/TrustSection';
import Newsletter from '@/components/homepage/Newsletter';
import Footer from '@/components/homepage/Footer';
import NewArrivals from '@/components/homepage/NewArrivals';
import NMapSection from '@/components/homepage/mapsection';
import WhatsAppButton from '@/components/homepage/WhatsAppButton';
import AIAssistantButton from '@/components/homepage/AIAssistantButton';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-grow">
        <Hero />
        <Categories />
        <FeaturedProducts />
        <NewArrivals />
        <BestSellingProducts />
        <DealsSection />
        <TrustSection />
        <Newsletter />
        <NMapSection />
      </main>

      <Footer />

      {/*
        Floating action buttons — fixed position, they don't affect
        layout. The AI panel renders its own backdrop at a higher
        z-index, so it floats above the rest of the page while open.
        The WhatsApp button stays mounted; it will be dimmed by the
        backdrop and becomes non-interactive while the AI panel is up.
      */}
      <AIAssistantButton shopName="MyShop" />
      <WhatsAppButton />
    </div>
  );
}
