import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  Gauge,
  GraduationCap,
  Info,
  LayoutDashboard,
  LineChart as LineChartIcon,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from 'recharts';
import {
  getGetStudentBehaviorQueryKey,
  getGetStudentQueryKey,
  getGetRecommendationsQueryKey,
  useExplainPrediction,
  useGetDashboardSummary,
  useGetStudent,
  useGetStudentBehavior,
  useGetRecommendations,
  useGetStudents,
  useGetWarnings,
  useHealthCheck,
  useLogin,
  usePredictPerformance,
} from '@workspace/api-client-react';
import type {
  AuthResult,
  BehaviorPoint,
  Contribution,
  DashboardSummary,
  PredictionInput,
  PredictionResult,
  Recommendation,
  StudentDetail,
  StudentSummary,
  Warning,
} from '@workspace/api-client-react';
import {
  Link,
  Route,
  Router as WouterRouter,
  Switch,
  useLocation,
  useParams,
} from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import StudentAccountPage from '@/pages/student-account';

const queryClient = new QueryClient();
const SESSION_KEY = 'learning-compass-session';

const riskStyles: Record<string, string> = {
  Low: 'bg-[#d9eee8] text-[#176453] border-[#b6ddd1]',
  Medium: 'bg-[#fff0cb] text-[#8d6318] border-[#f3d58c]',
  High: 'bg-[#f9deda] text-[#9a3934] border-[#efbcb5]',
};

const riskDot: Record<string, string> = {
  Low: 'bg-[#4b9c89]',
  Medium: 'bg-[#d8a43b]',
  High: 'bg-[#c95a51]',
};

function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" data-testid="brand-logo">
      <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar)]">
        <BookOpen size={18} strokeWidth={2.2} />
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[hsl(var(--sidebar))] bg-[hsl(var(--accent))]" />
      </div>
      {!compact && (
        <div>
          <p className="font-semibold leading-none tracking-[-.02em]">Learning Compass</p>
          <p className="mt-1 text-[10px] uppercase tracking-[.18em] text-[hsl(var(--sidebar-foreground)/.55)]">
            Academic signals
          </p>
        </div>
      )}
    </div>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${riskStyles[risk] ?? riskStyles.Low}`} data-testid={`status-risk-${risk.toLowerCase()}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${riskDot[risk] ?? riskDot.Low}`} />
      {risk}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'teal',
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Activity;
  tone?: 'teal' | 'amber' | 'blue' | 'coral';
}) {
  const toneClasses = {
    teal: 'bg-[#e1f1ed] text-[#176453]',
    amber: 'bg-[#fff1d1] text-[#8d6318]',
    blue: 'bg-[#e1eaf6] text-[#3b5f89]',
    coral: 'bg-[#f8e2de] text-[#9a3934]',
  };
  return (
    <div className="card-surface rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5" data-testid={`metric-card-${label.toLowerCase().replaceAll(' ', '-')}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-[.13em] text-muted-foreground">{label}</p>
        <div className={`grid h-9 w-9 place-items-center rounded-xl ${toneClasses[tone]}`}><Icon size={17} /></div>
      </div>
      <p className="mt-5 text-[2rem] font-semibold tracking-[-.06em] text-foreground" data-testid={`text-metric-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[hsl(var(--muted))] ${className}`} aria-label="Loading" />;
}

function LoadingPanel({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" data-testid="loading-panel">
      {Array.from({ length: rows }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}
    </div>
  );
}

function ErrorPanel({ message = 'We could not load this view.', retry }: { message?: string; retry?: () => void }) {
  return (
    <div className="card-surface flex flex-col items-center justify-center rounded-2xl px-6 py-14 text-center" data-testid="error-state">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-[#f8e2de] text-[#9a3934]"><CircleAlert size={21} /></div>
      <h3 className="mt-4 font-semibold">A small interruption</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      {retry && <button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110" onClick={retry} data-testid="button-retry"><RefreshCw size={15} /> Try again</button>}
    </div>
  );
}

function EmptyPanel({ title, detail, icon: Icon = Users }: { title: string; detail: string; icon?: typeof Users }) {
  return (
    <div className="card-surface flex flex-col items-center justify-center rounded-2xl px-6 py-14 text-center" data-testid="empty-state">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-primary"><Icon size={22} /></div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function TopBar({ title, eyebrow, onMenu }: { title: string; eyebrow: string; onMenu?: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex min-h-[76px] items-center justify-between border-b border-border/70 bg-background/95 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-8 lg:px-10">
      <div className="flex items-center gap-3">
        {onMenu && <button className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary lg:hidden" onClick={onMenu} data-testid="button-open-menu"><Menu size={19} /></button>}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">{eyebrow}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-[-.03em] text-foreground sm:text-2xl">{title}</h1>
        </div>
      </div>
      <div className="hidden items-center gap-3 sm:flex">
        <div className="hidden text-right md:block">
          <p className="text-xs font-semibold text-foreground">Tuesday, 18 June 2024</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Term 2 · Week 7</p>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-[#dce9e4] text-sm font-bold text-[#176453]" data-testid="avatar-user">AM</div>
      </div>
    </header>
  );
}

function Sidebar({ session, onLogout, open, close }: { session: AuthResult; onLogout: () => void; open: boolean; close: () => void }) {
  const [location] = useLocation();
  const teacherLinks = [
    { href: '/teacher', label: 'Overview', icon: LayoutDashboard },
    { href: '/students', label: 'Students', icon: Users },
    { href: '/behavior', label: 'Behavior trends', icon: LineChartIcon },
    { href: '/explain', label: 'Explain a prediction', icon: BrainCircuit },
    { href: '/student-accounts', label: 'Student accounts & ML', icon: ClipboardCheck },
  ];
  const studentLinks = [
    { href: '/student', label: 'My learning map', icon: LayoutDashboard },
    { href: '/behavior', label: 'My patterns', icon: LineChartIcon },
    { href: '/explain', label: 'Understand a prediction', icon: BrainCircuit },
  ];
  const links = session.role === 'teacher' ? teacherLinks : studentLinks;
  return (
    <>
      {open && <button className="fixed inset-0 z-30 bg-[hsl(var(--sidebar)/.5)] lg:hidden" onClick={close} aria-label="Close navigation" data-testid="button-close-overlay" />}
      <aside className={`sidebar-grid fixed inset-y-0 left-0 z-40 flex h-[100dvh] w-[258px] flex-col overflow-y-auto bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex items-center justify-between px-2">
          <LogoMark />
          <button className="grid h-8 w-8 place-items-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent lg:hidden" onClick={close} data-testid="button-close-menu"><X size={18} /></button>
        </div>
        <div className="mt-10 rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar">{session.displayName.slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{session.displayName}</p>
              <p className="mt-0.5 text-[11px] capitalize text-sidebar-foreground/55">{session.role} workspace</p>
            </div>
            <ChevronDown size={14} className="ml-auto text-sidebar-foreground/45" />
          </div>
        </div>
        <nav className="mt-8 space-y-1" aria-label="Main navigation">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[.2em] text-sidebar-foreground/40">Workspace</p>
          {links.map(({ href, label, icon: Icon }) => {
            const active = location === href || (href === '/students' && location.startsWith('/students/'));
            return <Link key={href} href={href} onClick={close} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? 'bg-sidebar-primary font-semibold text-sidebar' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={17} /><span>{label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar" />}</Link>;
          })}
        </nav>
        <div className="mt-auto">
          <div className="mb-4 rounded-xl border border-sidebar-border bg-sidebar-accent/35 p-3.5">
            <div className="flex items-start gap-2 text-sidebar-primary"><ShieldCheck size={16} className="mt-0.5 shrink-0" /><p className="text-xs leading-relaxed text-sidebar-foreground/70">Signals are here to start a conversation, never to define a student.</p></div>
          </div>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/60 transition hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={onLogout} data-testid="button-logout"><LogOut size={17} /> Sign out</button>
        </div>
      </aside>
    </>
  );
}

function Shell({ session, children, title, eyebrow }: { session: AuthResult; children: ReactNode; title: string; eyebrow: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  return (
    <div className="grain min-h-[100dvh] bg-background text-foreground">
      <Sidebar session={session} open={menuOpen} close={() => setMenuOpen(false)} onLogout={() => { localStorage.removeItem(SESSION_KEY); setLocation('/'); }} />
      <main className="min-w-0 lg:ml-[258px] h-[100dvh] overflow-y-auto">
        <TopBar title={title} eyebrow={eyebrow} onMenu={() => setMenuOpen(true)} />
        <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">{children}</div>
      </main>
    </div>
  );
}

function Landing() {
  const [, setLocation] = useLocation();
  const { data: health, isLoading: healthLoading } = useHealthCheck();
  return (
    <div className="grain min-h-[100dvh] overflow-hidden bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <LogoMark compact={false} />
        <Link href="/login" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary" data-testid="link-landing-login">Sign in <ArrowRight size={15} /></Link>
      </header>
      <main>
        <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[1.04fr_.96fr] lg:gap-16 lg:pb-28 lg:pt-20">
          <div className="page-enter">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#b6ddd1] bg-[#e1f1ed] px-3 py-1.5 text-xs font-semibold text-[#176453]"><Sparkles size={14} /> A clearer way to notice learning</div>
            <h1 className="max-w-2xl text-[clamp(3.3rem,7vw,6.8rem)] font-medium leading-[.92] tracking-[-.075em] text-foreground">Notice the signal.<br /><span className="display-face italic text-primary">Support the learner.</span></h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">Learning Compass turns everyday classroom patterns into calm, explainable next steps — so teachers can act earlier and students can make sense of their own progress.</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:brightness-110" onClick={() => setLocation('/login')} data-testid="button-landing-start">Open the workspace <ArrowRight size={16} /></button>
              <a href="#how-it-works" className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground transition hover:text-foreground" data-testid="link-how-it-works">How it works <ArrowRight size={15} /></a>
            </div>
            <div className="mt-12 flex items-center gap-3 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${health?.status === 'ok' ? 'bg-[#4b9c89]' : 'bg-[#d8a43b]'}`} /> {healthLoading ? 'Checking workspace connection…' : health?.status === 'ok' ? 'Workspace connected' : 'Demo workspace ready'}</div>
          </div>
          <div className="relative page-enter stagger-2">
            <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[#f4d98d]/35 blur-3xl" />
            <div className="relative rounded-[2rem] border border-[#bfd5d0] bg-[#eaf4f1] p-3 shadow-[0_24px_60px_hsl(176_42%_36%/.13)]">
              <div className="overflow-hidden rounded-[1.45rem] border border-[#c8dfda] bg-card">
                <div className="flex items-center justify-between border-b border-border/70 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Teacher overview</p><p className="mt-1 font-semibold">Good morning, Amina</p></div><div className="grid h-9 w-9 place-items-center rounded-full bg-[#dce9e4] text-xs font-bold text-[#176453]">AM</div></div>
                <div className="grid grid-cols-3 gap-2 p-4"><div className="rounded-xl bg-[#e1f1ed] p-3"><p className="text-[10px] uppercase tracking-wider text-[#176453]/75">Students</p><p className="mt-2 text-2xl font-semibold text-[#176453]">32</p></div><div className="rounded-xl bg-[#fff1d1] p-3"><p className="text-[10px] uppercase tracking-wider text-[#8d6318]/75">To notice</p><p className="mt-2 text-2xl font-semibold text-[#8d6318]">04</p></div><div className="rounded-xl bg-[#e1eaf6] p-3"><p className="text-[10px] uppercase tracking-wider text-[#3b5f89]/75">Avg. mark</p><p className="mt-2 text-2xl font-semibold text-[#3b5f89]">74%</p></div></div>
                <div className="px-4 pb-4"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold">Recent signals</p><span className="text-[10px] text-muted-foreground">This week</span></div>{[['Nora Patel', 'Attendance softened', 'Medium'], ['Ibrahim Khan', 'Quiz confidence dipped', 'Low'], ['Lena Ortiz', 'Consistent progress', 'Low']].map(([name, signal, risk]) => <div key={name} className="flex items-center gap-3 border-t border-border/60 py-3"><span className={`h-2 w-2 rounded-full ${riskDot[risk]}`} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{name}</p><p className="truncate text-[11px] text-muted-foreground">{signal}</p></div><ArrowRight size={13} className="text-muted-foreground" /></div>)}</div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-5 rounded-2xl border border-[#e9d394] bg-[#fff8e6] px-4 py-3 shadow-md"><div className="flex items-center gap-2 text-[#8d6318]"><Info size={15} /><span className="text-xs font-semibold">Every signal has a why</span></div></div>
          </div>
        </section>
        <section id="how-it-works" className="border-y border-border/70 bg-card/55">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
            <div className="max-w-xl"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">A shared language for progress</p><h2 className="display-face mt-4 text-4xl leading-tight tracking-[-.04em] sm:text-5xl">A little more context.<br />A lot less guesswork.</h2></div>
            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {[
                ['01', 'See patterns early', 'Attendance, submissions, activity, and results sit together in one readable view.'],
                ['02', 'Ask better questions', 'Warnings are prompts for a check-in, not a verdict. Filter the view to find the right starting point.'],
                ['03', 'Make the next step clear', 'Explainable predictions show which signals matter and recommendations keep the response human.'],
              ].map(([number, title, detail], index) => <div key={number} className={`page-enter stagger-${index + 1} border-t-2 border-primary pt-5`}><p className="mono-face text-xs text-primary">{number}</p><h3 className="mt-10 text-xl font-semibold tracking-[-.03em]">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p></div>)}
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24"><div className="rounded-[2rem] bg-sidebar px-7 py-12 text-sidebar-foreground sm:px-12 lg:flex lg:items-center lg:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-sidebar-primary">Start with the demo workspace</p><h2 className="display-face mt-4 max-w-xl text-4xl leading-tight tracking-[-.04em]">Bring a steadier kind of attention to your classroom.</h2></div><Link href="/login" className="mt-8 inline-flex shrink-0 items-center gap-2 rounded-xl bg-sidebar-primary px-5 py-3 text-sm font-bold text-sidebar transition hover:brightness-110 lg:mt-0" data-testid="link-landing-cta">Try the demo <ArrowRight size={16} /></Link></div></section>
      </main>
      <footer className="mx-auto flex max-w-6xl items-center justify-between border-t border-border/70 px-5 py-6 text-xs text-muted-foreground sm:px-8"><span>Learning Compass · Built for more useful conversations</span><span className="mono-face">LC / 01</span></footer>
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin: (result: AuthResult) => void }) {
  const [, setLocation] = useLocation();
  const initialRole = new URLSearchParams(window.location.search).get('role') === 'student' ? 'student' : 'teacher';
  const [role, setRole] = useState<'teacher' | 'student'>(initialRole);
  const [username, setUsername] = useState(initialRole);
  const [password, setPassword] = useState(initialRole === 'teacher' ? 'teacher123' : 'student123');
  const login = useLogin();
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    login.mutate({ data: { username, password } }, { onSuccess: (result) => { onLogin(result); setLocation(result.role === 'teacher' ? '/teacher' : '/student'); } });
  };
  const fillDemo = (nextRole: 'teacher' | 'student') => { setRole(nextRole); setUsername(nextRole); setPassword(nextRole === 'teacher' ? 'teacher123' : 'student123'); };
  return (
    <div className="grain min-h-[100dvh] bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8"><Link href="/" data-testid="link-login-brand"><LogoMark /></Link><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground" data-testid="link-login-back"><ArrowLeft size={15} /> Back home</Link></header>
      <main className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-24 lg:pt-20">
        <div className="page-enter"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Demo workspace</p><h1 className="display-face mt-5 text-5xl leading-[.98] tracking-[-.06em] sm:text-6xl">Come in,<br /><span className="text-primary">let’s look closer.</span></h1><p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">Choose a view to explore the same learning signals from a teacher’s or student’s perspective.</p><div className="mt-10 flex items-center gap-3 text-xs text-muted-foreground"><ShieldCheck size={16} className="text-primary" /> Demo data stays inside this workspace.</div></div>
        <div className="card-surface page-enter stagger-2 rounded-[1.6rem] p-6 sm:p-8"><div className="flex rounded-xl bg-secondary p-1"><button className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${role === 'teacher' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`} onClick={() => fillDemo('teacher')} data-testid="button-role-teacher">Teacher view</button><button className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${role === 'student' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`} onClick={() => fillDemo('student')} data-testid="button-role-student">Student view</button></div><form onSubmit={submit} className="mt-8 space-y-5"><div><label className="text-xs font-semibold" htmlFor="username">Username</label><input id="username" value={username} onChange={(event) => setUsername(event.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none transition focus:border-primary" data-testid="input-username" required /></div><div><div className="flex items-center justify-between"><label className="text-xs font-semibold" htmlFor="password">Password</label><span className="text-[11px] text-muted-foreground">Demo credentials</span></div><input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none transition focus:border-primary" data-testid="input-password" required /></div>{login.isError && <p className="rounded-lg bg-[#f8e2de] px-3 py-2 text-xs text-[#9a3934]" data-testid="status-login-error">That sign-in did not work. Try the demo credentials shown below.</p>}<button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60" disabled={login.isPending} data-testid="button-submit-login">{login.isPending ? 'Opening your workspace…' : 'Continue to workspace'} <ArrowRight size={16} /></button></form><div className="mt-7 border-t border-border/70 pt-5"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Use these demo credentials</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><button onClick={() => fillDemo('teacher')} className="rounded-xl border border-border px-3 py-3 text-left transition hover:border-primary" data-testid="button-fill-teacher"><span className="block text-xs font-semibold">Teacher</span><span className="mono-face mt-1 block text-[10px] text-muted-foreground">teacher / teacher123</span></button><button onClick={() => fillDemo('student')} className="rounded-xl border border-border px-3 py-3 text-left transition hover:border-primary" data-testid="button-fill-student"><span className="block text-xs font-semibold">Student</span><span className="mono-face mt-1 block text-[10px] text-muted-foreground">student / student123</span></button></div></div></div>
      </main>
    </div>
  );
}

function TeacherOverview() {
  const [, setLocation] = useLocation();
  const summaryQuery = useGetDashboardSummary();
  const studentsQuery = useGetStudents();
  const warningsQuery = useGetWarnings();
  const [riskFilter, setRiskFilter] = useState('All');
  const [search, setSearch] = useState('');
  const summary = summaryQuery.data as DashboardSummary | undefined;
  const students = studentsQuery.data as StudentSummary[] | undefined;
  const warnings = warningsQuery.data as Warning[] | undefined;
  const filteredStudents = useMemo(() => (students ?? []).filter((student) => (riskFilter === 'All' || student.riskLevel === riskFilter) && `${student.name} ${student.course}`.toLowerCase().includes(search.toLowerCase())), [students, riskFilter, search]);
  const totalRiskStudents = Math.max(summary?.totalStudents ?? 1, 1);
  const highShare = (summary?.highRisk ?? 0) / totalRiskStudents * 100;
  const mediumShare = ((summary?.highRisk ?? 0) + (summary?.mediumRisk ?? 0)) / totalRiskStudents * 100;
  if (summaryQuery.isLoading || studentsQuery.isLoading || warningsQuery.isLoading) return <div className="space-y-6 page-enter"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton className="h-36" key={i} />)}</div><Skeleton className="h-72" /><Skeleton className="h-80" /></div>;
  if (summaryQuery.isError || studentsQuery.isError || warningsQuery.isError) return <ErrorPanel message="Your class signals are taking a moment to come through." retry={() => { summaryQuery.refetch(); studentsQuery.refetch(); warningsQuery.refetch(); }} />;
  return (
    <div className="space-y-7 page-enter">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-muted-foreground">Tuesday focus</p><h2 className="display-face mt-1 text-3xl tracking-[-.04em]">A clear view of where to lean in.</h2></div><Link href="/explain" className="inline-flex w-fit items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold transition hover:border-primary hover:text-primary" data-testid="link-overview-explain"><BrainCircuit size={15} /> Explore prediction logic</Link></section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Students in view" value={summary?.totalStudents ?? 0} detail="Across your active cohort" icon={Users} tone="teal" /><MetricCard label="Need a closer look" value={summary?.highRisk ?? 0} detail={`${summary?.mediumRisk ?? 0} more are worth checking in on`} icon={CircleAlert} tone="coral" /><MetricCard label="Average attendance" value={`${summary?.averageAttendance ?? 0}%`} detail="Across the current term" icon={ClipboardCheck} tone="amber" /><MetricCard label="Average performance" value={`${summary?.averagePerformance ?? 0}%`} detail="Based on current coursework" icon={Gauge} tone="blue" /></section>
      <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <div className="card-surface rounded-2xl p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Early warnings</p><h3 className="mt-2 text-lg font-semibold tracking-[-.03em]">Signals worth a conversation</h3></div><Link href="/students" className="text-xs font-semibold text-primary hover:underline" data-testid="link-view-all-warnings">View all</Link></div><div className="mt-5 space-y-1">{(warnings ?? []).slice(0, 4).map((warning, index) => <button key={`${warning.studentId}-${index}`} className="group flex w-full items-center gap-3 rounded-xl border-b border-border/60 px-2 py-3 text-left transition last:border-0 hover:bg-secondary/60" onClick={() => setLocation(`/students/${warning.studentId}`)} data-testid={`button-warning-${warning.studentId}`}><span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${riskDot[warning.riskLevel]}`} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{warning.studentName}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{warning.message}</span></span><span className="hidden text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:block">{warning.indicator}</span><ArrowRight size={15} className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" /></button>)}{!(warnings ?? []).length && <EmptyPanel title="No early warnings" detail="Your current class view is quiet. Keep noticing the small wins." icon={CheckCircle2} />}</div></div>
         <div className="card-surface rounded-2xl p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Class balance</p><h3 className="mt-2 text-lg font-semibold tracking-[-.03em]">Risk distribution</h3></div><Activity size={18} className="text-muted-foreground" /></div><div className="mt-7 flex items-center gap-7"><div className="relative grid h-32 w-32 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#c95a51 0 ${highShare}%, #d8a43b ${highShare}% ${mediumShare}%, #4b9c89 ${mediumShare}% 100%)` }}><div className="grid h-24 w-24 place-items-center rounded-full bg-card"><span className="text-2xl font-semibold">{summary?.totalStudents ?? 0}</span></div></div><div className="flex-1 space-y-3">{[['High', summary?.highRisk ?? 0], ['Medium', summary?.mediumRisk ?? 0], ['Low', summary?.lowRisk ?? 0]].map(([label, value]) => <div className="flex items-center justify-between text-sm" key={label as string}><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${riskDot[label as string]}`} />{label}</span><span className="font-semibold">{value as number}</span></div>)}</div></div><p className="mt-7 border-t border-border/60 pt-4 text-xs leading-5 text-muted-foreground">The shape of the class matters more than any single number. Use this as a starting point.</p></div>
      </section>
      <section className="card-surface rounded-2xl p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Your students</p><h3 className="mt-2 text-lg font-semibold tracking-[-.03em]">Find a learner to understand</h3></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or course" className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-xs outline-none focus:border-primary sm:w-52" data-testid="input-search-students" /></div><select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold outline-none focus:border-primary" data-testid="select-risk-filter"><option>All</option><option>High</option><option>Medium</option><option>Low</option></select></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="border-b border-border/70 text-[10px] uppercase tracking-[.15em] text-muted-foreground"><th className="pb-3 pl-2 font-semibold">Student</th><th className="pb-3 font-semibold">Course</th><th className="pb-3 font-semibold">Attendance</th><th className="pb-3 font-semibold">Performance</th><th className="pb-3 font-semibold">Signal</th><th /></tr></thead><tbody>{filteredStudents.map((student) => <tr key={student.studentId} className="group border-b border-border/50 transition hover:bg-secondary/40" data-testid={`row-student-${student.studentId}`}><td className="py-3.5 pl-2"><div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-full bg-[#dce9e4] text-[10px] font-bold text-[#176453]">{student.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div><p className="text-sm font-semibold">{student.name}</p><p className="text-[11px] text-muted-foreground">{student.email ?? 'Student profile'}</p></div></div></td><td className="py-3.5 text-xs text-muted-foreground">{student.course} · Year {student.year}</td><td className="py-3.5 text-sm font-semibold">{student.attendance}%</td><td className="py-3.5 text-sm font-semibold">{Math.round((student.assignmentScore + student.quizScore + student.examScore) / 3)}%</td><td className="py-3.5"><RiskBadge risk={student.riskLevel} /></td><td className="py-3.5 text-right"><Link href={`/students/${student.studentId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-70 transition group-hover:opacity-100" data-testid={`link-student-${student.studentId}`}>Open <ArrowRight size={13} /></Link></td></tr>)}</tbody></table>{!filteredStudents.length && <div className="py-12"><EmptyPanel title="No students match that view" detail="Try a different name or risk level." /></div>}</div></section>
    </div>
  );
}

function MiniStat({ label, value, tone = 'teal' }: { label: string; value: string | number; tone?: 'teal' | 'amber' | 'coral' }) {
  return <div className={`rounded-xl p-4 ${tone === 'teal' ? 'bg-[#e1f1ed]' : tone === 'amber' ? 'bg-[#fff1d1]' : 'bg-[#f8e2de]'}`}><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tracking-[-.05em]">{value}</p></div>;
}

function StudentOverview({ session }: { session: AuthResult }) {
  const studentId = session.studentId ?? '';
  const studentQuery = useGetStudent(studentId, { query: { enabled: Boolean(studentId), queryKey: getGetStudentQueryKey(studentId) } });
  const behaviorQuery = useGetStudentBehavior(studentId, { query: { enabled: Boolean(studentId), queryKey: getGetStudentBehaviorQueryKey(studentId) } });
  const recsQuery = useGetRecommendations(studentId, { query: { enabled: Boolean(studentId), queryKey: getGetRecommendationsQueryKey(studentId) } });
  const student = studentQuery.data as StudentDetail | undefined;
  const behavior = behaviorQuery.data as BehaviorPoint[] | undefined;
  const recommendations = recsQuery.data as Recommendation[] | undefined;
  if (!studentId) return <EmptyPanel title="Your learner profile is not connected" detail="Please sign in again with the student demo account." icon={UserRound} />;
  if (studentQuery.isLoading || behaviorQuery.isLoading || recsQuery.isLoading) return <div className="space-y-5 page-enter"><Skeleton className="h-40" /><div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div><Skeleton className="h-80" /></div>;
  if (studentQuery.isError || behaviorQuery.isError || recsQuery.isError) return <ErrorPanel message="Your learning map is temporarily unavailable." retry={() => { studentQuery.refetch(); behaviorQuery.refetch(); recsQuery.refetch(); }} />;
  const latest = behavior?.at(-1);
  return <div className="space-y-7 page-enter"><section className="rounded-2xl bg-sidebar px-6 py-7 text-sidebar-foreground sm:px-8 sm:py-8"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-sidebar-primary">Your learning map</p><div className="mt-3 flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><h2 className="display-face text-4xl tracking-[-.05em]">Hi, {student?.name.split(' ')[0]}.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-sidebar-foreground/65">This is a reflection of your recent learning habits — a place to notice what helps you learn, not a scorecard.</p></div><div className="rounded-xl bg-sidebar-accent px-4 py-3"><p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/55">Current outlook</p><p className="mt-1 font-semibold text-sidebar-primary">{student?.prediction}</p></div></div></section><section className="grid gap-4 sm:grid-cols-3"><MiniStat label="Attendance" value={`${student?.attendance}%`} /><MiniStat label="Recent quiz" value={`${student?.quizScore}%`} tone="amber" /><MiniStat label="Study activity" value={`${student?.learningActivity}%`} /></section><section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><div className="card-surface rounded-2xl p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Recent rhythm</p><h3 className="mt-2 text-lg font-semibold">What your last few weeks show</h3></div><Link href="/behavior" className="text-xs font-semibold text-primary hover:underline" data-testid="link-student-behavior">View patterns</Link></div><div className="mt-6 h-[235px] w-full"><BehaviorChart data={behavior ?? []} /></div><div className="mt-4 flex flex-wrap gap-4 text-[11px] text-muted-foreground"><ChartKey color="#2f8178" label="Attendance" /><ChartKey color="#d8a43b" label="Assignments" /><ChartKey color="#5276a2" label="Learning activity" /></div><p className="mt-5 border-t border-border/60 pt-4 text-xs leading-5 text-muted-foreground">The latest week shows {latest?.learning ?? 0}% learning activity. Small routines compound — notice what made that week feel possible.</p></div><div className="card-surface rounded-2xl p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Try next</p><h3 className="mt-2 text-lg font-semibold">A few useful nudges</h3></div><Target size={18} className="text-primary" /></div><div className="mt-5 space-y-3">{(recommendations ?? student?.recommendations ?? []).slice(0, 3).map((recommendation, index) => <div key={`${recommendation.title}-${index}`} className="rounded-xl border border-border/70 p-3.5 transition hover:border-primary/50"><div className="flex gap-3"><div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${recommendation.tone === 'focus' ? 'bg-[#d8a43b]' : recommendation.tone === 'positive' ? 'bg-[#4b9c89]' : 'bg-[#5276a2]'}`} /><div><p className="text-sm font-semibold">{recommendation.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{recommendation.detail}</p></div></div></div>)}{!(recommendations ?? student?.recommendations ?? []).length && <EmptyPanel title="No nudges yet" detail="Keep building your rhythm and we’ll reflect it here." icon={Sparkles} />}</div></div></section></div>;
}

function ChartKey({ color, label }: { color: string; label: string }) { return <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>; }

function BehaviorChart({ data }: { data: BehaviorPoint[] }) {
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 10, left: -22, bottom: 0 }}><CartesianGrid stroke="hsl(var(--border) / .7)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="week" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ border: '1px solid hsl(var(--border))', borderRadius: 12, background: 'hsl(var(--card))', fontSize: 11 }} /><Line type="monotone" dataKey="attendance" stroke="#2f8178" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="assignment" stroke="#d8a43b" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="learning" stroke="#5276a2" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>;
}

function StudentsPage() {
  const studentsQuery = useGetStudents();
  const [riskFilter, setRiskFilter] = useState('All');
  const [search, setSearch] = useState('');
  const students = studentsQuery.data as StudentSummary[] | undefined;
  const filteredStudents = useMemo(() => (students ?? []).filter((student) => (riskFilter === 'All' || student.riskLevel === riskFilter) && `${student.name} ${student.course}`.toLowerCase().includes(search.toLowerCase())), [students, riskFilter, search]);
  if (studentsQuery.isLoading) return <div className="space-y-6 page-enter"><Skeleton className="h-80" /></div>;
  if (studentsQuery.isError) return <ErrorPanel message="Your student list is taking a moment to come through." retry={() => studentsQuery.refetch()} />;
  return (
    <div className="space-y-7 page-enter">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted-foreground">Classroom roster</p>
          <h2 className="display-face mt-1 text-3xl tracking-[-.04em]">Your students</h2>
        </div>
      </section>
      <section className="card-surface rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Your students</p>
            <h3 className="mt-2 text-lg font-semibold tracking-[-.03em]">Find a learner to understand</h3>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or course" className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-xs outline-none focus:border-primary sm:w-52" data-testid="input-search-students" />
            </div>
            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold outline-none focus:border-primary" data-testid="select-risk-filter">
              <option>All</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead>
              <tr className="border-b border-border/70 text-[10px] uppercase tracking-[.15em] text-muted-foreground">
                <th className="pb-3 pl-2 font-semibold">Student</th>
                <th className="pb-3 font-semibold">Course</th>
                <th className="pb-3 font-semibold">Attendance</th>
                <th className="pb-3 font-semibold">Performance</th>
                <th className="pb-3 font-semibold">Signal</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.studentId} className="group border-b border-border/50 transition hover:bg-secondary/40" data-testid={`row-student-${student.studentId}`}>
                  <td className="py-3.5 pl-2">
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-[#dce9e4] text-[10px] font-bold text-[#176453]">{student.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>
                      <div>
                        <p className="text-sm font-semibold">{student.name}</p>
                        <p className="text-[11px] text-muted-foreground">{student.email ?? 'Student profile'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 text-xs text-muted-foreground">{student.course} · Year {student.year}</td>
                  <td className="py-3.5 text-sm font-semibold">{student.attendance}%</td>
                  <td className="py-3.5 text-sm font-semibold">{Math.round((student.assignmentScore + student.quizScore + student.examScore) / 3)}%</td>
                  <td className="py-3.5"><RiskBadge risk={student.riskLevel} /></td>
                  <td className="py-3.5 text-right">
                    <Link href={`/students/${student.studentId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-70 transition group-hover:opacity-100" data-testid={`link-student-${student.studentId}`}>Open <ArrowRight size={13} /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredStudents.length && <div className="py-12"><EmptyPanel title="No students match that view" detail="Try a different name or risk level." /></div>}
        </div>
      </section>
    </div>
  );
}

function StudentDetailPage() {
  const { studentId = '' } = useParams<{ studentId: string }>();
  const [, setLocation] = useLocation();
  const isDemoPlaceholder = studentId === 'demo';
  useEffect(() => {
    if (isDemoPlaceholder) setLocation('/students');
  }, [isDemoPlaceholder, setLocation]);
  const studentQuery = useGetStudent(studentId, { query: { enabled: Boolean(studentId) && !isDemoPlaceholder, queryKey: getGetStudentQueryKey(studentId) } });
  const behaviorQuery = useGetStudentBehavior(studentId, { query: { enabled: Boolean(studentId) && !isDemoPlaceholder, queryKey: getGetStudentBehaviorQueryKey(studentId) } });
  const recsQuery = useGetRecommendations(studentId, { query: { enabled: Boolean(studentId) && !isDemoPlaceholder, queryKey: getGetRecommendationsQueryKey(studentId) } });
  const student = studentQuery.data as StudentDetail | undefined;
  const behavior = behaviorQuery.data as BehaviorPoint[] | undefined;
  const recommendations = recsQuery.data as Recommendation[] | undefined;
  if (isDemoPlaceholder) return null;
  if (studentQuery.isLoading || behaviorQuery.isLoading || recsQuery.isLoading) return <div className="space-y-5"><Skeleton className="h-44" /><Skeleton className="h-80" /></div>;
  if (studentQuery.isError || !student) return <ErrorPanel message="We couldn’t find that student profile." retry={() => studentQuery.refetch()} />;
  return <div className="space-y-7 page-enter"><button onClick={() => setLocation('/teacher')} className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground" data-testid="button-back-teacher"><ArrowLeft size={14} /> Back to overview</button><section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div className="flex items-center gap-4"><div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#dce9e4] text-lg font-bold text-[#176453]">{student.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Student profile</p><h2 className="mt-1 text-3xl font-semibold tracking-[-.05em]">{student.name}</h2><p className="mt-1 text-sm text-muted-foreground">{student.course} · Year {student.year} {student.email ? `· ${student.email}` : ''}</p></div></div><div className="flex items-center gap-3"><RiskBadge risk={student.riskLevel} /><Link href="/explain" className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-xs font-bold text-primary-foreground transition hover:brightness-110" data-testid="link-detail-explain"><BrainCircuit size={14} /> Explain outlook</Link></div></section><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><MiniStat label="Attendance" value={`${student.attendance}%`} /><MiniStat label="Assignments" value={`${student.assignmentScore}%`} tone="amber" /><MiniStat label="Quizzes" value={`${student.quizScore}%`} /><MiniStat label="Exams" value={`${student.examScore}%`} tone="coral" /><MiniStat label="Activity" value={`${student.learningActivity}%`} /></section><section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><div className="card-surface rounded-2xl p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Behavior over time</p><h3 className="mt-2 text-lg font-semibold">The shape of their learning rhythm</h3></div><Link href="/behavior" className="text-xs font-semibold text-primary hover:underline" data-testid="link-detail-behavior">Open trends</Link></div><div className="mt-6 h-[260px]"><BehaviorChart data={behavior ?? student.behavior ?? []} /></div><div className="mt-4 flex flex-wrap gap-4 text-[11px] text-muted-foreground"><ChartKey color="#2f8178" label="Attendance" /><ChartKey color="#d8a43b" label="Assignments" /><ChartKey color="#5276a2" label="Learning activity" /></div></div><div className="card-surface rounded-2xl p-5 sm:p-6"><div className="flex items-center gap-2"><Sparkles size={17} className="text-primary" /><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Conversation starters</p><h3 className="mt-2 text-lg font-semibold">Helpful next steps</h3></div></div><div className="mt-5 space-y-3">{(recommendations ?? student.recommendations ?? []).map((recommendation, index) => <div className="border-b border-border/60 pb-3 last:border-0 last:pb-0" key={`${recommendation.title}-${index}`}><p className="text-sm font-semibold">{recommendation.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{recommendation.detail}</p></div>)}</div></div></section><section className="card-surface rounded-2xl p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Why this outlook</p><h3 className="mt-2 text-lg font-semibold">{student.prediction}</h3></div><Link href="/explain" className="text-xs font-semibold text-primary hover:underline" data-testid="link-detail-contributions">See explanation</Link></div><ContributionList contributions={student.contributions ?? []} /></section></div>;
}

function ContributionList({ contributions }: { contributions: Contribution[] }) {
  return <div className="mt-5 grid gap-3 sm:grid-cols-2">{contributions.map((contribution, index) => <div key={`${contribution.feature}-${index}`} className="flex items-center gap-3 rounded-xl border border-border/70 p-3"><div className={`grid h-8 w-8 place-items-center rounded-lg ${contribution.direction === 'positive' ? 'bg-[#e1f1ed] text-[#176453]' : 'bg-[#f8e2de] text-[#9a3934]'}`}>{contribution.direction === 'positive' ? <ArrowRight size={14} className="-rotate-45" /> : <ArrowRight size={14} className="rotate-45" />}</div><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{contribution.feature}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{contribution.direction === 'positive' ? 'Supporting the outlook' : 'Worth a closer look'}</p></div><span className={`mono-face text-xs font-bold ${contribution.direction === 'positive' ? 'text-[#176453]' : 'text-[#9a3934]'}`}>{contribution.direction === 'positive' ? '+' : '−'}{Math.abs(contribution.value).toFixed(1)}</span></div>)}</div>;
}

function BehaviorPage({ session }: { session: AuthResult }) {
  const studentsQuery = useGetStudents();
  const students = (studentsQuery.data as StudentSummary[] | undefined) ?? [];
  const initial = session.role === 'student' ? session.studentId ?? students[0]?.studentId ?? '' : students[0]?.studentId ?? '';
  const [selected, setSelected] = useState(initial);
  const behaviorQuery = useGetStudentBehavior(selected, { query: { enabled: Boolean(selected), queryKey: getGetStudentBehaviorQueryKey(selected) } });
  const current = students.find((student) => student.studentId === selected);
  const behavior = behaviorQuery.data as BehaviorPoint[] | undefined;
  return <div className="space-y-7 page-enter"><section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-muted-foreground">Patterns, not pressure</p><h2 className="display-face mt-1 text-3xl tracking-[-.04em]">{session.role === 'student' ? 'Your learning rhythm' : 'Behavior trends'}</h2></div>{session.role === 'teacher' && <select value={selected} onChange={(event) => setSelected(event.target.value)} className="h-10 rounded-xl border border-input bg-card px-3 text-xs font-semibold outline-none focus:border-primary" data-testid="select-behavior-student"><option value="">Choose a student</option>{students.map((student) => <option key={student.studentId} value={student.studentId}>{student.name}</option>)}</select>}</section>{!selected ? <EmptyPanel title="Choose a learner to begin" detail="Select a student and their recent behavior will appear here." icon={LineChartIcon} /> : behaviorQuery.isLoading ? <div className="space-y-5"><Skeleton className="h-96" /><Skeleton className="h-44" /></div> : behaviorQuery.isError ? <ErrorPanel message="Behavior observations are unavailable right now." retry={() => behaviorQuery.refetch()} /> : <><section className="card-surface rounded-2xl p-5 sm:p-7"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Six-week view</p><h3 className="mt-2 text-xl font-semibold">{session.role === 'student' ? 'A closer look at your habits' : `${current?.name ?? 'Student'}’s recent rhythm`}</h3><p className="mt-1 text-sm text-muted-foreground">Each line is one piece of the learning picture.</p></div><div className="rounded-xl bg-secondary px-3 py-2 text-right"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Observations</p><p className="mono-face mt-1 text-sm font-bold">{behavior?.length ?? 0} weeks</p></div></div><div className="mt-7 h-[330px]"><BehaviorChart data={behavior ?? []} /></div><div className="mt-4 flex flex-wrap gap-5 text-[11px] text-muted-foreground"><ChartKey color="#2f8178" label="Attendance" /><ChartKey color="#d8a43b" label="Assignments" /><ChartKey color="#5276a2" label="Learning activity" /></div></section><section className="grid gap-4 sm:grid-cols-3"><MiniStat label="Latest attendance" value={`${behavior?.at(-1)?.attendance ?? 0}%`} /><MiniStat label="Latest assignment" value={`${behavior?.at(-1)?.assignment ?? 0}%`} tone="amber" /><MiniStat label="Latest activity" value={`${behavior?.at(-1)?.learning ?? 0}%`} /></section></>}</div>;
}

function ExplainPage() {
  const predict = usePredictPerformance();
  const explain = useExplainPrediction();
  const [values, setValues] = useState<PredictionInput>({ attendance: 82, assignmentScore: 76, quizScore: 71, examScore: 74, learningActivity: 68, submissionConsistency: 79 });
  const result = predict.data as PredictionResult | undefined;
  const update = (key: keyof PredictionInput, value: string) => setValues((current) => ({ ...current, [key]: Number(value) }));
  const runPrediction = () => predict.mutate({ data: values });
  const runExplanation = () => explain.mutate({ data: values });
  const confidencePercent = result ? Math.round(result.confidence > 1 ? result.confidence : result.confidence * 100) : 0;
  return <div className="space-y-7 page-enter"><section><p className="text-sm text-muted-foreground">A transparent sandbox</p><h2 className="display-face mt-1 text-3xl tracking-[-.04em]">Explain a prediction</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Adjust the learning signals, run a prediction, then ask what shaped it. The point is not to make the future certain — it is to make the next conversation more informed.</p></section><section className="grid gap-5 xl:grid-cols-[.86fr_1.14fr]"><div className="card-surface rounded-2xl p-5 sm:p-6"><div className="flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#e1f1ed] text-primary"><SlidersIcon /></div><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Input signals</p><h3 className="mt-1 font-semibold">What are we noticing?</h3></div></div><div className="mt-6 space-y-5">{[['attendance', 'Attendance'], ['assignmentScore', 'Assignment score'], ['quizScore', 'Quiz score'], ['examScore', 'Exam score'], ['learningActivity', 'Learning activity'], ['submissionConsistency', 'Submission consistency']].map(([key, label]) => <label key={key} className="block"><div className="flex items-center justify-between text-xs font-semibold"><span>{label}</span><span className="mono-face text-primary">{values[key as keyof PredictionInput]}%</span></div><input type="range" min="0" max="100" value={values[key as keyof PredictionInput] ?? 0} onChange={(event) => update(key as keyof PredictionInput, event.target.value)} className="mt-3 h-1.5 w-full cursor-pointer accent-[hsl(var(--primary))]" data-testid={`input-signal-${key}`} /></label>)}</div><button onClick={runPrediction} disabled={predict.isPending} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-60" data-testid="button-run-prediction">{predict.isPending ? 'Reading the signals…' : 'Run prediction'} <ArrowRight size={15} /></button></div><div className="card-surface rounded-2xl p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Prediction readout</p><h3 className="mt-1 font-semibold">A result with room for context</h3></div><BrainCircuit size={19} className="text-primary" /></div>{result ? <div className="mt-6"><div className="rounded-2xl bg-sidebar p-5 text-sidebar-foreground"><p className="text-[10px] uppercase tracking-[.18em] text-sidebar-foreground/55">Current outlook</p><div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><p className="display-face text-4xl tracking-[-.04em] text-sidebar-primary">{result.prediction}</p><div className="text-left sm:text-right"><p className="mono-face text-2xl font-bold">{confidencePercent}%</p><p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/55">confidence</p></div></div><div className="mt-5 flex items-center justify-between border-t border-sidebar-border pt-3 text-xs text-sidebar-foreground/65"><span>Risk level</span><span className="font-semibold text-sidebar-primary">{result.riskLevel}</span></div></div><button onClick={runExplanation} disabled={explain.isPending} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-background px-4 py-3 text-sm font-bold text-primary transition hover:bg-secondary disabled:opacity-60" data-testid="button-run-explanation">{explain.isPending ? 'Finding the why…' : 'Explain this result'} <Info size={15} /></button>{explain.isError && <p className="mt-3 text-xs text-[#9a3934]" data-testid="status-explanation-error">The explanation could not be generated. Try again.</p>}{explain.data && <div className="mt-6"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">What shaped it</p><ContributionList contributions={explain.data.contributions ?? []} /></div>}</div> : <div className="flex min-h-[380px] flex-col items-center justify-center text-center"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary"><Gauge size={25} /></div><h4 className="mt-5 text-lg font-semibold">Set the signals, then begin</h4><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">A prediction is most useful when you can see what contributed to it. Run one to make the explanation available.</p></div>}</div></section></div>;
}

function SlidersIcon() { return <Activity size={16} />; }

function Protected({ session, role, children, title, eyebrow }: { session: AuthResult | null; role?: 'teacher' | 'student'; children: ReactNode; title: string; eyebrow: string }) {
  const [, setLocation] = useLocation();
  if (!session) { setLocation('/login'); return null; }
  if (role && session.role !== role) { setLocation(session.role === 'teacher' ? '/teacher' : '/student'); return null; }
  return <Shell session={session} title={title} eyebrow={eyebrow}>{children}</Shell>;
}

function NotFound() {
  return <div className="grid min-h-[100dvh] place-items-center bg-background px-6 text-center"><div><p className="mono-face text-sm text-primary">404 / not found</p><h1 className="display-face mt-4 text-5xl tracking-[-.05em]">This page wandered off.</h1><p className="mt-4 text-sm text-muted-foreground">Let’s get you back to a useful view.</p><Link href="/" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground" data-testid="link-not-found-home">Return home <ArrowRight size={15} /></Link></div></div>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router({ session, onLogin }: { session: AuthResult | null; onLogin: (result: AuthResult) => void }) {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Landing} /><Route path="/login"><LoginPage onLogin={onLogin} /></Route><Route path="/teacher"><Protected session={session} role="teacher" title="Teacher overview" eyebrow="Classroom / Overview"><TeacherOverview /></Protected></Route><Route path="/student"><Protected session={session} role="student" title="My learning map" eyebrow="My workspace / Reflection"><StudentOverview session={session as AuthResult} /></Protected></Route><Route path="/students"><Protected session={session} role="teacher" title="Students" eyebrow="Classroom / Roster"><StudentsPage /></Protected></Route><Route path="/students/:studentId"><Protected session={session} role="teacher" title="Student detail" eyebrow="Classroom / Student profile"><StudentDetailPage /></Protected></Route><Route path="/behavior"><Protected session={session} title="Behavior trends" eyebrow="Signals / Over time"><BehaviorPage session={session as AuthResult} /></Protected></Route><Route path="/explain"><Protected session={session} title="Explain a prediction" eyebrow="Signals / Explainability"><ExplainPage /></Protected></Route><Route path="/student-accounts"><Protected session={session} role="teacher" title="Student accounts & ML" eyebrow="Teacher tools / Supabase"><StudentAccountPage /></Protected></Route><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function App() {
  const [session, setSession] = useState<AuthResult | null>(() => {
    try { const raw = localStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) as AuthResult : null; } catch { return null; }
  });
  const handleLogin = (result: AuthResult) => { localStorage.setItem(SESSION_KEY, JSON.stringify(result)); setSession(result); };
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router session={session} onLogin={handleLogin} /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;