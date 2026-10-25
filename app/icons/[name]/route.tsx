import { ImageResponse } from "next/og";

export const dynamic = "force-static";

const ICONS: Record<string, { size: number; maskable: boolean }> = {
  "icon-192.png": { size: 192, maskable: false },
  "icon-512.png": { size: 512, maskable: false },
  "icon-maskable-512.png": { size: 512, maskable: true },
  "apple-touch-icon.png": { size: 180, maskable: true },
};

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const cfg = ICONS[name];
  if (!cfg) return new Response("Not found", { status: 404 });

  const { size, maskable } = cfg;
  const gw = size * (maskable ? 0.5 : 0.6);
  const gh = gw * 0.72;

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #047857, #0f766e)",
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        <div
          style={{
            width: gw,
            height: gh,
            display: "flex",
            position: "relative",
            background: "#ffffff",
            borderRadius: size * 0.06,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: gh * 0.18,
              width: gw,
              height: gh * 0.16,
              background: "#d1fae5",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: gw * 0.8 - gh * 0.17,
              top: gh * 0.68 - gh * 0.17,
              width: gh * 0.34,
              height: gh * 0.34,
              borderRadius: gh,
              background: "#047857",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: gh * 0.14,
                height: gh * 0.14,
                borderRadius: gh,
                background: "#ffffff",
              }}
            />
          </div>
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
