export const toPagination = (page, limit) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  return { from, to };
};