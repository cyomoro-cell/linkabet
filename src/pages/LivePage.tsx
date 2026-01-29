import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const LivePage = () => {
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
            <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-live/10">
              <Zap className="h-5 w-5 text-live fill-current" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-live" />
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-bold">Live Betting</h1>
              <p className="text-muted-foreground">Real-time action, real-time odds</p>
            </div>
          </div>
        </div>

        <div className="text-center py-20">
          <p className="text-muted-foreground">Live matches will appear here</p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default LivePage;
