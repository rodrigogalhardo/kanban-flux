// Simple event tracking - lightweight foundation
// PostHog/Mixpanel can be integrated later
export async function trackEvent(event: string, data?: Record<string, unknown>) {
  // Log to structured logger
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    service: "analytics",
    event,
    data,
  }));
}
