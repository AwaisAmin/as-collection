'use client';

import {
  Boxes,
  ClipboardList,
  FileText,
  FolderTree,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  ListTree,
  type LucideIcon,
  Mail,
  Package,
  Percent,
  ScrollText,
  Settings,
  Shapes,
  SlidersHorizontal,
  Star,
  Tag,
  UserCog,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { isActive, type NavGroup, type NavIcon } from '@/lib/navigation';
import { cn } from '@/lib/utils/cn';

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  products: Package,
  inventory: Boxes,
  media: ImageIcon,
  categories: FolderTree,
  brands: Tag,
  attributes: SlidersHorizontal,
  collections: Shapes,
  discounts: Percent,
  reviews: Star,
  inbox: Inbox,
  customers: Users,
  newsletter: Mail,
  content: FileText,
  menus: ListTree,
  settings: Settings,
  staff: UserCog,
  audit: ScrollText,
};

/** Section navigation, already filtered to what this staff member may open. */
export function Sidebar({
  groups,
  className,
}: {
  groups: readonly NavGroup[];
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className={cn('flex flex-col gap-6', className)}>
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[11px] font-semibold tracking-[0.12em] text-white/50 uppercase">
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] transition-colors',
                      active
                        ? 'bg-white/12 text-white'
                        : 'text-white/75 hover:bg-white/8 hover:text-white',
                    )}
                  >
                    <Icon aria-hidden size={17} className={active ? 'text-gold' : undefined} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
