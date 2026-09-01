import type {
  BoatProfile,
  MarineConditions,
  RuleCheck,
  Verdict,
  VerdictLevel,
} from "@alarga/types";
import { type ThresholdDef, thresholdsFor } from "./thresholds.ts";

export { thresholdsFor } from "./thresholds.ts";

const LEVEL_TR: Record<VerdictLevel, string> = {
  green: "UYGUN",
  yellow: "DİKKAT",
  red: "KIRMIZI",
};

const RANK: Record<VerdictLevel, number> = { green: 0, yellow: 1, red: 2 };

function levelFor(def: ThresholdDef, value: number): VerdictLevel {
  if (def.direction === "higher_worse") {
    if (value >= def.redAt) return "red";
    if (value >= def.yellowAt) return "yellow";
    return "green";
  }
  // lower_worse
  if (value <= def.redAt) return "red";
  if (value <= def.yellowAt) return "yellow";
  return "green";
}

function checkFrom(def: ThresholdDef, value: number): RuleCheck {
  return {
    id: def.id,
    label: def.label,
    value,
    yellowAt: def.yellowAt,
    redAt: def.redAt,
    level: levelFor(def, value),
  };
}

function summarize(rule: RuleCheck, def: ThresholdDef): string {
  const bound = rule.level === "red" ? def.redAt : def.yellowAt;
  const op = def.direction === "higher_worse" ? ">" : "<";
  return `${def.label} ${rule.value}${def.unit} ${op} ${bound}${def.unit} sınırı → ${LEVEL_TR[rule.level]}`;
}

/**
 * Deterministik karar motoru. Aynı koşullar + aynı tekne profili → her zaman aynı çıktı.
 * Hiç veri yoksa (tüm kurallar atlanırsa) yeşil değil, "yellow" döner — bilinmeyen ≠ güvenli.
 */
export function evaluateVerdict(
  conditions: MarineConditions,
  profile: BoatProfile,
): Verdict {
  const defs = thresholdsFor(profile.size);
  const checks: RuleCheck[] = [];
  const defById = new Map<string, ThresholdDef>();

  for (const def of defs) {
    const value = def.get(conditions);
    if (value === null || Number.isNaN(value)) continue;
    defById.set(def.id, def);
    checks.push(checkFrom(def, value));
  }

  if (checks.length === 0) {
    return {
      level: "yellow",
      triggeredRule: null,
      checks: [],
      summary: "Yeterli veri yok — dikkatli olun.",
    };
  }

  let worst = checks[0]!;
  for (const c of checks) {
    if (RANK[c.level] > RANK[worst.level]) worst = c;
  }

  if (worst.level === "green") {
    return {
      level: "green",
      triggeredRule: null,
      checks,
      summary: "Koşullar uygun.",
    };
  }

  const triggeredRule = worst;
  return {
    level: worst.level,
    triggeredRule,
    checks,
    summary: summarize(triggeredRule, defById.get(triggeredRule.id)!),
  };
}
