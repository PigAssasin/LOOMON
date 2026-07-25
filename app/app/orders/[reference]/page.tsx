import { OrderDetailExperience } from "@/src/features/orders/order-detail-experience";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  return <OrderDetailExperience reference={decodeURIComponent(reference)} />;
}

