/**
 * Logger utility for conditionally enabled debug logging.
 */
export class Logger {
    private static _debugEnabled = false;

    /**
     * Enable or disable debug logging globally.
     */
    static setDebugEnabled(enabled: boolean) {
        this._debugEnabled = enabled;
    }

    /**
     * Check if debug logging is enabled.
     */
    static isDebugEnabled(): boolean {
        return this._debugEnabled;
    }

    /**
     * Log a debug message if debug logging is enabled.
     */
    static debug(message?: any, ...optionalParams: any[]) {
        if (this._debugEnabled) {
            console.debug(message, ...optionalParams);
        }
    }

    /**
     * Log an error message.
     */
    static error(message?: any, ...optionalParams: any[]) {
        console.error(message, ...optionalParams);
    }

    /**
     * Log a warning message.
     */
    static warn(message?: any, ...optionalParams: any[]) {
        console.warn(message, ...optionalParams);
    }
}
