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

export function EmailProviderConfig({
  values,
  setValues,
}: any) {
  return (
    <Card className="border-border bg-card p-4 md:p-6">

      <h3 className="text-lg font-semibold mb-4">
        Email Configuration
      </h3>

<div className="mb-6">

  <label className="text-sm font-medium mb-2 block">
    Email Provider
  </label>

  <Select
    value={values.emailProvider}
    onValueChange={(value) =>
      setValues((prev: any) => ({
        ...prev,
        emailProvider: value,
      }))
    }
  >
    <SelectTrigger>
      <SelectValue placeholder="Select Provider" />
    </SelectTrigger>

    <SelectContent>
      <SelectItem value="ZOHO">Zoho</SelectItem>
      <SelectItem value="RESEND">Resend</SelectItem>
      <SelectItem value="SENDGRID">SendGrid</SelectItem>
      <SelectItem value="SMTP">Custom SMTP</SelectItem>
    </SelectContent>
  </Select>

</div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div>
          <label className="text-sm font-medium mb-2 block">
            SMTP Host
          </label>

          <Input
            value={values.smtpHost}
            onChange={(e) =>
              setValues((prev: any) => ({
                ...prev,
                smtpHost: e.target.value,
              }))
            }
            placeholder="smtp.zoho.in"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            SMTP Port
          </label>

          <Input
            value={values.smtpPort}
            onChange={(e) =>
              setValues((prev: any) => ({
                ...prev,
                smtpPort: e.target.value,
              }))
            }
            placeholder="587"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            Username
          </label>

          <Input
            value={values.smtpUser}
            onChange={(e) =>
              setValues((prev: any) => ({
                ...prev,
                smtpUser: e.target.value,
              }))
            }
            placeholder="admin@school.com"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            Password
          </label>

          <Input
            type="password"
            value={values.smtpPassword}
            onChange={(e) =>
              setValues((prev: any) => ({
                ...prev,
                smtpPassword: e.target.value,
              }))
            }
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            From Email
          </label>

          <Input
            value={values.fromEmail}
            onChange={(e) =>
              setValues((prev: any) => ({
                ...prev,
                fromEmail: e.target.value,
              }))
            }
            placeholder="noreply@school.com"
          />
        </div>

      </div>

      <div className="mt-4">
        <label className="text-sm font-medium mb-2 block">
          From Name
        </label>

        <Input
          value={values.fromName}
          onChange={(e) =>
            setValues((prev: any) => ({
              ...prev,
              fromName: e.target.value,
            }))
          }
          placeholder="School Name"
        />
      </div>

    </Card>
  );
}
