"use client";

import { Card } from "@/components/ui/card";
import { useToast } from "@/lib/use-toast";

export function GeneralSettingsTab({
  notificationSettings,
}: any) {
  const { toast } = useToast();

  const settings = notificationSettings?.settings;

  if (!settings) {
    return (
      <Card className="border-border bg-card p-4">
        Loading settings...
      </Card>
    );
  }

  const toggle = async (key: string) => {
    const result = await notificationSettings.saveSettings({
      ...settings,
      [key]: !settings[key],
    });

    if (result.success) {
      toast.success("Settings updated");
      await notificationSettings.refresh();
    } else {
      toast.error("Failed to update settings");
    }
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
              checked={Boolean(settings[item.key])}
              onChange={() => toggle(item.key)}
              className="h-5 w-5 shrink-0"
            />
          </div>
        </Card>
      ))}
    </div>
  );
}
