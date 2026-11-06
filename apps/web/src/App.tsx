import type { ReactNode } from 'react';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SellerFrame, ShopperFrame } from './components/Frame';
import Landing from './screens/Landing';
import AppLink from './screens/AppLink';
import Start from './screens/Start';
import Bag from './screens/customer/Bag';
import { PayRequestPage, PayStall } from './screens/customer/CounterPay';
import Explore from './screens/customer/Explore';
import Feed from './screens/customer/Feed';
import OrderDetail from './screens/customer/OrderDetail';
import Orders from './screens/customer/Orders';
import Rewards from './screens/customer/Rewards';
import Stall from './screens/customer/Stall';
import Wallet from './screens/customer/Wallet';
import Collect from './screens/seller/Collect';
import Admin from './screens/admin/Admin';
import Join from './screens/seller/Join';
import Overview from './screens/seller/Overview';
import Payments from './screens/seller/Payments';
import Developers from './screens/seller/Developers';
import Products from './screens/seller/Products';
import SellOrders from './screens/seller/SellOrders';
import Store from './screens/seller/Store';
import WhatsApp from './screens/seller/WhatsApp';

/** The single-file share build can't use URL paths, so it routes in memory. */
const Router = ({ children }: { children: ReactNode }) => (__SINGLE__ ? <MemoryRouter>{children}</MemoryRouter> : <BrowserRouter>{children}</BrowserRouter>);

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/s/:id" element={<Stall />} />
        <Route path="/bag" element={<Bag />} />
        <Route path="/join" element={<Join />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/app-link" element={<AppLink />} />
        <Route path="/start" element={<Start />} />
        <Route path="/p/:id" element={<PayStall />} />
        <Route path="/pay/r/:id" element={<PayRequestPage />} />
        <Route element={<ShopperFrame />}>
          <Route path="/explore" element={<Explore />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/wallet" element={<Wallet />} />
        </Route>
        <Route path="/sell" element={<SellerFrame />}>
          <Route index element={<Overview />} />
          <Route path="collect" element={<Collect />} />
          <Route path="orders" element={<SellOrders />} />
          <Route path="products" element={<Products />} />
          <Route path="payments" element={<Payments />} />
          <Route path="developers" element={<Developers />} />
          <Route path="store" element={<Store />} />
          <Route path="whatsapp" element={<WhatsApp />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
