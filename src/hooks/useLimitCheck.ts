/**
 * Limits have been removed — all users with an active plan can create
 * unlimited clients, resellers, and messages.
 */
export function useLimitCheck() {
  return {
    canCreateClient: true,
    canCreateReseller: true,
    clientLimitMsg: "",
    resellerLimitMsg: "",
  };
}
