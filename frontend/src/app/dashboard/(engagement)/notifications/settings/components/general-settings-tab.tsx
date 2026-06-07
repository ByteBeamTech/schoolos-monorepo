"use client";

import { useState } from "react";

import { Card } from "@/components/ui/card";

export function GeneralSettingsTab() {
  const [settings, setSettings] = useState({
    smsEnabled: true,
    emailEnabled: true,
    whatsappEnabled: false,
    pushEnabled: true,
  });

  const toggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const items = [
    {
      key: "smsEnabled",
      label: "SMS Notifications",
      description: "Allow delivery through SMS providers",
    },
    {
      key: "emailEnabled",
      label: "Email Notifications",
      description: "Allow delivery through email providers",
    },
    {
      key: "whatsappEnabled",
      label: "WhatsApp Notifications",
      description: "Enable WhatsApp message delivery",
    },
    {
      key: "pushEnabled",
      label: "Push Notifications",
      description: "Enable app push notifications",
    },
  ];

  return (
    <div className="grid gap-4">

      {items.map((item) => (
        <Card
          key={item.key}
          className="border-border bg-card p-4"
        >
          <div className="flex items-center justify-between gap-4">

            <div>
              <h3 className="font-medium text-foreground">
                {item.label}
              </h3>

              <p className="text-sm text-muted-foreground">
                {item.description}
              </p>
            </div>

            <input
              type="checkbox"
              checked={settings[item.key as keyof typeof settings]}
              onChange={() =>
                toggle(item.key as keyof typeof settings)
              }
              className="h-5 w-5 shrink-0"
            />

          </div>
        </Card>
      ))}
    </div>
  );
}
