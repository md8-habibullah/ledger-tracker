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

/** Swatches for new categories: muted mid-tones that read on both Pearl and Vault. */
export const CATEGORY_COLORS = [
  "#1E8A4D", "#2B883A", "#60831B", "#76801E", "#8B760E", "#AD6B1F",
  "#C55911", "#D94520", "#DC3D38", "#D34558", "#D0437C", "#837663",
] as const;
