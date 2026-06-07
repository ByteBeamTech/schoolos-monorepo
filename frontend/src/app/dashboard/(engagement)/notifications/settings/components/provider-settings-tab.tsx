"use client";
import { apiClient } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/lib/use-toast";

const { toast } = useToast();
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ProviderSettingsTab() {
  const [providerMode, setProviderMode] =
    useState("SCHOOL_PROVIDER");
const [testEmail, setTestEmail] = useState("");
const [testingEmail, setTestingEmail] = useState(false);

const handleEmailTest = async () => {
  if (!testEmail) {
    alert("Please enter an email address");
    return;
  }

  try {
    setTestingEmail(true);

    const response = await apiClient.post(
      "/notifications/settings/test",
      {
        channel: "EMAIL",
        email: testEmail,
      },
    );

   toast.success ("Test email sent successfully",); 
  } catch (error: any) {
  	    toast.error(
  error?.response?.data?.message ??
  "Unable to send test email",
);
  } finally {
    setTestingEmail(false);
  }
};


return (
    <div className="space-y-6">

      <Card className="border-border bg-card p-4 md:p-6">

        <h3 className="font-semibold text-foreground mb-4">
          Provider Mode
        </h3>

        <div className="grid gap-3">

          <label className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer">
            <input
              type="radio"
              value="SCHOOL_PROVIDER"
              checked={providerMode === "SCHOOL_PROVIDER"}
              onChange={() =>
                setProviderMode("SCHOOL_PROVIDER")
              }
            />

            <div>
              <div className="font-medium">
                School Provider
              </div>

              <div className="text-sm text-muted-foreground">
                School manages its own SMS, Email and WhatsApp providers.
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer">
            <input
              type="radio"
              value="BYTEBEAM_MANAGED"
              checked={providerMode === "BYTEBEAM_MANAGED"}
              onChange={() =>
                setProviderMode("BYTEBEAM_MANAGED")
              }
            />

            <div>
              <div className="font-medium">
                ByteBeam Managed
              </div>

              <div className="text-sm text-muted-foreground">
                ByteBeam manages delivery infrastructure and providers.
              </div>
            </div>
          </label>

        </div>

      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Card className="border-border bg-card p-4 md:p-6">
          <label className="block space-y-2">
            <span className="text-sm font-medium">
              SMS Provider
            </span>

            <Input
              defaultValue="MSG91"
              disabled={providerMode === "BYTEBEAM_MANAGED"}
            />
          </label>
        </Card>

        <Card className="border-border bg-card p-4 md:p-6">
          <label className="block space-y-2">
            <span className="text-sm font-medium">
              Email Provider
            </span>

            <Input
              defaultValue="RESEND"
              disabled={providerMode === "BYTEBEAM_MANAGED"}
            />
          </label>
        </Card>

        <Card className="border-border bg-card p-4 md:p-6">
          <label className="block space-y-2">
            <span className="text-sm font-medium">
              WhatsApp Provider
            </span>

            <Input
              defaultValue="META"
              disabled={providerMode === "BYTEBEAM_MANAGED"}
            />
          </label>
        </Card>

        <Card className="border-border bg-card p-4 md:p-6">
          <label className="block space-y-2">
            <span className="text-sm font-medium">
              Sender Name
            </span>

            <Input placeholder="BYTEBEAM" />
          </label>
        </Card>

      </div>

      <Card className="border-border bg-card p-4 md:p-6">

  <div className="space-y-4">

    <h3 className="font-semibold">
      Provider Testing
    </h3>

    <div className="space-y-2">

      <label className="text-sm font-medium">
        Test Email Address
      </label>

      <Input
        type="email"
        placeholder="admin@school.com"
        value={testEmail}
        onChange={(e) =>
          setTestEmail(e.target.value)
        }
      />

    </div>

    <div className="flex flex-col sm:flex-row gap-3">

      <Button
        onClick={handleEmailTest}
        disabled={!testEmail || testingEmail}
      >
        {testingEmail
          ? "Sending..."
          : "Send Test Email"}
      </Button>

      <Button variant="outline">
        Save Settings
      </Button>

    </div>

  </div>

</Card>

    </div>
  );
}
