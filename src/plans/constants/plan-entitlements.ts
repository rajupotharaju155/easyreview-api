export type PlanEntitlements = {
  multiLanguageAi: boolean;
  standeeIncluded: boolean;
  nfcIncluded: boolean;
};

export const DEFAULT_PLAN_ENTITLEMENTS: PlanEntitlements = {
  multiLanguageAi: false,
  standeeIncluded: false,
  nfcIncluded: false,
};

export function mergePlanEntitlements(
  partial?: Partial<PlanEntitlements> | null,
): PlanEntitlements {
  return {
    ...DEFAULT_PLAN_ENTITLEMENTS,
    ...partial,
  };
}
