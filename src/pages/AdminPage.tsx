import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Wallet, Trophy, TrendingUp, Bot, Settings } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/supabase';

interface Stats {
  totalUsers: number;
  totalBets: number;
  totalDeposits: number;
  totalWithdrawals: number;
  pendingBets: number;
  aiUsage: number;
}

export default function AdminPage() {
  const { user, isAdmin, isMaster, isLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalBets: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    pendingBets: 0,
    aiUsage: 0,
  });

  useEffect(() => {
    if (!isLoading && (!user || (!isAdmin && !isMaster))) {
      navigate('/');
    }
  }, [user, isAdmin, isMaster, isLoading, navigate]);

  useEffect(() => {
    if (!isAdmin && !isMaster) return;

    const fetchStats = async () => {
      // Fetch user count
      const { count: userCount } = await db
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch bet stats
      const { count: betCount } = await db
        .from('bets')
        .select('*', { count: 'exact', head: true });

      const { count: pendingCount } = await db
        .from('bets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Fetch transaction stats
      const { data: deposits } = await db
        .from('transactions')
        .select('amount')
        .eq('type', 'deposit');

      const { data: withdrawals } = await db
        .from('transactions')
        .select('amount')
        .eq('type', 'withdrawal');

      const { count: aiCount } = await db
        .from('ai_usage')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalUsers: userCount || 0,
        totalBets: betCount || 0,
        pendingBets: pendingCount || 0,
        totalDeposits: (deposits as any[])?.reduce((sum, d) => sum + Number(d.amount), 0) || 0,
        totalWithdrawals: (withdrawals as any[])?.reduce((sum, w) => sum + Number(w.amount), 0) || 0,
        aiUsage: aiCount || 0,
      });
    };

    fetchStats();
  }, [isAdmin, isMaster]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              {isMaster ? 'Master Control Panel' : 'Admin Control Panel'}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Users}
            label="Total Users"
            value={stats.totalUsers}
            color="text-primary"
          />
          <StatCard
            icon={Trophy}
            label="Total Bets"
            value={stats.totalBets}
            subValue={`${stats.pendingBets} pending`}
            color="text-warning"
          />
          <StatCard
            icon={Wallet}
            label="Total Deposits"
            value={`$${stats.totalDeposits.toFixed(2)}`}
            color="text-success"
          />
          <StatCard
            icon={TrendingUp}
            label="Total Withdrawals"
            value={`$${stats.totalWithdrawals.toFixed(2)}`}
            color="text-destructive"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="bets">
              <Trophy className="h-4 w-4 mr-2" />
              Bets
            </TabsTrigger>
            <TabsTrigger value="ai">
              <Bot className="h-4 w-4 mr-2" />
              AI Usage
            </TabsTrigger>
            {isMaster && (
              <TabsTrigger value="settings">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <UsersTab />
          </TabsContent>

          <TabsContent value="bets" className="space-y-4">
            <BetsTab />
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <AIUsageTab />
          </TabsContent>

          {isMaster && (
            <TabsContent value="settings" className="space-y-4">
              <SettingsTab />
            </TabsContent>
          )}
        </Tabs>
      </main>

      <Footer />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, subValue, color }: { icon: any; label: string; value: string | number; subValue?: string; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-secondary ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
        </div>
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await db
        .from('profiles')
        .select('*, user_roles(role), wallets(balance)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) setUsers(data);
      setIsLoading(false);
    };
    fetchUsers();
  }, []);

  if (isLoading) return <div className="animate-pulse h-32 bg-secondary rounded-lg" />;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-secondary/50">
            <tr>
              <th className="text-left p-4 font-medium">User</th>
              <th className="text-left p-4 font-medium">Role</th>
              <th className="text-left p-4 font-medium">Balance</th>
              <th className="text-left p-4 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-border hover:bg-secondary/30">
                <td className="p-4">
                  <p className="font-medium">{user.email}</p>
                  <p className="text-sm text-muted-foreground">{user.phone}</p>
                </td>
                <td className="p-4">
                  <span className="capitalize px-2 py-1 rounded bg-primary/10 text-primary text-sm">
                    {user.user_roles?.[0]?.role || 'user'}
                  </span>
                </td>
                <td className="p-4 font-medium">
                  ${parseFloat(user.wallets?.[0]?.balance || 0).toFixed(2)}
                </td>
                <td className="p-4 text-muted-foreground">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BetsTab() {
  const [bets, setBets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBets = async () => {
      const { data } = await db
        .from('bets')
        .select('*, profiles(email)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) setBets(data);
      setIsLoading(false);
    };
    fetchBets();
  }, []);

  if (isLoading) return <div className="animate-pulse h-32 bg-secondary rounded-lg" />;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-secondary/50">
            <tr>
              <th className="text-left p-4 font-medium">User</th>
              <th className="text-left p-4 font-medium">Match</th>
              <th className="text-left p-4 font-medium">Stake</th>
              <th className="text-left p-4 font-medium">Odds</th>
              <th className="text-left p-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {bets.map((bet) => (
              <tr key={bet.id} className="border-t border-border hover:bg-secondary/30">
                <td className="p-4 text-sm">{bet.profiles?.email}</td>
                <td className="p-4">
                  <p className="font-medium">
                    {bet.match_data?.homeTeam?.name} vs {bet.match_data?.awayTeam?.name}
                  </p>
                </td>
                <td className="p-4 font-medium">${bet.stake.toFixed(2)}</td>
                <td className="p-4">{bet.total_odds.toFixed(2)}</td>
                <td className="p-4">
                  <span className={`capitalize px-2 py-1 rounded text-sm ${
                    bet.status === 'won' ? 'bg-success/10 text-success' :
                    bet.status === 'lost' ? 'bg-destructive/10 text-destructive' :
                    'bg-warning/10 text-warning'
                  }`}>
                    {bet.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AIUsageTab() {
  const [usage, setUsage] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      const { data } = await db
        .from('ai_usage')
        .select('*, profiles(email)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) setUsage(data);
      setIsLoading(false);
    };
    fetchUsage();
  }, []);

  if (isLoading) return <div className="animate-pulse h-32 bg-secondary rounded-lg" />;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-secondary/50">
            <tr>
              <th className="text-left p-4 font-medium">User</th>
              <th className="text-left p-4 font-medium">Prompt</th>
              <th className="text-left p-4 font-medium">Tokens</th>
              <th className="text-left p-4 font-medium">Fee</th>
              <th className="text-left p-4 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {usage.map((item) => (
              <tr key={item.id} className="border-t border-border hover:bg-secondary/30">
                <td className="p-4 text-sm">{item.profiles?.email}</td>
                <td className="p-4">
                  <p className="truncate max-w-xs">{item.prompt}</p>
                </td>
                <td className="p-4">{item.tokens_used}</td>
                <td className="p-4 font-medium text-primary">${item.fee_charged.toFixed(2)}</td>
                <td className="p-4 text-muted-foreground">
                  {new Date(item.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="font-bold text-lg mb-4">Master Settings</h3>
      <p className="text-muted-foreground">
        Master-level settings and configuration options will appear here.
      </p>
    </div>
  );
}
