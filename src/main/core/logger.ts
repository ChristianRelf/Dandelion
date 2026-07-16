export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';

/**
 * A tiny, dependency-free structured logger. Scopes compose (`app:tabs`) so log
 * lines are attributable to the subsystem that produced them.
 */
export class Logger {
  constructor(
    private readonly scope: string,
    private readonly minLevel: LogLevel = 'info',
  ) {}

  child(scope: string): Logger {
    return new Logger(`${this.scope}:${scope}`, this.minLevel);
  }

  debug(message: string, ...args: unknown[]): void {
    this.write('debug', message, args);
  }
  info(message: string, ...args: unknown[]): void {
    this.write('info', message, args);
  }
  warn(message: string, ...args: unknown[]): void {
    this.write('warn', message, args);
  }
  error(message: string, ...args: unknown[]): void {
    this.write('error', message, args);
  }

  private write(level: LogLevel, message: string, args: unknown[]): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    const time = new Date().toISOString().slice(11, 23);
    const prefix = `${COLORS[level]}${time} ${level.toUpperCase().padEnd(5)}${RESET} \x1b[2m${this.scope}${RESET}`;
    const sink = level === 'warn' ? console.warn : level === 'error' ? console.error : console.info;
    sink(`${prefix}  ${message}`, ...args);
  }
}

export const rootLogger = new Logger(
  'dandelion',
  process.env['NODE_ENV'] === 'development' ? 'debug' : 'info',
);
