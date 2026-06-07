"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

export function useNotificationSettings() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    try {
      setLoading(true);

      const res =
        await apiClient.get("/notifications/settings");

      setSettings(res.data ?? res);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (payload: any) => {
    try {
      setSaving(true);

      const res =
        await apiClient.put(
          "/notifications/settings",
          payload,
        );

      setSettings(res.data ?? res);

      return {
        success: true,
      };
    } catch (error) {
      console.error(error);

      return {
        success: false,
      };
    } finally {
      setSaving(false);
    }
  };

  const testProvider = async (
    channel: "SMS" | "EMAIL" | "WHATSAPP",
  ) => {
    return apiClient.post(
      "/notifications/settings/test",
      {
        channel,
        email:
          channel === "EMAIL"
            ? "test@example.com"
            : undefined,

        phone:
          channel !== "EMAIL"
            ? "9999999999"
            : undefined,
      },
    );
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return {
    settings,
    loading,
    saving,
    saveSettings,
    testProvider,
    refresh: loadSettings,
  };
}
