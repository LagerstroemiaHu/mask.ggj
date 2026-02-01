import { useEffect, useState, useCallback } from 'react';

export const useKeyPress = (targetKey: string) => {
  const [isPressed, setIsPressed] = useState(false);

  const downHandler = useCallback(({ key }: KeyboardEvent) => {
    if (key === targetKey) {
      setIsPressed(true);
    }
  }, [targetKey]);

  const upHandler = useCallback(({ key }: KeyboardEvent) => {
    if (key === targetKey) {
      setIsPressed(false);
    }
  }, [targetKey]);

  useEffect(() => {
    window.addEventListener("keydown", downHandler);
    window.addEventListener("keyup", upHandler);
    return () => {
      window.removeEventListener("keydown", downHandler);
      window.removeEventListener("keyup", upHandler);
    };
  }, [downHandler, upHandler]);

  return isPressed;
};
