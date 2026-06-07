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

export function SmsProviderConfig({
  values,
  setValues,
}: any) {
  return (
    <Card className="border-border bg-card p-4 md:p-6">

      <h3 className="text-lg font-semibold mb-4">
        SMS Configuration
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div>
          <label className="text-sm font-medium mb-2 block">
            SMS Provider
          </label>

          <Select
            value={values.smsProvider}
            onValueChange={(value) =>
              setValues((prev: any) => ({
                ...prev,
                smsProvider: value,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Provider" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="MSG91">MSG91</SelectItem>
              <SelectItem value="TEXTLOCAL">TextLocal</SelectItem>
              <SelectItem value="GUPSHUP">Gupshup</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Input
          placeholder="Auth Key"
          value={values.smsAuthKey}
          onChange={(e) =>
            setValues((p: any) => ({
              ...p,
              smsAuthKey: e.target.value,
            }))
          }
        />

        <Input
          placeholder="Sender ID"
          value={values.senderId}
          onChange={(e) =>
            setValues((p: any) => ({
              ...p,
              senderId: e.target.value,
            }))
          }
        />

        <Input
          placeholder="DLT PE ID"
          value={values.dltPeId}
          onChange={(e) =>
            setValues((p: any) => ({
              ...p,
              dltPeId: e.target.value,
            }))
          }
        />

      </div>

    </Card>
  );
}
