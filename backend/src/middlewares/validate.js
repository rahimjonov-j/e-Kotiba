import { AppError } from "../utils/errors.js";

export const validate = (schema, source = "body") => (req, _res, next) => {
  const parsed = schema.safeParse(req[source]);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(", ");
    return next(new AppError(message || "Invalid request", 422));
  }

  req[source] = parsed.data;
  return next();
};