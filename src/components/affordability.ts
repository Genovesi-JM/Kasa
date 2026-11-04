// Illustrative scenarios, not an assessment of a person's ability to pay.
export function estimateRentBudget(income: string, commitments: string) {
  const incomeValue = Number(income);
  const commitmentsValue = Number(commitments);
  if (
    !income.trim() ||
    !Number.isFinite(incomeValue) ||
    !Number.isFinite(commitmentsValue) ||
    incomeValue <= 0 ||
    commitmentsValue < 0 ||
    incomeValue > Number.MAX_SAFE_INTEGER ||
    commitmentsValue > Number.MAX_SAFE_INTEGER
  )
    return null;

  return {
    lower: Math.max(0, Math.floor(incomeValue * 0.28 - commitmentsValue)),
    upper: Math.max(0, Math.floor(incomeValue * 0.35 - commitmentsValue)),
  };
}
