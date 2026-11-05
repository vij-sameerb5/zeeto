import { LogIn, Shield, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRole, useSession } from '../lib/auth';

/** Rail / header button: Sign in, or who you are. */
export function AccountButton({ compact }: { compact?: boolean }) {
  const s = useSession();
  const role = useRole();
  if (!s.ready) return <span className="h-10 w-10 animate-pulse rounded-full bg-raised" aria-label="Loading account" />;
  if (!s.authed)
    return (
      <button onClick={s.login} className={compact ? 'flex w-[68px] flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-z' : 'btn-z px-4 py-2 text-sm'}>
        <LogIn size={compact ? 20 : 16} /> Sign in
      </button>
    );
  return (
    <div className={compact ? 'flex flex-col items-center gap-1.5' : 'flex items-center gap-2'}>
      {role === 'admin' && (
        <Link to="/admin" aria-label="Admin" className={compact ? 'flex w-[68px] flex-col items-center gap-1 py-1.5 text-[11px] font-medium text-dim hover:text-chalk' : 'btn-line px-3 py-2 text-sm'}><Shield size={compact ? 20 : 16} /><span className={compact ? '' : 'hidden sm:inline'}>Admin</span></Link>
      )}
      <Link to="/wallet" title={s.label ?? 'Account'} className={compact ? 'grid h-10 w-10 place-items-center rounded-full border border-line-2 bg-raised text-z' : 'btn-line px-3 py-2 text-sm'}>
        <UserRound size={18} />{!compact && <span className="hidden whitespace-nowrap font-mono text-xs sm:inline">{s.label}</span>}
      </Link>
    </div>
  );
}

/** Call before anything that needs a wallet. Opens sign-in and returns false if the user isn't signed in yet. */
export function useEnsureAuth() {
  const s = useSession();
  return () => {
    if (s.authed) return true;
    s.login();
    return false;
  };
}
