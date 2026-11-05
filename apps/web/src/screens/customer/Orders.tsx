import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { VENDORS, ago, inr } from '@zeeto/core';
import { Empty, Face, Header, Status } from '../../components/kit';
import { useApp } from '../../store';

export default function Orders() {
  const orders = useApp((s) => s.myOrders);
  const live = orders.filter((o) => ['paid', 'accepted', 'ready'].includes(o.status));
  const past = orders.filter((o) => !live.includes(o));

  const row = (o: (typeof orders)[number]) => {
    const v = VENDORS.find((x) => x.id === o.vendorId)!;
    return (
      <li key={o.id}>
        <Link to={`/orders/${o.id}`} className="panel flex items-center gap-3 p-3 pr-4 transition hover:border-line-2">
          <Face media={v.avatar} size={52} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{v.name}</div>
            <div className="truncate text-sm text-mute">{o.lines.map((l) => `${l.qty} ${l.name}`).join(', ')}</div>
            <div className="mt-1.5"><Status s={o.status} /></div>
          </div>
          <div className="text-right"><div className="font-bold nums">{inr(o.inr)}</div><div className="text-xs text-dim">{ago(o.at)}</div></div>
          <ChevronRight size={18} className="text-dim" />
        </Link>
      </li>
    );
  };

  return (
    <div>
      <Header title="Orders" sub="Pickup only · pay first, collect at the stall" />
      <div className="gutter mx-auto flex max-w-3xl flex-col gap-8 py-6">
        {!orders.length && <Empty icon="Receipt" title="No orders yet" body="Your pickup orders and their codes show up here." action={<Link to="/explore" className="btn-z">Find a stall</Link>} />}
        {live.length > 0 && <section className="flex flex-col gap-3"><div className="label">Happening now</div><ul className="flex flex-col gap-3">{live.map(row)}</ul></section>}
        {past.length > 0 && <section className="flex flex-col gap-3"><div className="label">Earlier</div><ul className="flex flex-col gap-3">{past.map(row)}</ul></section>}
      </div>
    </div>
  );
}
