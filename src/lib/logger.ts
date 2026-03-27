type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  data?: Record<string, unknown>;
  traceId?: string;
}

class Logger {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      data,
    };

    // Structured JSON output
    const output = JSON.stringify(entry);

    switch (level) {
      case "error":
        console.error(output);
        break;
      case "warn":
        console.warn(output);
        break;
      case "debug":
        if (process.env.LOG_LEVEL === "debug") console.debug(output);
        break;
      default:
        console.log(output);
    }
  }

  debug(message: string, data?: Record<string, unknown>) { this.log("debug", message, data); }
  info(message: string, data?: Record<string, unknown>) { this.log("info", message, data); }
  warn(message: string, data?: Record<string, unknown>) { this.log("warn", message, data); }
  error(message: string, data?: Record<string, unknown>) { this.log("error", message, data); }
}

export function createLogger(service: string): Logger {
  return new Logger(service);
}

// Pre-configured loggers
export const agentLogger = createLogger("agent-executor");
export const apiLogger = createLogger("api");
export const workerLogger = createLogger("worker");
export const triggerLogger = createLogger("auto-trigger");
