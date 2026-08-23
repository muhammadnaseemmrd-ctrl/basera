export const currency = (value) =>
  `PKR ${Number(value || 0).toLocaleString("en-PK")}`;

export const rating = (value) => Number(value || 0).toFixed(1);
