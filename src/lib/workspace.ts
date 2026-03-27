export function getWorkspaceId(): string {
  // For now, return default. When multi-tenancy is full, read from session/cookie
  return process.env.DEFAULT_WORKSPACE_ID || "default-workspace";
}
