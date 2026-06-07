"use client";
import { useNotificationSettings } from "./hooks/use-notification-settings";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { GeneralSettingsTab } from "./components/general-settings-tab";
import { ProviderSettingsTab } from "./components/provider-settings-tab";
export default function NotificationSettingsPage() {
 const notificationSettings =
    useNotificationSettings();
      
	return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Notification Settings
        </h1>

        <p className="text-sm text-muted-foreground mt-1">
          Configure notification channels, providers and delivery preferences.
        </p>
      </div>

      <Card className="border-border bg-card">

        <Tabs defaultValue="general" className="w-full">

          <div className="border-b border-border p-4">
            <TabsList className="grid w-full grid-cols-2 sm:w-[320px]">
              <TabsTrigger value="general">
                General
              </TabsTrigger>

              <TabsTrigger value="providers">
                Providers
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-4 md:p-6">

	  <TabsContent value="general">
  <GeneralSettingsTab
    notificationSettings={notificationSettings}
  />
</TabsContent>

<TabsContent value="providers">
  <ProviderSettingsTab
    notificationSettings={notificationSettings}
  />
</TabsContent>


          </div>

        </Tabs>

      </Card>

    </div>
  );
}
