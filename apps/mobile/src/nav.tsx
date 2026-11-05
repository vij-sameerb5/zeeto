import { createContext, useContext } from 'react';

export type Tab = 'home' | 'explore' | 'orders' | 'points' | 'wallet';
export type Route =
  | { name: 'welcome' }
  | { name: 'tabs' }
  | { name: 'stall'; id: string }
  | { name: 'bag' }
  | { name: 'order'; id: string }
  | { name: 'sell' }
  | { name: 'scan' };

export interface Nav {
  push: (r: Route) => void;
  back: () => void;
  /** Replace the whole stack, e.g. after paying go straight to the order. */
  reset: (...r: Route[]) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  /** Explore's search box; Home's category tiles fill it. */
  search: string;
  setSearch: (q: string) => void;
}

export const NavContext = createContext<Nav | null>(null);
export const useNav = () => useContext(NavContext)!;
