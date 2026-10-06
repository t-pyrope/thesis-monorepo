export const formatLabel = (value: string) => {
  const readableValue = value.replace(/[_.]/g, " ");

  return (
    readableValue.charAt(0).toLocaleUpperCase("cs-CZ") + readableValue.slice(1)
  );
};
