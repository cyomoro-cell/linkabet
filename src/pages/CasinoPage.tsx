import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Gamepad2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const CasinoPage = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container py-12">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <Gamepad2 className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Casino</h1>
              <p className="text-muted-foreground">Slots, table games & more</p>
            </div>
          </div>
        </div>

        <div className="text-center py-20">
          <p className="text-muted-foreground">Casino games coming soon</p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CasinoPage;
