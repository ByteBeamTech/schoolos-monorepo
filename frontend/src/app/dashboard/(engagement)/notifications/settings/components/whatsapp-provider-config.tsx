"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function WhatsappProviderConfig({
  values,
  setValues,
}: any) {
  return (
    <Card className="border-border bg-card p-4 md:p-6">

      <h3 className="text-lg font-semibold mb-4">
        WhatsApp Configuration
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div>
          <label className="text-sm font-medium mb-2 block">
            WhatsApp Provider
          </label>

          <Select
            value={values.whatsappProvider}
            onValueChange={(value) =>
              setValues((prev: any) => ({
                ...prev,
                whatsappProvider: value,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Provider" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="META">Meta</SelectItem>
              <SelectItem value="GUPSHUP">Gupshup</SelectItem>
              <SelectItem value="INTERAKT">Interakt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Input
          placeholder="Access Token"
          value={values.accessToken}
          onChange={(e) =>
            setValues((p: any) => ({
              ...p,
              accessToken: e.target.value,
            }))
          }
        />

        <Input
          placeholder="Phone Number ID"
          value={values.phoneNumberId}
          onChange={(e) =>
            setValues((p: any) => ({
              ...p,
              phoneNumberId: e.target.value,
            }))
          }
        />

        <Input
          placeholder="Business Account ID"
          value={values.businessAccountId}
          onChange={(e) =>
            setValues((p: any) => ({
              ...p,
              businessAccountId: e.target.value,
            }))
          }
        />

      </div>

    </Card>
  );
}
