import {
  LayoutDashboard,
  CalendarCheck,
  BookOpen,
  ListTree,
  FileQuestion,
  Dumbbell,
  Timer,
  Lightbulb,
  Sigma,
  Compass,
  Map,
  RotateCcw,
  NotebookPen,
  Bookmark,
  LineChart,
  PieChart,
  ShieldCheck,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Study",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/today", label: "Today's GATE DA", icon: CalendarCheck },
      { href: "/subjects", label: "Subjects", icon: BookOpen },
      { href: "/syllabus", label: "Syllabus", icon: ListTree },
      { href: "/pyqs", label: "PYQs", icon: FileQuestion },
      { href: "/practice", label: "Practice Now", icon: Dumbbell },
      { href: "/mocks", label: "Mock Tests", icon: Timer },
    ],
  },
  {
    label: "Learn",
    items: [
      { href: "/concepts", label: "Concepts", icon: Lightbulb },
      { href: "/formulas", label: "Formula Book", icon: Sigma },
      { href: "/strategy", label: "Exam Strategy", icon: Compass },
      { href: "/roadmap", label: "Roadmap", icon: Map },
    ],
  },
  {
    label: "Review",
    items: [
      { href: "/revision", label: "Revision", icon: RotateCcw },
      { href: "/errors", label: "Error Log", icon: NotebookPen },
      { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/progress", label: "Progress", icon: LineChart },
      { href: "/weightage", label: "Weightage", icon: PieChart },
    ],
  },
];

export const NAV_FOOTER: NavItem[] = [
  { href: "/sources", label: "Sources & methodology", icon: ShieldCheck },
  { href: "/settings", label: "Settings & data", icon: Settings },
];

export const MOBILE_TABS: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/pyqs", label: "PYQs", icon: FileQuestion },
  { href: "/mocks", label: "Mocks", icon: Timer },
  { href: "/revision", label: "Revision", icon: RotateCcw },
];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
