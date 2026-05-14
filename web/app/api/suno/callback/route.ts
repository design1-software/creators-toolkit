// 📘 WHAT THIS FILE DOES: Receives Suno's webhook callback when music generation completes.
// Suno requires a valid callBackUrl in every generate request — this endpoint satisfies that.
// We don't need to process the payload here because lib/suno.ts polls independently.
// 🔗 Next.js API routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

import { NextRequest, NextResponse } from "next/server";

// 📘 Suno POSTs to this URL when a generation task finishes.
// We return 200 so Suno considers the notification delivered.
// The actual result is read by the polling loop in lib/suno.ts.
export async function POST(_req: NextRequest) {
  return NextResponse.json({ received: true });
}
