import Navbar from "@/components/homepage/Navbar";
import Hero from "@/components/homepage/Hero";
import Categories from "@/components/homepage/Categories";
import FeaturedProducts from "@/components/homepage/FeaturedProducts";
import BestSellingProducts from "@/components/homepage/BestSellingProducts";
import DealsSection from "@/components/homepage/DealsSection";
import TrustSection from "@/components/homepage/TrustSection";
import Newsletter from "@/components/homepage/Newsletter";
import Footer from "@/components/homepage/Footer";
import NewArrivals from "@/components/homepage/NewArrivals";
import NMapSection from "@/components/homepage/mapsection";
import WhatsAppButton from "@/components/homepage/WhatsAppButton";
import AIAssistantButton from "@/components/homepage/AIAssistantButton";

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

      {/* Floating action buttons — fixed position, don't affect layout.
          Stacked vertically: AI Assistant above WhatsApp. */}
      <AIAssistantButton shopName="MyShop" />
      <WhatsAppButton
        phone="254712345678"
        displayPhone="+254 712 345 678"
        shopName="MyShop"
      />
    </div>
  );
}
