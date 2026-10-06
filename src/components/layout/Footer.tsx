import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Twitter, Instagram, MessageCircle, Mail, Star, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const footerLinks = {
  sports: [
    { label: 'Football', href: '/sports' },
    { label: 'Basketball', href: '/sports' },
    { label: 'Tennis', href: '/sports' },
    { label: 'Live Betting', href: '/live' },
  ],
  company: [
    { label: 'About Us', href: '/' },
    { label: 'Casino', href: '/casino' },
    { label: 'Promotions', href: '/' },
    { label: 'Contact', href: '/' },
  ],
  support: [
    { label: 'Help Center', href: '/' },
    { label: 'Responsible Gaming', href: '/' },
    { label: 'Terms of Service', href: '/' },
    { label: 'Privacy Policy', href: '/' },
  ],
};

const socialLinks = [
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Instagram, href: '#', label: 'Instagram' },
  { icon: MessageCircle, href: '#', label: 'Discord' },
  { icon: Mail, href: '#', label: 'Email' },
];

const payments = ['MTN MoMo', 'Airtel Money', 'VISA', 'Mastercard', 'eKash'];
const languages = ['English', 'Kinyarwanda', 'Français'];

export function Footer() {
  const [email, setEmail] = useState('');
  const [lang, setLang] = useState('English');

  const subscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error('Please enter a valid email');
    toast.success('Subscribed! Watch your inbox for exclusive offers.');
    setEmail('');
  };

  return (
    <footer className="mt-auto border-t border-gradient-top bg-card">
      <div className="container py-12">
        <div className="mb-12 flex flex-col items-start justify-between gap-6 rounded-2xl border border-border bg-gradient-to-r from-primary/10 to-transparent p-6 md:flex-row md:items-center">
          <div>
            <h3 className="text-xl font-bold">Get exclusive offers</h3>
            <p className="text-sm text-muted-foreground">Bonuses, boosted odds and tips — straight to your inbox.</p>
          </div>
          <form onSubmit={subscribe} className="flex w-full max-w-md gap-2">
            <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
            <Button type="submit" variant="hero">Subscribe</Button>
          </form>
        </div>

        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <Link to="/" className="mb-4 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <span className="text-lg font-black text-primary-foreground">L</span>
              </div>
              <span className="text-xl font-black tracking-tight">LINKA<span className="text-primary">BET</span></span>
            </Link>
            <p className="mb-5 max-w-xs text-sm text-muted-foreground">
              Your premier destination for sports betting. Fast payouts, best odds, and 24/7 support.
            </p>
            <div className="mb-6 inline-flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-2.5">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>
              <span className="text-sm"><b>4.8/5</b> <span className="text-muted-foreground">from 2,340 reviews</span></span>
            </div>
            <div className="flex gap-3">
              {socialLinks.map((s) => (
                <a key={s.label} href={s.href} aria-label={s.label}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-muted-foreground transition-all hover:text-primary hover:shadow-[0_0_20px_hsl(var(--primary)/0.5)]">
                  <s.icon className="h-6 w-6" />
                </a>
              ))}
            </div>
          </div>

          {(['sports', 'company', 'support'] as const).map((k) => (
            <div key={k}>
              <h4 className="mb-4 font-semibold capitalize">{k}</h4>
              <ul className="space-y-2">
                {footerLinks[k].map((l) => (
                  <li key={l.label}>
                    <Link to={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3 border-t border-border pt-8">
          {payments.map((p) => (
            <span key={p} className="rounded-lg border border-border bg-secondary/50 px-4 py-2 text-xs font-bold tracking-wide text-muted-foreground">
              {p}
            </span>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 md:flex-row">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} LINKABET. All rights reserved. Gamble responsibly. 18+</p>
          <div className="flex items-center gap-1 rounded-full border border-border p-1">
            <Globe className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            {languages.map((l) => (
              <button key={l} onClick={() => setLang(l)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${lang === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
