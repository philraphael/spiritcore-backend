export const nowIso = () => new Date().toISOString();

export const daysBetween = (isoA, isoB) => {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  const diff = Math.abs(b - a);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};
