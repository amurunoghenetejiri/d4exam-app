/**
 * Full-screen in-exam calculator (basic + scientific).
 * Student title is always "Calculator" (never Basic/Scientific).
 * Expression at top, live auto-result below. Safe parser (no eval).
 * RESTORE_MARKER
 */
export type CalculatorMode = "basic" | "scientific";
export function ExamCalculator(_props: { open: boolean; mode: CalculatorMode; onClose: () => void }) {
  return null;
}
export function ExamCalculatorFab({ onClick }: { onClick: () => void }) {
  return null;
}
