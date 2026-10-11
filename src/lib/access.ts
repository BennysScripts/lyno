export function hasAccess(
  org: {
    subscription_status: string;
    trial_ends_at: Date | string;
    period_ends_at: Date | string | null;
    cancel_at_period_end: boolean;
  },
  now = Date.now(),
) {
  if (org.subscription_status === "trialing")
    return new Date(org.trial_ends_at).getTime() > now;
  if (org.subscription_status !== "active") return false;
  return (
    !org.cancel_at_period_end ||
    !org.period_ends_at ||
    new Date(org.period_ends_at).getTime() > now
  );
}
