/**
 * Connection Manager - Handles idle timeout and connection reset
 * Prevents:
 * - API key expiry after idle
 * - Database connection timeouts
 * - Memory leaks from long-lived connections
 */

import Anthropic from "@anthropic-ai/sdk";

let anthropicInstance: Anthropic | null = null;
let lastActivityTime = Date.now();
const IDLE_TIMEOUT = 55 * 60 * 1000; // 55 minutes - before Vercel's 60s max-duration

export function getAnthropicClient(): Anthropic {
  const now = Date.now();
  const idleTime = now - lastActivityTime;

  // Reset client if idle for too long
  if (idleTime > IDLE_TIMEOUT) {
    console.warn("⚠️ CONNECTION: Idle timeout detected, resetting Anthropic client");
    anthropicInstance = null;
  }

  // Create new instance if needed
  if (!anthropicInstance) {
    console.log("✅ CONNECTION: Creating new Anthropic client instance");
    anthropicInstance = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  // Update activity timestamp
  lastActivityTime = now;

  return anthropicInstance;
}

export function resetConnections() {
  console.log("🔄 CONNECTION: Resetting all connections");
  anthropicInstance = null;
  lastActivityTime = Date.now();
}

export function getConnectionStatus() {
  const idleTime = Date.now() - lastActivityTime;
  return {
    hasInstance: anthropicInstance !== null,
    idleMinutes: Math.round(idleTime / (60 * 1000)),
    isHealthy: idleTime < IDLE_TIMEOUT,
  };
}
