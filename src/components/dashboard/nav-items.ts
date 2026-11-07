import {
  LayoutDashboard,
  Activity,
  Moon,
  Smile,
  Lightbulb,
  MessageSquare,
  Bell,
  ShieldCheck,
  Settings,
  FlaskConical,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/activity", label: "Activity", icon: Activity },
  { href: "/dashboard/sleep", label: "Sleep", icon: Moon },
  { href: "/dashboard/mood", label: "Mood", icon: Smile },
  { href: "/dashboard/insights", label: "Insights", icon: Lightbulb },
  { href: "/research-demo", label: "Research Demo", icon: FlaskConical },
  { href: "/dashboard/assistant", label: "Assistant", icon: MessageSquare },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/privacy", label: "Privacy & Data", icon: ShieldCheck },
  { href: "/dashboard/settings", label: "Settings", icon: Settings }
];
