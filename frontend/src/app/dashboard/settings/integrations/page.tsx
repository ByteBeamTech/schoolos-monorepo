"use client";
import { useState }   from "react";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowLeft }  from "lucide-react";

interface Integration {
  id:          string;
  name:        string;
  description: string;
  envKeys:     { key: string; label: string; type?: string }[];
  docsUrl:     string;
  category:    string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: "razorpay",
    name: "Razorpay",
    description: "Accept fee payments from parents via UPI, cards, net banking.",
    category: "Payments",
    docsUrl: "https://razorpay.com/docs/",
    envKeys: [
      { key: "RAZORPAY_STUDENT_KEY_ID",      label: "Key ID" },
      { key: "RAZORPAY_STUDENT_KEY_SECRET",  label: "Key Secret",     type: "password" },
      { key: "RAZORPAY_STUDENT_WEBHOOK_SECRET", label: "Webhook Secret", type: "password" },
    ],
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    description: "Send transactional emails — invoices, receipts, alerts.",
    category: "Email",
    docsUrl: "https://docs.sendgrid.com/",
    envKeys: [
      { key: "SENDGRID_API_KEY",   label: "API Key",    type: "password" },
      { key: "SENDGRID_FROM_EMAIL", label: "From Email" },
    ],
  },
  {
    id: "twilio",
    name: "Twilio",
    description: "Send SMS and WhatsApp messages to parents and staff.",
    category: "SMS / WhatsApp",
    docsUrl: "https://www.twilio.com/docs/",
    envKeys: [
      { key: "TWILIO_ACCOUNT_SID",      label: "Account SID" },
      { key: "TWILIO_AUTH_TOKEN",       label: "Auth Token",       type: "password" },
      { key: "TWILIO_FROM_NUMBER",      label: "From Number (SMS)" },
      { key: "TWILIO_WHATSAPP_NUMBER",  label: "WhatsApp Number"   },
    ],
  },
  {
    id: "s3",
    name: "AWS S3",
    description: "Store invoice PDFs, receipts, and uploaded documents.",
    category: "File Storage",
    docsUrl: "https://docs.aws.amazon.com/s3/",
    envKeys: [
      { key: "AWS_ACCESS_KEY_ID",     label: "Access Key ID"     },
      { key: "AWS_SECRET_ACCESS_KEY", label: "Secret Access Key", type: "password" },
      { key: "AWS_S3_BUCKET_PROD",    label: "S3 Bucket Name"    },
      { key: "AWS_REGION",            label: "AWS Region"        },
    ],
  },
  {
    id: "firebase",
    name: "Firebase (FCM)",
    description: "Send push notifications to the mobile app.",
    category: "Push Notifications",
    docsUrl: "https://firebase.google.com/docs/",
    envKeys: [
      { key: "FIREBASE_PROJECT_ID",  label: "Project ID"       },
      { key: "FIREBASE_PRIVATE_KEY", label: "Private Key",     type: "password" },
      { key: "FIREBASE_CLIENT_EMAIL", label: "Client Email"    },
    ],
  },
];

export default function IntegrationsPage() {
  const [selected, setSelected] = useState<string | null>(null);

  const integration = INTEGRATIONS.find(i => i.id === selected);
  const categories  = [...new Set(INTEGRATIONS.map(i => i.category))];

  return (
    <div>
      <PageHeader
        title="Integrations"
        subtitle="Configure third-party services"
        action={
          selected ? (
            <button onClick={() => setSelected(null)}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm transition-colors">
              <ArrowLeft className="w-4 h-4" /> All integrations
            </button>
          ) : undefined
        }
      />

      {!selected ? (
        /* Grid view */
        <div className="space-y-8">
          {categories.map(cat => (
            <div key={cat}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">{cat}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {INTEGRATIONS.filter(i => i.category === cat).map(intg => (
                  <div key={intg.id}
                    className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 cursor-pointer hover:border-blue-200 hover:shadow-md transition-all"
                    onClick={() => setSelected(intg.id)}>
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-slate-900">{intg.name}</p>
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        Not configured
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{intg.description}</p>
                    <p className="text-xs text-blue-600 mt-3 font-medium">Configure →</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : integration ? (
        /* Detail view */
        <div className="max-w-xl">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <div className="mb-5">
              <h2 className="font-bold text-slate-900 text-lg">{integration.name}</h2>
              <p className="text-slate-500 text-sm mt-1">{integration.description}</p>
              <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                View documentation →
              </a>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5">
              <p className="text-sm font-semibold text-amber-800 mb-1">⚠ Server-side configuration required</p>
              <p className="text-xs text-amber-700">
                These credentials must be set in{" "}
                <code className="bg-amber-100 px-1 rounded">/apps/schoolos/backend/.env</code>{" "}
                on bytebeamserver, then restart the backend.
              </p>
            </div>

            <div className="space-y-4">
              {integration.envKeys.map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
                  <div className="flex gap-2">
                    <code className="flex-1 px-3 py-2.5 bg-slate-900 text-emerald-400 text-xs rounded-lg font-mono">
                      {key}=your_value_here
                    </code>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Add to <code>.env</code> as shown above</p>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">After updating .env</p>
              <code className="block bg-slate-900 text-emerald-400 text-xs p-4 rounded-lg font-mono leading-relaxed">
                sudo kill -9 $(sudo lsof -t -i:3000)<br />
                pnpm --filter backend dev
              </code>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
