"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function DeliverySettings({
  values,
  setValues,
}: any) {
  return (
    <Card className="border-border bg-card p-4 md:p-6">

      <h3 className="text-lg font-semibold mb-4">
        Delivery Settings
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <Input
          placeholder="Sender Name"
          value={values.senderName}
          onChange={(e) =>
            setValues((p: any) => ({
              ...p,
              senderName: e.target.value,
            }))
          }
        />

        <Input
          placeholder="Reply To Email"
          value={values.replyTo}
          onChange={(e) =>
            setValues((p: any) => ({
              ...p,
              replyTo: e.target.value,
            }))
          }
        />

      </div>

    </Card>
  );
}
