export const logAppEvent = (event: string, payload?: Record<string, unknown>) => {
  console.info(`[APP_EVENT] ${event}`, payload ?? {});
};

export const logError = (event: string, error: unknown) => {
  console.error(`[APP_ERROR] ${event}`, error);
};
