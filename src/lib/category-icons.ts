import {
  UtensilsCrossedIcon,
  CarIcon,
  ReceiptTextIcon,
  ShoppingBagIcon,
  HeartPulseIcon,
  UsersIcon,
  HandHeartIcon,
  BriefcaseIcon,
  ClapperboardIcon,
  BanknoteIcon,
  CoinsIcon,
  GiftIcon,
  TagIcon,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  food: UtensilsCrossedIcon,
  transportation: CarIcon,
  bills: ReceiptTextIcon,
  shopping: ShoppingBagIcon,
  health: HeartPulseIcon,
  family: UsersIcon,
  "church/giving": HandHeartIcon,
  business: BriefcaseIcon,
  entertainment: ClapperboardIcon,
  salary: BanknoteIcon,
  "side income": CoinsIcon,
  gift: GiftIcon,
};

/** Best-effort icon for a category by name. */
export function categoryIcon(name: string): LucideIcon {
  return MAP[name.trim().toLowerCase()] ?? TagIcon;
}
