export const arraysEqual = (a, b) => {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((element, index) => element === b[index])
  );
}

export const nonEmptyArray = (arr) => Array.isArray(arr) && arr.length > 0;