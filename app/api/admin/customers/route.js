import connectDB from "@/config/db";
import { requireRole } from "@/lib/accessControl";
import CustomerBlock from "@/models/CustomerBlock";
import DeliveryBooking from "@/models/DeliveryBooking";
import { normalizeCustomerPhone } from "@/lib/customerIdentity";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const access = await requireRole("admin");
  if (!access.authorized) return access.response;

  try {
    await connectDB();
    const customers = await DeliveryBooking.aggregate([
      {
        $match: {
          "sender.phone": { $type: "string", $ne: "" },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$sender.phone",
          name: { $first: "$sender.name" },
          phone: { $first: "$sender.phone" },
          deliveryCount: { $sum: 1 },
          completedDeliveries: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          totalDeliveryFees: { $sum: "$quote.amount" },
          paidNow: {
            $sum: {
              $cond: [
                { $eq: ["$payment.status", "paid"] },
                "$quote.amount",
                0,
              ],
            },
          },
          awaitingCheckout: {
            $sum: {
              $cond: [
                { $eq: ["$payment.status", "pending"] },
                "$quote.amount",
                0,
              ],
            },
          },
          podOutstanding: {
            $sum: {
              $cond: [
                { $eq: ["$payment.status", "due_on_delivery"] },
                "$quote.amount",
                0,
              ],
            },
          },
          lastOrderAt: { $first: "$createdAt" },
          lastOrderReference: { $first: "$reference" },
          createdAt: { $last: "$createdAt" },
        },
      },
      { $sort: { lastOrderAt: -1 } },
    ]);

    const blocks = await CustomerBlock.find()
      .select("phone")
      .lean();
    const blockedPhones = new Set(blocks.map((block) => block.phone));
    const customersWithStatus = customers.map((customer) => ({
      ...customer,
      blocked: blockedPhones.has(normalizeCustomerPhone(customer.phone)),
    }));

    return NextResponse.json({ success: true, customers: customersWithStatus });
  } catch (error) {
    console.error("Could not load back-office customers:", error);
    return NextResponse.json(
      { success: false, message: "Customer records are temporarily unavailable." },
      { status: 500 }
    );
  }
}
