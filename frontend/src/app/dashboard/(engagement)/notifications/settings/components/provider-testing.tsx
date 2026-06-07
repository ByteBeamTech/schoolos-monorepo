"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ProviderTesting({
  testEmail,
  setTestEmail,
  handleEmailTest,
  testingEmail,
}: any) {
  return (
    <Card className="border-border bg-card p-4 md:p-6">

      <h3 className="text-lg font-semibold mb-4">
        Provider Testing
      </h3>

      <div className="space-y-4">

        <Input
          type="email"
          placeholder="admin@school.com"
          value={testEmail}
          onChange={(e) =>
            setTestEmail(e.target.value)
          }
        />

<div className="flex flex-col sm:flex-row gap-3">

  <Button
    onClick={handleEmailTest}
    disabled={!testEmail || testingEmail}
  >
    {testingEmail
      ? "Sending..."
      : "Send Test Email"}
  </Button>

  <Button disabled variant="outline">
    SMS Testing (Coming Soon)
  </Button>

  <Button disabled variant="outline">
    WhatsApp Testing (Coming Soon)
  </Button>

</div>

<p className="text-xs text-muted-foreground">
  SMS and WhatsApp provider testing will be available after provider integration.
</p>
      </div>

    </Card>
  );
}
