/**
 * Simple logging utility for better log management
 */
export class Logger {
	private static formatMessage(level: string, message: string, ...args: unknown[]): string {
		const timestamp = new Date().toISOString();
		const formattedArgs = args.length > 0 ? ` ${args.map(arg => 
			typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
		).join(' ')}` : '';
		return `[${timestamp}] [${level}] ${message}${formattedArgs}`;
	}

	public static info(message: string, ...args: unknown[]): void {
		console.log(this.formatMessage('INFO', message, ...args));
	}

	public static warn(message: string, ...args: unknown[]): void {
		console.warn(this.formatMessage('WARN', message, ...args));
	}

	public static error(message: string, error?: Error | unknown, ...args: unknown[]): void {
		if (error instanceof Error) {
			console.error(this.formatMessage('ERROR', message, error.message, error.stack, ...args));
		} else if (error !== undefined) {
			console.error(this.formatMessage('ERROR', message, error, ...args));
		} else {
			console.error(this.formatMessage('ERROR', message, ...args));
		}
	}

	public static debug(message: string, ...args: unknown[]): void {
		if (process.env.NODE_ENV !== 'production') {
			console.debug(this.formatMessage('DEBUG', message, ...args));
		}
	}
}