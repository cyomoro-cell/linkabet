import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, Wallet, User, Trophy, Zap, Gamepad2, Search, LogIn } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/currency';
const navLinks = [
  { href: '/', label: 'Sports', icon: Trophy },
  { href: '/live', label: 'Live', icon: Zap, isLive: true },
  { href: '/casino', label: 'Casino', icon: Gamepad2 },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, wallet } = useAuth();
  const currency = wallet?.currency || 'USD';
  const balance = parseFloat(wallet?.balance?.toString() || '0');
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg font-black text-primary-foreground">L</span>
          </div>
          <span className="text-xl font-black tracking-tight">
            LINKA<span className="text-primary">BET</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.href;
            return (
              <Link
                key={link.href}
                to={link.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isActive
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
                {link.isLive && (
                  <span className="flex h-2 w-2 rounded-full bg-live animate-pulse" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="hidden md:flex">
            <Search className="h-5 w-5" />
          </Button>

          {/* Balance Display */}
          {isAuthenticated ? (
            <>
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="font-bold">{formatCurrency(balance, currency)}</span>
              </div>

              <Link to="/account">
                <Button variant="hero" className="hidden sm:flex">
                  Deposit
                </Button>
              </Link>

              <Link to="/account">
                <Button variant="ghost" size="icon" className="hidden md:flex">
                  <User className="h-5 w-5" />
                </Button>
              </Link>
            </>
          ) : (
            <Link to="/auth">
              <Button variant="hero" className="hidden sm:flex">
                <LogIn className="h-4 w-4" />
                Sign In
              </Button>
            </Link>
          )}

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border bg-background"
          >
            <nav className="container py-4 flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <link.icon className="h-5 w-5" />
                  {link.label}
                  {link.isLive && (
                    <span className="flex h-2 w-2 rounded-full bg-live animate-pulse" />
                  )}
                </Link>
              ))}
              {isAuthenticated ? (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    <span className="font-bold">{formatCurrency(balance, currency)}</span>
                  </div>
                  <Link to="/account">
                    <Button variant="hero" size="sm">
                      Account
                    </Button>
                  </Link>
                </div>
              ) : (
                <Link to="/auth" className="mt-4 pt-4 border-t border-border block">
                  <Button variant="hero" className="w-full">
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </Button>
                </Link>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
