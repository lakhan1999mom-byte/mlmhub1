import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Wallet, Users, TrendingUp, ShoppingBag, Bell, Award, ArrowUpRight, Trophy, Plus, Layers } from "lucide-react";
import HeroSlider from "@/components/HeroSlider";
import ReelsRow from "@/components/ReelsRow";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [recentTxns, setRecentTxns] = useState([]);
  const [sliderUser, setSliderUser] = useState([]);
  const [reels, setReels] = useState([]);
  const [positions, setPositions] = useState([]);
  const [reentryOpen, setReentryOpen] = useState(false);
  const [reentryCode, setReentryCode] = useState("");
  const [reentryBusy, setReentryBusy] = useState(false);

  useEffect(() => {
    api.get("/users/dashboard").then(({ data }) => setStats(data.stats)).catch(() => {});
    api.get("/mlm/leaderboard").then(({ data }) => setLeaderboard(data)).catch(() => {});
    api.get("/wallet/transactions").then(({ data }) => setRecentTxns(data.slice(0, 5))).catch(() => {});
    api.get("/sliders?location=user_dashboard").then(({ data }) => setSliderUser(data)).catch(() => {});
    api.get("/reels?location=user").then(({ data }) => setReels(data)).catch(() => {});
    api.get("/mlm/my-positions").then(({ data }) => setPositions(data.positions || [])).catch(() => {});
  }, []);

  const submitReentry = async () => {
    if (!reentryCode.trim()) return toast.error("Enter a sponsor referral code");
    setReentryBusy(true);
    try {
      const { data } = await api.post("/mlm/re-entry", { referral_code: reentryCode.trim().toUpperCase() });
      // Switch to the new position's token → user must pay ₹7,200 to activate it
      localStorage.setItem("evergro_token", data.token);
      toast.success(`New position ${data.new_position.user_code} created! Pay ₹7,200 to activate.`);
      window.location.href = "/hampers";
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Re-entry failed");
    } finally { setReentryBusy(false); }
  };

  const switchToPosition = async (userCode) => {
    // Trigger OTP-picker flow via password login is not possible without password,
    // so we call re-login by user_code via a dedicated endpoint (uses same password).
    toast.info("Log out and log back in with this account's email/password to switch.");
  };

  if (!user) return null;

  const progressPct = Math.min(((stats?.stage_progress || 0) / (stats?.stage_required || 3)) * 100, 100);
  const stageCommissions = [500, 0, 1500, 0, 5000, 0, 15000, 50000];
  const nextCommission = stageCommissions[(user.current_stage - 1)] || 0;

  return (
    <div className="space-y-6" data-testid="user-dashboard">
      <div>
        <h1 className="font-display text-3xl lg:text-4xl font-bold text-[#064E3B]">Welcome, {user.name}!</h1>
        <p className="text-[#64748B]">User Code: <span className="font-numbers font-semibold text-[#064E3B]">{user.user_code}</span></p>
      </div>

      {/* Positions & Re-Entry — only for paid members */}
      {user.is_joining_paid && (
        <div className="card-soft p-4 md:p-5 bg-gradient-to-r from-[#ECFCCB] via-white to-[#ECFCCB]" data-testid="dashboard-positions">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#84CC16] text-[#064E3B] flex items-center justify-center">
                <Layers className="w-5 h-5"/>
              </div>
              <div>
                <div className="font-display font-bold text-[#064E3B]">My MLM Positions</div>
                <div className="text-xs text-[#64748B]">You have <b data-testid="positions-count">{positions.length || 1}</b> active position{(positions.length || 1) > 1 ? "s" : ""} on this phone</div>
              </div>
            </div>
            <button
              onClick={() => setReentryOpen(true)}
              className="btn-primary text-sm"
              data-testid="open-re-entry-btn"
            >
              <Plus className="w-4 h-4"/> Start New Position
            </button>
          </div>
          {positions.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2" data-testid="positions-list">
              {positions.map((p) => (
                <div
                  key={p.id}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${p.id === user.id ? "bg-[#84CC16] text-[#064E3B] border-[#84CC16]" : "bg-white text-[#334155] border-[#E2E8F0]"}`}
                  data-testid={`position-${p.user_code}`}
                >
                  {p.user_code} {p.id === user.id && "· current"}
                  {p.is_joining_paid ? " ✓" : " · pending"}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admin-controlled slider */}
      {sliderUser.length > 0 && (
        <HeroSlider slides={sliderUser} height="h-[200px] md:h-[260px]" testid="user-dashboard-slider"/>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="Wallet Balance" value={`₹${(user.wallet_balance || 0).toLocaleString()}`} color="bg-[#84CC16]" testid="stat-wallet"/>
        <StatCard icon={TrendingUp} label="Total Earnings" value={`₹${(user.total_earnings || 0).toLocaleString()}`} color="bg-[#FBBF24]" testid="stat-earnings"/>
        <StatCard icon={Users} label="Team Size" value={user.team_size || 0} color="bg-[#064E3B] text-white" testid="stat-team"/>
        <StatCard icon={Award} label="Direct Referrals" value={user.direct_referrals_count || 0} color="bg-white border-2 border-[#84CC16]" testid="stat-direct"/>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Stage progress */}
        <div className="card-soft p-6 lg:col-span-2" data-testid="dashboard-stage-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D]">Current Stage</div>
              <div className="font-display text-3xl font-bold text-[#064E3B] mt-1">Stage {user.current_stage} of 8</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D]">Stage Commission</div>
              <div className="font-numbers text-2xl font-bold text-[#84CC16]">₹{nextCommission.toLocaleString()}</div>
            </div>
          </div>
          <div className="w-full bg-[#F1F5F9] rounded-full h-3 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#84CC16] to-[#65A30D] transition-all" style={{ width: `${progressPct}%` }}/>
          </div>
          <div className="flex justify-between text-sm text-[#334155] mt-2">
            <span><span className="font-numbers font-bold text-[#064E3B]">{stats?.stage_progress || 0}</span> / {stats?.stage_required || 3} referrals at this stage</span>
            <span className="font-numbers font-semibold text-[#65A30D]">{Math.round(progressPct)}%</span>
          </div>
          {!user.is_joining_paid && (
            <div className="mt-4 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl p-4 flex items-center justify-between">
              <div className="text-sm text-[#92400E]"><b>Activate your account:</b> Purchase a joining hamper to start your MLM journey.</div>
              <Link to="/hampers" className="btn-secondary text-xs">Buy Hamper</Link>
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="card-soft p-6 space-y-3">
          <h3 className="font-display font-bold text-lg">Quick Stats</h3>
          <Row icon={ShoppingBag} label="Orders" value={stats?.orders_count || 0}/>
          <Row icon={Bell} label="Unread Notifications" value={stats?.unread_notifications || 0}/>
          <Row icon={Wallet} label="Pending Withdrawals" value={stats?.pending_withdrawals || 0}/>
          <Row icon={Award} label="KYC Status" value={user.kyc_status} pill/>
        </div>
      </div>

      {/* Wallet breakdown */}
      <div className="grid md:grid-cols-4 gap-4">
        <WalletMini label="Commission" value={user.commission_wallet} color="text-[#65A30D]"/>
        <WalletMini label="Cashback" value={user.cashback_wallet} color="text-[#FBBF24]"/>
        <WalletMini label="Reward" value={user.reward_wallet} color="text-[#064E3B]"/>
        <WalletMini label="Income" value={user.income_wallet} color="text-[#84CC16]"/>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent transactions */}
        <div className="card-soft p-6" data-testid="dashboard-recent-txns">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg">Recent Transactions</h3>
            <Link to="/wallet" className="text-sm text-[#65A30D] font-semibold">View all</Link>
          </div>
          {recentTxns.length === 0 ? (
            <div className="text-sm text-[#64748B]">No transactions yet</div>
          ) : (
            <div className="space-y-2">
              {recentTxns.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-[#F1F5F9] last:border-0">
                  <div>
                    <div className="text-sm font-semibold text-[#064E3B] capitalize">{t.category}</div>
                    <div className="text-xs text-[#64748B]">{t.description}</div>
                  </div>
                  <div className={`font-numbers font-bold ${t.type === "credit" ? "text-[#65A30D]" : "text-[#EF4444]"}`}>
                    {t.type === "credit" ? "+" : "−"}₹{t.amount}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="card-soft p-6" data-testid="dashboard-leaderboard">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg flex items-center gap-2"><Trophy className="w-5 h-5 text-[#FBBF24]"/> Top Earners</h3>
          </div>
          <div className="space-y-2">
            {leaderboard.slice(0, 5).map((u, i) => (
              <div key={u.user_code} className="flex items-center gap-3 py-2 border-b border-[#F1F5F9] last:border-0">
                <div className={`w-7 h-7 rounded-full font-numbers font-bold flex items-center justify-center text-xs ${i === 0 ? "bg-[#FBBF24] text-[#064E3B]" : i === 1 ? "bg-[#94A3B8] text-white" : i === 2 ? "bg-[#F97316] text-white" : "bg-[#F1F5F9] text-[#334155]"}`}>{i+1}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-[#064E3B] truncate">{u.name}</div>
                  <div className="text-xs text-[#64748B]">Stage {u.stage} · Team {u.team_size}</div>
                </div>
                <div className="font-numbers font-bold text-[#064E3B] text-sm">₹{(u.total_earnings || 0).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reels for member engagement */}
      {reels.length > 0 && (
        <div className="-mx-6 lg:-mx-10">
          <ReelsRow reels={reels} title="Quick Demos & Member Stories" testid="user-dashboard-reels"/>
        </div>
      )}

      {/* Re-Entry Modal */}
      {reentryOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" data-testid="re-entry-modal">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="font-display font-bold text-xl text-[#064E3B]">Start a New MLM Position</h3>
              <p className="text-sm text-[#64748B] mt-1">Create an additional position under a DIFFERENT sponsor. You'll need to pay ₹7,200 again to activate it. All positions share your login credentials.</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-[#064E3B]">Sponsor's Referral Code</label>
              <input
                className="input-soft mt-1 uppercase font-numbers"
                value={reentryCode}
                onChange={(e) => setReentryCode(e.target.value.toUpperCase())}
                placeholder="e.g. EG000005AB"
                data-testid="re-entry-code-input"
              />
              <p className="text-[10px] text-[#64748B] mt-1">Cannot use your own referral code, or a sponsor that already has 6 direct refs, or one where you already hold a position.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setReentryOpen(false); setReentryCode(""); }}
                className="btn-outline flex-1 justify-center"
                data-testid="re-entry-cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={submitReentry}
                disabled={reentryBusy}
                className="btn-primary flex-1 justify-center disabled:opacity-60"
                data-testid="re-entry-submit-btn"
              >
                {reentryBusy ? "Creating…" : "Create Position →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, testid }) {
  return (
    <div className={`p-5 rounded-2xl ${color}`} data-testid={testid}>
      <Icon className="w-6 h-6 mb-3"/>
      <div className="text-xs uppercase tracking-widest opacity-80">{label}</div>
      <div className="font-numbers text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function Row({ icon: Icon, label, value, pill }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#F1F5F9] last:border-0">
      <div className="flex items-center gap-2 text-sm text-[#334155]"><Icon className="w-4 h-4 text-[#65A30D]"/>{label}</div>
      {pill ? (
        <span className="badge-pill bg-[#ECFCCB] text-[#065F46] capitalize">{value}</span>
      ) : (
        <div className="font-numbers font-bold text-[#064E3B]">{value}</div>
      )}
    </div>
  );
}

function WalletMini({ label, value, color }) {
  return (
    <div className="card-soft p-4">
      <div className="text-xs uppercase tracking-widest text-[#64748B]">{label}</div>
      <div className={`font-numbers text-xl font-bold mt-1 ${color}`}>₹{(value || 0).toLocaleString()}</div>
    </div>
  );
}
