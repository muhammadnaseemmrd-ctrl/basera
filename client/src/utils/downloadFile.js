export const downloadBlob = ({ blob, filename, mimeType = "application/pdf" }) => {
  const url = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const downloadApiPdf = async ({ api, endpoint, filename }) => {
  const response = await api.get(endpoint, { responseType: "blob" });
  downloadBlob({ blob: response.data, filename });
};

export const downloadTextFile = ({ text, filename, mimeType = "text/csv;charset=utf-8" }) => {
  downloadBlob({ blob: new Blob([text], { type: mimeType }), filename, mimeType });
};
