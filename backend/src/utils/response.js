export const ok = (data = {}, message = "OK") => ({
  success: true,
  data,
  message,
});

export const fail = (message = "Something went wrong", data = {}) => ({
  success: false,
  data,
  message,
});