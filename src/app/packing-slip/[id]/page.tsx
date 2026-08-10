import { db } from '@/lib/db';
import { HealvitaShippingLabel } from '@/components/HealvitaShippingLabel';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PackingSlipPage({ params }: Props) {
  const { id } = await params;
  const order = await db.getOrderByOrderId(id);
  if (!order) return notFound();

  return (
    <div style={{ padding: 0, margin: 0, backgroundColor: '#FFFFFF', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <div className="thermal-shipping-label" style={{ width: '4in', backgroundColor: '#FFFFFF' }}>
        <HealvitaShippingLabel order={order} />
      </div>
    </div>
  );
}
