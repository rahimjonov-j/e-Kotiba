import { AppError } from "../utils/errors.js";
import { fail } from "../utils/response.js";

export const notFound = (_req, res) => {
  res.status(404).json(fail("Route not found"));
};

export const errorHandler = (error, _req, res, _next) => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error.message || "Internal server error";
  const data = error instanceof AppError ? error.data : {};

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json(fail(message, data));
};