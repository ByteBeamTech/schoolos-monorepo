"use client";

import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/use-toast";

import { Card } from "@/components/ui/card";

import { EmailProviderConfig } from "./email-provider-config";
import { SmsProviderConfig } from "./sms-provider-config";
import { WhatsappProviderConfig } from "./whatsapp-provider-config";
import { DeliverySettings } from "./delivery-settings";
import { ProviderTesting } from "./provider-testing";
import { SaveBar } from "./save-bar";

export function ProviderSettingsTab({
  notificationSettings,
}: any) {
  const { toast } = useToast();

  const [providerMode, setProviderMode] =
    useState("SCHOOL_PROVIDER");

  const [testEmail, setTestEmail] =
    useState("");

  const [testingEmail, setTestingEmail] =
    useState(false);

  const [values, setValues] = useState({
    emailProvider: "",
    smtpHost: "",
    smtpPort: "",
    smtpUser: "",
    smtpPassword: "",
    fromEmail: "",
    fromName: "",

    smsProvider: "",
    smsAuthKey: "",
    senderId: "",
    dltPeId: "",

    whatsappProvider: "",
    accessToken: "",
    phoneNumberId: "",
    businessAccountId: "",

    senderName: "",
    replyTo: "",
  });

  const settings =
    notificationSettings?.settings;

  useEffect(() => {
    if (!settings) return;

    setProviderMode(
      settings.providerMode ??
      "SCHOOL_PROVIDER"
    );

    setValues((prev) => ({
      ...prev,

      emailProvider:
        settings.emailProvider ?? "",

      smsProvider:
        settings.smsProvider ?? "",

      whatsappProvider:
        settings.whatsappProvider ?? "",

      senderName:
        settings.senderName ?? "",

      replyTo:
        settings.replyTo ?? "",
    }));
  }, [settings]);

  const handleSave = async () => {
    const result =
      await notificationSettings.saveSettings({
        providerMode,

        emailProvider:
          values.emailProvider,

        smsProvider:
          values.smsProvider,

        whatsappProvider:
          values.whatsappProvider,

        senderName:
          values.senderName,

        replyTo:
          values.replyTo,

        emailConfig: {
          smtpHost:
            values.smtpHost,

          smtpPort:
            values.smtpPort,

          username:
            values.smtpUser,

          password:
            values.smtpPassword,

          fromEmail:
            values.fromEmail,

          fromName:
            values.fromName,
        },

        smsConfig: {
          authKey:
            values.smsAuthKey,

          senderId:
            values.senderId,

          dltPeId:
            values.dltPeId,
        },

        whatsappConfig: {
          accessToken:
            values.accessToken,

          phoneNumberId:
            values.phoneNumberId,

          businessAccountId:
            values.businessAccountId,
        },
      });

    if (result.success) {
      toast.success(
        "Settings saved successfully"
      );

      await notificationSettings.refresh();
    } else {
      toast.error(
        "Failed to save settings"
      );
    }
  };

  const handleEmailTest = async () => {
    if (!testEmail) {
      toast.error(
        "Please enter an email address"
      );
      return;
    }

    try {
      setTestingEmail(true);

      await apiClient.post(
        "/notifications/settings/test",
        {
          channel: "EMAIL",
          email: testEmail,
        }
      );

      toast.success(
        "Test email sent successfully"
      );
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ??
        "Unable to send test email"
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
              checked={
                providerMode ===
                "SCHOOL_PROVIDER"
              }
              onChange={() =>
                setProviderMode(
                  "SCHOOL_PROVIDER"
                )
              }
            />

            <div>
              <div className="font-medium">
                School Provider
              </div>

              <div className="text-sm text-muted-foreground">
                School manages its own
                providers.
              </div>
            </div>

          </label>

          <label className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer">

            <input
              type="radio"
              value="BYTEBEAM_MANAGED"
              checked={
                providerMode ===
                "BYTEBEAM_MANAGED"
              }
              onChange={() =>
                setProviderMode(
                  "BYTEBEAM_MANAGED"
                )
              }
            />

            <div>
              <div className="font-medium">
                ByteBeam Managed
              </div>

              <div className="text-sm text-muted-foreground">
                ByteBeam manages
                delivery infrastructure.
              </div>
            </div>

          </label>

        </div>

      </Card>

      <EmailProviderConfig
        values={values}
        setValues={setValues}
      />

      <SmsProviderConfig
        values={values}
        setValues={setValues}
      />

      <WhatsappProviderConfig
        values={values}
        setValues={setValues}
      />

      <DeliverySettings
        values={values}
        setValues={setValues}
      />

      <ProviderTesting
        testEmail={testEmail}
        setTestEmail={setTestEmail}
        testingEmail={testingEmail}
        handleEmailTest={handleEmailTest}
      />

      <SaveBar
        onSave={handleSave}
      />

    </div>
  );
}
