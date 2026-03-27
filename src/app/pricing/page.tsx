"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, Zap, Building2 } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For individuals and small experiments",
    icon: CreditCard,
    features: [
      "3 projects",
      "5 AI agents",
      "100K tokens/month",
      "Basic board features",
      "Community support",
    ],
    cta: "Current Plan",
    current: true,
    gradient: "from-gray-500 to-gray-600",
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month",
    description: "For teams building production apps",
    icon: Zap,
    features: [
      "20 projects",
      "20 AI agents",
      "1M tokens/month",
      "Advanced analytics",
      "Priority support",
      "Custom agent prompts",
      "Webhook integrations",
      "Export & backup",
    ],
    cta: "Upgrade",
    current: false,
    gradient: "from-[#432776] to-purple-400",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "pricing",
    description: "For organizations with advanced needs",
    icon: Building2,
    features: [
      "Unlimited projects",
      "Unlimited AI agents",
      "Unlimited tokens",
      "SSO & SAML",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
      "On-premise option",
      "Audit logs",
    ],
    cta: "Contact Sales",
    current: false,
    gradient: "from-emerald-500 to-teal-400",
  },
];

export default function PricingPage() {
  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-neutral-900">
            Plans & Pricing
          </h1>
          <p className="mt-2 text-secondary">
            Choose the plan that fits your team and scale as you grow
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative overflow-hidden ${
                plan.current ? "ring-2 ring-primary" : ""
              }`}
            >
              {/* Cover gradient */}
              <div
                className={`h-2 bg-gradient-to-r ${plan.gradient}`}
              />

              {plan.current && (
                <div className="absolute right-3 top-5">
                  <Badge variant="default">Current</Badge>
                </div>
              )}

              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <plan.icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-neutral-900">
                    {plan.price}
                  </span>
                  <span className="text-sm text-secondary">
                    {plan.period}
                  </span>
                </div>

                <ul className="space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 flex-shrink-0 text-green-500" />
                      <span className="text-neutral-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${
                    plan.current
                      ? "bg-gray-100 text-gray-500 hover:bg-gray-100 cursor-default"
                      : "bg-primary hover:bg-primary-600"
                  }`}
                  disabled={plan.current}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="rounded-xl border bg-white p-6 text-center">
          <p className="text-sm text-secondary">
            All plans include SSL encryption, daily backups, and 99.9% uptime SLA.
            Need a custom plan?{" "}
            <a href="mailto:sales@kanbanflux.com" className="text-primary hover:underline">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
