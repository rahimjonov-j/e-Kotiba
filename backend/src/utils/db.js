import { AppError } from "../utils/errors.js";

export const assertSupabase = (result, fallbackMessage = "Database error") => {
  if (result.error) {
    throw new AppError(result.error.message || fallbackMessage, 400, { code: result.error.code });
  }
  return result.data;
};