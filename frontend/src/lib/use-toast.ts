/**
 * useToast — SchoolOS toast helper
 *
 * Wraps sonner with consistent error extraction from Axios responses.
 * All pages should import this instead of using window.alert() or sonner directly.
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success("Student added successfully");
 *   toast.error(err);        // auto-extracts message from Axios error
 *   toast.error("Custom message");
 */
import { toast as sonnerToast } from 'sonner';

function extractMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const e = error as any;
    return (
      e?.response?.data?.message ??
      e?.response?.data?.error  ??
      e?.message                ??
      'Something went wrong. Please try again.'
    );
  }
  return 'Something went wrong. Please try again.';
}

export function useToast() {
  return {
    toast: {
      success: (message: string, options?: { description?: string }) =>
        sonnerToast.success(message, options),

      error: (error: unknown, options?: { description?: string }) => {
        const message = extractMessage(error);
        sonnerToast.error(message, options);
      },

      info: (message: string, options?: { description?: string }) =>
        sonnerToast.info(message, options),

      warning: (message: string, options?: { description?: string }) =>
        sonnerToast.warning(message, options),

      promise: <T>(
        promiseFn: Promise<T>,
        messages: { loading: string; success: string; error?: string | ((err: unknown) => string) }
      ) =>
        sonnerToast.promise(promiseFn, {
          loading: messages.loading,
          success: messages.success,
          error:   messages.error ?? extractMessage,
        }),
    },
  };
}

// Also export a standalone toast for use outside React components
export const toast = {
  success: (msg: string) => sonnerToast.success(msg),
  error:   (err: unknown) => sonnerToast.error(extractMessage(err)),
  info:    (msg: string) => sonnerToast.info(msg),
  warning: (msg: string) => sonnerToast.warning(msg),
};
