/**
 * Logger utility for consistent logging across the application
 * Automatically filters development-only logs in production
 */

type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug'

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  /**
   * Log general information (development only)
   */
  log(...args: any[]): void {
    if (this.isDevelopment) {
      console.log(...args)
    }
  }

  /**
   * Log informational messages (development only)
   */
  info(...args: any[]): void {
    if (this.isDevelopment) {
      console.info(...args)
    }
  }

  /**
   * Log debug information (development only)
   */
  debug(...args: any[]): void {
    if (this.isDevelopment) {
      console.debug(...args)
    }
  }

  /**
   * Log warnings (always shown)
   */
  warn(...args: any[]): void {
    console.warn(...args)
  }

  /**
   * Log errors (always shown)
   */
  error(...args: any[]): void {
    console.error(...args)
  }

  /**
   * Group logs together (development only)
   */
  group(label: string): void {
    if (this.isDevelopment) {
      console.group(label)
    }
  }

  /**
   * End log group (development only)
   */
  groupEnd(): void {
    if (this.isDevelopment) {
      console.groupEnd()
    }
  }

  /**
   * Log with custom styling (development only)
   */
  styled(message: string, style: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`%c${message}`, style, ...args)
    }
  }
}

export const logger = new Logger()
