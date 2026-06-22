// Product Card Props
export interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  rating: number;
  imageUrl?: string;
}

// Button Props
export type ButtonVariant = "primary" | "secondary" | "default";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: ButtonVariant;
  // onClick is inherited from ButtonHTMLAttributes<HTMLButtonElement> with the
  // correct signature: React.MouseEventHandler<HTMLButtonElement>.
  // Do NOT redeclare it as () => void — that drops the event parameter and
  // causes "not assignable" errors when the event is passed by React internally.
}
