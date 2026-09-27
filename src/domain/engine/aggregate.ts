/**
 * Agregări pentru Dashboard – construite din ProductResult (același motor).
 */
import type { AppState, ProductStatus } from '../types';
import { calculateProduct, type ProductResult } from './product';
import { totalFixedCosts } from './inputs';
import { mean, sum } from './math';

export interface DashboardSummary {
  results: ProductResult[];
  totalProducts: number;
  /** Produse incluse în proiecțiile lunare (după status). */
  projected: ProductResult[];
  averageNetMargin: number | null;
  averageContributionMargin: number | null;
  averageCpa: number | null;
  averageBreakEvenCpa: number | null;
  bestContribution: { result: ProductResult; margin: number } | null;
  monthlyRevenue: number;
  monthlyContribution: number;
  /** Σ profit net lunar al produselor (cu costuri fixe ALOCATE per comandă). */
  monthlyNetAllocated: number;
  /** P&L real: Σ contribuție lunară − total costuri fixe lunare. */
  monthlyNetReal: number;
  monthlyAdSpend: number;
  monthlyOrders: number;
  monthlyDeliveredOrders: number;
  totalMonthlyFixedCosts: number;
  byClass: Record<string, number>;
}

export function summarize(state: AppState): DashboardSummary {
  const results = state.products.map((p) => calculateProduct(p, state));
  const statuses = new Set<ProductStatus>(state.preferences.projectionStatuses);
  const projected = results.filter((r) => statuses.has(r.product.status));

  let best: DashboardSummary['bestContribution'] = null;
  for (const r of results) {
    const m = r.analysis.contributionMargin;
    if (m !== null && (best === null || m > best.margin)) best = { result: r, margin: m };
  }

  const monthlyContribution = sum(projected.map((r) => r.analysis.contributionPerMonth));
  const fixed = totalFixedCosts(state);
  const byClass: Record<string, number> = { profitable: 0, near: 0, unprofitable: 0, unknown: 0 };
  for (const r of results) byClass[r.profitClass]++;

  return {
    results,
    totalProducts: results.length,
    projected,
    averageNetMargin: mean(results.map((r) => r.analysis.netMargin)),
    averageContributionMargin: mean(results.map((r) => r.analysis.contributionMargin)),
    averageCpa: mean(results.map((r) => r.analysis.inputs.cpa)),
    averageBreakEvenCpa: mean(results.map((r) => r.analysis.breakEven.cpaNet)),
    bestContribution: best,
    monthlyRevenue: sum(projected.map((r) => r.analysis.revenuePerMonth)),
    monthlyContribution,
    monthlyNetAllocated: sum(projected.map((r) => r.analysis.profitPerMonth)),
    monthlyNetReal: monthlyContribution - fixed,
    monthlyAdSpend: sum(projected.map((r) => r.analysis.adSpendPerMonth)),
    monthlyOrders: sum(projected.map((r) => r.analysis.monthlyOrders)),
    monthlyDeliveredOrders: sum(projected.map((r) => r.analysis.deliveredOrdersPerMonth)),
    totalMonthlyFixedCosts: fixed,
    byClass,
  };
}
