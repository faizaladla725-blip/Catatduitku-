import { colorFor } from "@/lib/categories";
import { formatRupiah } from "@/lib/utils";

interface Slice {
  category: string;
  amount: number;
}

export function DonutChart({ data, total }: { data: Slice[]; total: number }) {
  const size = 160;
  const stroke = 26;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  let offset = 0;
  const arcs = data.map((d) => {
    const fraction = d.amount / total;
    const length = fraction * c;
    const arc = { ...d, fraction, length, offset };
    offset += length;
    return arc;
  });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          className="-rotate-90"
          role="img"
          aria-label="Grafik donat pengeluaran per kategori"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={stroke}
          />
          {arcs.map((a) => (
            <circle
              key={a.category}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={colorFor(a.category)}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(a.length - (arcs.length > 1 ? 2 : 0), 0)} ${c}`}
              strokeDashoffset={-a.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-medium text-muted-foreground">Total</span>
          <span className="px-6 text-sm font-bold leading-tight">{formatRupiah(total)}</span>
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-2">
        {arcs.map((a) => (
          <li key={a.category} className="flex items-center gap-2.5 text-sm">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: colorFor(a.category) }}
            />
            <span className="min-w-0 flex-1 truncate">{a.category}</span>
            <span className="font-semibold tabular-nums">{Math.round(a.fraction * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
