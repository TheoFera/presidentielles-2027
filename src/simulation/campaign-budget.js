// All amounts use the game's unit: k€ (16 800 k€ = 16.8 million euros).
export function remainingCampaignBudget(candidate, config) {
  return Math.max(0, config.balance.money.campaign_spending_limit - candidate.total_spent);
}

export function paymentStatus(candidate, config, cost, reason = null) {
  const affordable = candidate.money + 1e-9 >= cost;
  const withinBudget = cost <= remainingCampaignBudget(candidate, config);
  return { affordable, available: !reason && withinBudget, enabled: !reason && affordable && withinBudget,
    reason: !withinBudget ? 'CAMPAIGN_BUDGET_EXCEEDED' : !affordable ? 'INSUFFICIENT_FUNDS' : reason };
}
