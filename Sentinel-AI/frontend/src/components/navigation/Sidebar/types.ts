export interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}
