import { ClipboardList, Compass, Home, Images, Package, Receipt, Sparkles, Store, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { MY_STALL, useApp, useBagCount } from '../store';
import { Mark, Toast } from './kit';

type Item = { to: string; label: string; icon: ReactNode; badge?: number; end?: boolean };

/** Desktop: slim rail on the left. Phone: tab bar at the bottom. */
function Nav({ items, extra }: { items: Item[]; extra?: ReactNode }) {
  const cls = (on: boolean) => (on ? 'text-chalk' : 'text-dim hover:text-chalk');
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[84px] flex-col items-center border-r border-line bg-bg py-5 md:flex">
        <Link to="/" aria-label="Zeeto home" className="mb-8"><Mark size={40} /></Link>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1.5">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => `relative flex w-[68px] flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-medium transition ${isActive ? 'bg-white/[.06]' : ''} ${cls(isActive)}`}>
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-z' : ''}>{it.icon}</span>
                  {it.label}
                  {!!it.badge && <span className="absolute right-2.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-z px-1 text-[10px] font-bold text-z-ink">{it.badge}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        {extra}
      </aside>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-xl pb-safe md:hidden">
        <div className="gutter mx-auto flex max-w-lg">
          {items.slice(0, 5).map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => `relative flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[10.5px] font-medium ${cls(isActive)}`}>
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-z' : ''}>{it.icon}</span>
                  {it.label}
                  {!!it.badge && <span className="absolute right-[calc(50%-20px)] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-z px-1 text-[10px] font-bold text-z-ink">{it.badge}</span>}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}

export function ShopperFrame() {
  const open = useApp((s) => s.myOrders.filter((o) => o.status === 'paid' || o.status === 'ready').length);
  const bag = useBagCount();
  return (
    <div className="min-h-[100dvh] pb-24 md:pb-0 md:pl-[84px]">
      <Outlet />
      <Toast />
      <Nav
        items={[
          { to: '/explore', label: 'Explore', icon: <Compass size={22} /> },
          { to: '/feed', label: 'Feed', icon: <Images size={22} /> },
          { to: '/orders', label: 'Orders', icon: <Receipt size={22} />, badge: open },
          { to: '/rewards', label: 'Rewards', icon: <Sparkles size={22} /> },
          { to: '/wallet', label: 'Wallet', icon: <Wallet size={22} /> },
        ]}
        extra={
          <div className="flex flex-col items-center gap-2">
            {bag > 0 && <Link to="/bag" aria-label={`Bag, ${bag} items`} className="grid h-11 w-11 place-items-center rounded-full bg-z text-sm font-bold text-z-ink">{bag}</Link>}
            <Link to="/sell" className="flex w-[68px] flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-dim hover:text-chalk"><Store size={20} />Sell</Link>
          </div>
        }
      />
    </div>
  );
}

export function SellerFrame() {
  const waiting = useApp((s) => s.stallOrders.filter((o) => o.vendorId === MY_STALL && o.status === 'paid').length);
  return (
    <div className="min-h-[100dvh] pb-24 md:pb-0 md:pl-[84px]">
      <Outlet />
      <Toast />
      <Nav
        items={[
          { to: '/sell', label: 'Overview', icon: <Home size={22} />, end: true },
          { to: '/sell/orders', label: 'Orders', icon: <ClipboardList size={22} />, badge: waiting },
          { to: '/sell/products', label: 'Products', icon: <Package size={22} /> },
          { to: '/sell/payments', label: 'Payments', icon: <Wallet size={22} /> },
          { to: '/sell/store', label: 'Store', icon: <Store size={22} /> },
        ]}
        extra={<Link to="/explore" className="flex w-[68px] flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-dim hover:text-chalk"><Compass size={20} />Shop</Link>}
      />
    </div>
  );
}
