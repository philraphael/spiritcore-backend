export const sanitizeText = (text) => {
  if (typeof text !== "string") return "";
  return text.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
};
