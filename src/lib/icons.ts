import {
  Baby, Banknote, BookOpen, Briefcase, Bus, Car, Coffee, CreditCard, Dumbbell, Film, Fuel, Gamepad2, Gift,
  GraduationCap, HandHeart, Heart, Home, Landmark, Laptop, MapPin, Music, PawPrint, Phone, PiggyBank, Plane,
  Receipt, ShoppingBag, Shirt, Smartphone, Stethoscope, Tag, TrendingUp, Users, Utensils, Wallet, Wifi, Wrench, Zap,
  type LucideIcon,
} from "lucide-react";

/** Icons a category can use. The vault stores the NAME, so this map is the single source of truth. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Banknote, Laptop, TrendingUp, Briefcase, Utensils, Bus, ShoppingBag, Music, Receipt, Stethoscope, BookOpen, MapPin,
  CreditCard, Users, HandHeart, Home, Tag, Coffee, Car, Fuel, Gift, Heart, Plane, Phone, Wifi, Zap, Shirt, PawPrint,
  Baby, GraduationCap, Wrench, Smartphone, Gamepad2, Film, Dumbbell, Landmark, PiggyBank, Wallet,
};

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS);

export function categoryIcon(name: string | undefined): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || Tag;
}

/**
 * Swatches for categories: indigo and slate tones only (the brand palette). Each is 3:1 or more with a white icon AND
 * against both the Pearl and the Vault surface, so none can be too dark to see in Vault or too light for the icon.
 */
export const CATEGORY_COLORS = [
  "#5C5FAD", "#6669B2", "#7173B7", "#7B7DBC", "#8587C1",
  "#636F7E", "#6D7987", "#768493", "#818E9C",
] as const;
