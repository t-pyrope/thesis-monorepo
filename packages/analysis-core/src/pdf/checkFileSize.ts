export const checkFileSize = (file: File, maxFileSizeInMb: number) => {
  const fileSizeMb = file.size / (1024 * 1024);
  const valid = fileSizeMb <= maxFileSizeInMb;

  return {
    valid,
    message: valid ? "OK" : `nevalidní (${fileSizeMb.toFixed(2)}MB)`,
  };
};
