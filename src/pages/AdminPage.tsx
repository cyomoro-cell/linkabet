import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Wallet, Trophy, TrendingUp, Bot, Settings, Ban, CheckCircle, XCircle, UserCog } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/supabase';

interface Stats {
  totalUsers: number;
  totalBets: number;
  totalDeposits: number;
  totalWithdrawals: number;
  pendingBets: number;
  pendingWithdrawals: number;
  aiUsage: number;
}

export default function AdminPage() {
  const { user, role, isAdmin, isMaster, isLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, totalBets: 0, totalDeposits: 0,
    totalWithdrawals: 0, pendingBets: 0, pendingWithdrawals: 0, aiUsage: 0,
  });

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (!isAdmin && !isMaster) return;
    const fetchStats = async () => {
      const [
        { count: userCount },
        { count: betCount },
        { count: pendingBetCount },
        { count: pendingWdCount },
        { data: deposits },
        { data: withdrawals },
        { count: aiCount },
      ] = await Promise.all([
        db.from('profiles').select('*', { count: 'exact', head: true }),
        db.from('bets').select('*', { count: 'exact', head: true }),
        db.from('bets').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        db.from('transactions').select('*', { count: 'exact', head: true }).eq('type', 'withdrawal').eq('status', 'pending'),
        db.from('transactions').select('amount').eq('type', 'deposit'),
        db.from('transactions').select('amount').eq('type', 'withdrawal'),
        db.from('ai_usage').select('*', { count: 'exact', head: true }),
      ]);
      setStats({
        totalUsers: userCount || 0,
        totalBets: betCount || 0,
        pendingBets: pendingBetCount || 0,
        pendingWithdrawals: pendingWdCount || 0,
        totalDeposits: (deposits as any[])?.reduce((s, d) => s + Number(d.amount), 0) || 0,
        totalWithdrawals: (withdrawals as any[])?.reduce((s, w) => s + Number(w.amount), 0) || 0,
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

  // Logged in but not allowed
  if (user && !isAdmin && !isMaster) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-12">
          <div className="max-w-xl mx-auto rounded-2xl border border-border bg-card p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Admin access required</h1>
                <p className="text-sm text-muted-foreground">Your role is <span className="capitalize font-medium">{role}</span>.</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              If this is a fresh project, the first account that signs in becomes <span className="font-medium">master</span> automatically.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <Button variant="hero" onClick={() => navigate('/account')}>Go to Account</Button>
              <Button variant="outline" onClick={() => navigate('/')}>Back to Sports</Button>
            </div>
          </div>
        </main>
        <Footer />
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Users} label="Total Users" value={stats.totalUsers} color="text-primary" />
          <StatCard icon={Trophy} label="Total Bets" value={stats.totalBets} subValue={`${stats.pendingBets} pending`} color="text-warning" />
          <StatCard icon={Wallet} label="Deposits" value={`$${stats.totalDeposits.toFixed(2)}`} color="text-success" />
          <StatCard icon={TrendingUp} label="Withdrawals" value={`$${stats.totalWithdrawals.toFixed(2)}`} subValue={`${stats.pendingWithdrawals} pending`} color="text-destructive" />
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="users"><Users className="h-4 w-4 mr-2" />Users</TabsTrigger>
            <TabsTrigger value="withdrawals"><Wallet className="h-4 w-4 mr-2" />Withdrawals</TabsTrigger>
            <TabsTrigger value="bets"><Trophy className="h-4 w-4 mr-2" />Bets</TabsTrigger>
            {isMaster && <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-2" />Settings</TabsTrigger>}
          </TabsList>

          <TabsContent value="users"><UsersTab isMaster={isMaster} /></TabsContent>
          <TabsContent value="withdrawals"><WithdrawalsTab /></TabsContent>
          <TabsContent value="bets"><BetsTab /></TabsContent>
          {isMaster && <TabsContent value="settings"><SettingsTab /></TabsContent>}
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
        <div className={`p-2 rounded-lg bg-secondary ${color}`}><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
        </div>
      </div>
    </div>
  );
}

function UsersTab({ isMaster }: { isMaster: boolean }) {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchUsers = async () => {
    const { data } = await db
      .from('profiles')
      .select('*, user_roles(role), wallets(balance)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setUsers(data);
    setIsLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleBan = async (userId: string, ban: boolean, reason?: string) => {
    const { error } = await db.from('profiles')
      .update({ is_banned: ban, ban_reason: ban ? reason || 'Banned by admin' : null })
      .eq('id', userId);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: ban ? 'User banned' : 'User unbanned' });
      fetchUsers();
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    const { error } = await db.from('user_roles')
      .update({ role: newRole })
      .eq('user_id', userId);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Role updated to ${newRole}` });
      fetchUsers();
    }
  };

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
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const role = u.user_roles?.[0]?.role || 'user';
              const banned = u.is_banned;
              return (
                <tr key={u.id} className="border-t border-border hover:bg-secondary/30">
                  <td className="p-4">
                    <p className="font-medium">{u.email}</p>
                    <p className="text-sm text-muted-foreground">{u.phone || 'No phone'}</p>
                  </td>
                  <td className="p-4">
                    {isMaster && role !== 'master' ? (
                      <Select defaultValue={role} onValueChange={(v) => handleRoleChange(u.id, v)}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className="capitalize">{role}</Badge>
                    )}
                  </td>
                  <td className="p-4 font-medium">${parseFloat(u.wallets?.[0]?.balance || 0).toFixed(2)}</td>
                  <td className="p-4">
                    {banned ? (
                      <Badge variant="destructive">Banned</Badge>
                    ) : (
                      <Badge className="bg-success/10 text-success">Active</Badge>
                    )}
                  </td>
                  <td className="p-4">
                    {role !== 'master' && (
                      <Button
                        variant={banned ? 'outline' : 'destructive'}
                        size="sm"
                        onClick={() => handleBan(u.id, !banned)}
                      >
                        {banned ? <><CheckCircle className="h-3 w-3 mr-1" />Unban</> : <><Ban className="h-3 w-3 mr-1" />Ban</>}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WithdrawalsTab() {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchWithdrawals = async () => {
    const { data } = await db
      .from('transactions')
      .select('*, profiles(email)')
      .eq('type', 'withdrawal')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setWithdrawals(data);
    setIsLoading(false);
  };

  useEffect(() => { fetchWithdrawals(); }, []);

  const handleApprove = async (tx: any) => {
    const { error } = await db.from('transactions')
      .update({ status: 'approved', approved_by: user?.id, approved_at: new Date().toISOString() })
      .eq('id', tx.id);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Withdrawal approved' });
      fetchWithdrawals();
    }
  };

  const handleReject = async (tx: any) => {
    // Refund the amount back to wallet
    const { error: txError } = await db.from('transactions')
      .update({ status: 'rejected' })
      .eq('id', tx.id);
    
    if (txError) {
      toast({ title: 'Failed', description: txError.message, variant: 'destructive' });
      return;
    }

    // Refund to wallet
    const { data: walletData } = await db.from('wallets').select('balance').eq('user_id', tx.user_id).single();
    if (walletData) {
      await db.from('wallets')
        .update({ balance: Number(walletData.balance) + Number(tx.amount) })
        .eq('user_id', tx.user_id);
    }

    toast({ title: 'Withdrawal rejected & refunded' });
    fetchWithdrawals();
  };

  if (isLoading) return <div className="animate-pulse h-32 bg-secondary rounded-lg" />;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-secondary/50">
            <tr>
              <th className="text-left p-4 font-medium">User</th>
              <th className="text-left p-4 font-medium">Amount</th>
              <th className="text-left p-4 font-medium">Fee</th>
              <th className="text-left p-4 font-medium">Net</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.map((tx) => (
              <tr key={tx.id} className="border-t border-border hover:bg-secondary/30">
                <td className="p-4 text-sm">{tx.profiles?.email || 'Unknown'}</td>
                <td className="p-4 font-medium">${Number(tx.amount).toFixed(2)}</td>
                <td className="p-4 text-muted-foreground">${Number(tx.fee || 0).toFixed(2)}</td>
                <td className="p-4 font-medium">${Number(tx.net_amount).toFixed(2)}</td>
                <td className="p-4">
                  <Badge className={
                    tx.status === 'approved' ? 'bg-success/10 text-success' :
                    tx.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                    'bg-warning/10 text-warning'
                  }>
                    {tx.status}
                  </Badge>
                </td>
                <td className="p-4">
                  {tx.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-success border-success/30" onClick={() => handleApprove(tx)}>
                        <CheckCircle className="h-3 w-3 mr-1" />Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => handleReject(tx)}>
                        <XCircle className="h-3 w-3 mr-1" />Reject
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {withdrawals.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No withdrawals yet</td></tr>
            )}
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
                  <p className="font-medium">{bet.match_data?.homeTeam?.name} vs {bet.match_data?.awayTeam?.name}</p>
                </td>
                <td className="p-4 font-medium">${Number(bet.stake).toFixed(2)}</td>
                <td className="p-4">{Number(bet.total_odds).toFixed(2)}</td>
                <td className="p-4">
                  <Badge className={
                    bet.status === 'won' ? 'bg-success/10 text-success' :
                    bet.status === 'lost' ? 'bg-destructive/10 text-destructive' :
                    'bg-warning/10 text-warning'
                  }>{bet.status}</Badge>
                </td>
              </tr>
            ))}
            {bets.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No bets yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsTab() {
  const [settings, setSettings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await db.from('system_settings').select('*').order('key');
      if (data) setSettings(data);
      setIsLoading(false);
    };
    fetch();
  }, []);

  const initDefaults = async () => {
    const defaults = [
      { key: 'betting_enabled', value: true, description: 'Allow users to place bets' },
      { key: 'deposits_enabled', value: true, description: 'Allow deposits' },
      { key: 'withdrawals_enabled', value: true, description: 'Allow withdrawals' },
      { key: 'deposit_fee_percentage', value: 5, description: 'Deposit fee percentage' },
      { key: 'withdrawal_fee_percentage', value: 5, description: 'Withdrawal fee percentage' },
      { key: 'min_bet_amount', value: 1, description: 'Minimum bet amount' },
      { key: 'max_bet_amount', value: 10000, description: 'Maximum bet amount' },
    ];

    for (const d of defaults) {
      await db.from('system_settings').upsert({
        key: d.key,
        value: d.value,
        description: d.description,
        updated_by: user?.id,
      }, { onConflict: 'key' });
    }

    const { data } = await db.from('system_settings').select('*').order('key');
    if (data) setSettings(data);
    toast({ title: 'Default settings initialized' });
  };

  const updateSetting = async (key: string, value: any) => {
    await db.from('system_settings')
      .update({ value, updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq('key', key);
    
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
    toast({ title: `${key} updated` });
  };

  if (isLoading) return <div className="animate-pulse h-32 bg-secondary rounded-lg" />;

  if (settings.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <h3 className="font-bold text-lg mb-2">System Settings</h3>
        <p className="text-muted-foreground mb-4">No settings configured yet.</p>
        <Button variant="hero" onClick={initDefaults}>Initialize Default Settings</Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <h3 className="font-bold text-lg">System Settings</h3>
      {settings.map((s) => (
        <div key={s.key} className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
          <div>
            <p className="font-medium">{s.key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
            <p className="text-sm text-muted-foreground">{s.description}</p>
          </div>
          <div>
            {typeof s.value === 'boolean' ? (
              <Button
                variant={s.value ? 'hero' : 'outline'}
                size="sm"
                onClick={() => updateSetting(s.key, !s.value)}
              >
                {s.value ? 'Enabled' : 'Disabled'}
              </Button>
            ) : (
              <Input
                type="number"
                value={s.value}
                onChange={(e) => updateSetting(s.key, Number(e.target.value))}
                className="w-24 text-right"
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
