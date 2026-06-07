"use client";

import { Button } from "@/components/ui/button";

export function SaveBar({
  onSave,
}: any) {
  return (
<div className="flex justify-end pt-2"> 

<Button onClick={onSave}>
  Save Settings
</Button>
    </div>
  );
}
