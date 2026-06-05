"use client";
import { useState, useEffect } from "react";

export interface ToastOptions {
  id: string;
  description: string;
  variant?: "default" | "destructive";
}

let listeners: Array<(toasts: ToastOptions[]) => void> = [];
let memoryToasts: ToastOptions[] = [];

// Standalone function framework lala
export function toast({ description, variant }: Omit<ToastOptions, "id">) {
  const id = Math.random().toString(36).substring(2, 9);
  const newToast: ToastOptions = { id, description, variant };
  memoryToasts = [...memoryToasts, newToast];
  listeners.forEach((listener) => listener(memoryToasts));
  
  setTimeout(() => {
    memoryToasts = memoryToasts.filter((t) => t.id !== id);
    listeners.forEach((listener) => listener(memoryToasts));
  }, 4000);
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastOptions[]>(memoryToasts);

  useEffect(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter((l) => l !== setToasts);
    };
  }, []);

  return {
    toasts,
    // ✅ Fix: Injected standalone tracker directly inside hook payload response registry lala
    toast,
    dismiss: (id: string) => {
      memoryToasts = memoryToasts.filter((t) => t.id !== id);
      listeners.forEach((listener) => listener(memoryToasts));
    }
  };
}
