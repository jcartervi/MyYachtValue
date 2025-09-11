import { useState, useCallback } from "react";

export function useFormStorage(key: string) {
  const saveFormData = useCallback((data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn("Failed to save form data to localStorage:", error);
    }
  }, [key]);

  const loadFormData = useCallback(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn("Failed to load form data from localStorage:", error);
      return null;
    }
  }, [key]);

  const clearFormData = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn("Failed to clear form data from localStorage:", error);
    }
  }, [key]);

  return {
    saveFormData,
    loadFormData,
    clearFormData,
  };
}
