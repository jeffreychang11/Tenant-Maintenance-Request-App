import {
  IconToolsKitchen2,
  IconBath,
  IconWashMachine,
  IconDroplet,
  IconBolt,
  IconAirConditioning,
  IconPool,
  IconSofa,
  IconBed,
  IconPlant2,
  IconCar,
  IconDots,
  type Icon,
} from "@tabler/icons-react";

export const CATEGORIES = [
  { value: "kitchen", label: "Kitchen", icon: IconToolsKitchen2 },
  { value: "bathroom", label: "Bathroom", icon: IconBath },
  { value: "appliances", label: "Appliances", icon: IconWashMachine },
  { value: "plumbing", label: "Plumbing", icon: IconDroplet },
  { value: "electrical", label: "Electrical", icon: IconBolt },
  { value: "hvac", label: "Heating & cooling", icon: IconAirConditioning },
  { value: "pool", label: "Pool", icon: IconPool },
  { value: "living_room", label: "Living room", icon: IconSofa },
  { value: "bedroom", label: "Bedroom", icon: IconBed },
  { value: "exterior", label: "Exterior & yard", icon: IconPlant2 },
  { value: "garage", label: "Garage", icon: IconCar },
  { value: "other", label: "Other", icon: IconDots },
] as const satisfies { value: string; label: string; icon: Icon }[];

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

export function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
