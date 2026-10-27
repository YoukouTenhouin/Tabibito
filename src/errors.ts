import { ZodError } from "zod";
import { en } from "./locales/en";

export type ErrorCode = Extract<keyof typeof en, `errors.${string}`>;

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    options?: ErrorOptions,
  ) {
    super(en[code], options);
    this.name = "AppError";
  }
}

function isErrorCode(value: string): value is ErrorCode {
  return value.startsWith("errors.") && Object.hasOwn(en, value);
}

/** Store codes, rather than translated strings, so visible errors follow the locale. */
export function errorCode(error: unknown): ErrorCode {
  if (error instanceof AppError) return error.code;
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    if (issue && isErrorCode(issue.message)) return issue.message;
    if (issue?.path[0] === "flightNumber") return "errors.flightNumber";
    return "errors.invalidData";
  }
  if (error instanceof Error) {
    if (error.name === "QuotaExceededError") return "errors.storageFull";
    if (["SecurityError", "NotAllowedError"].includes(error.name))
      return "errors.storagePermission";
    if (
      ["AbortError", "UnknownError", "InvalidStateError"].includes(error.name)
    )
      return "errors.storageTransaction";
  }
  return "errors.generic";
}
