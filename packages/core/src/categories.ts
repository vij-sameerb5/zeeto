import type { Category, CategoryGroup } from './types';

/** `icon` is a lucide icon name, so web and mobile render the same glyph. */
export const CATEGORIES: Record<Category, { label: string; group: CategoryGroup; icon: string; cover: string }> = {
  vegetables: { label: 'Vegetables', group: 'groceries', icon: 'Carrot', cover: 'veg-2' },
  fruits: { label: 'Fruits', group: 'groceries', icon: 'Apple', cover: 'fruit-1' },
  kirana: { label: 'Kirana', group: 'groceries', icon: 'ShoppingBasket', cover: 'spice-5' },
  dairy: { label: 'Dairy', group: 'groceries', icon: 'Milk', cover: 'milk-1' },
  bakery: { label: 'Bakery', group: 'food', icon: 'Croissant', cover: 'bake-1' },
  spices: { label: 'Spices', group: 'groceries', icon: 'Flame', cover: 'spice-1' },
  fish: { label: 'Fish', group: 'groceries', icon: 'Fish', cover: 'fish-1' },
  chai: { label: 'Chai', group: 'food', icon: 'Coffee', cover: 'chai-1' },
  'street-food': { label: 'Street food', group: 'food', icon: 'Sandwich', cover: 'food-1' },
  sweets: { label: 'Sweets', group: 'food', icon: 'Cake', cover: 'sweet-2' },
  'south-indian': { label: 'Dosa & idli', group: 'food', icon: 'UtensilsCrossed', cover: 'dosa-1' },
  pharmacy: { label: 'Medical', group: 'health', icon: 'Pill', cover: 'pharm-1' },
  electrical: { label: 'Electrical', group: 'home', icon: 'Lightbulb', cover: 'elec-1' },
  hardware: { label: 'Hardware', group: 'home', icon: 'Wrench', cover: 'hw-1' },
  mobile: { label: 'Mobile repair', group: 'services', icon: 'Smartphone', cover: 'phone-1' },
  stationery: { label: 'Stationery', group: 'shopping', icon: 'PenLine', cover: 'stat-1' },
  books: { label: 'Books', group: 'shopping', icon: 'BookOpen', cover: 'book-1' },
  flowers: { label: 'Flowers', group: 'shopping', icon: 'Flower2', cover: 'flower-1' },
  tailor: { label: 'Tailor', group: 'services', icon: 'Scissors', cover: 'tailor-1' },
  salon: { label: 'Salon', group: 'services', icon: 'Sparkles', cover: 'barber-1' },
};

export const GROUPS: { id: CategoryGroup; label: string }[] = [
  { id: 'food', label: 'Food' },
  { id: 'groceries', label: 'Groceries' },
  { id: 'health', label: 'Medical' },
  { id: 'home', label: 'Home' },
  { id: 'services', label: 'Services' },
  { id: 'shopping', label: 'Shopping' },
];
