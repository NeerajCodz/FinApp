import React from 'react';
import {
  ArrowDownRight as LucideArrowDownRight,
  ArrowLeft as LucideArrowLeft,
  ArrowLeftRight as LucideArrowLeftRight,
  ArrowRight as LucideArrowRight,
  ArrowUpRight as LucideArrowUpRight,
  Bell as LucideBell,
  Check as LucideCheck,
  ChartNoAxesCombined as LucideChartLineUp,
  ChevronRight as LucideCaretRight,
  CircleDollarSign as LucideCurrencyDollar,
  Coins as LucideCoins,
  Settings as LucideGear,
  History as LucideClockCounterClockwise,
  House as LucideHouse,
  Info as LucideInfo,
  KeyRound as LucideLockKey,
  LoaderCircle as LucideLoaderCircle,
  Search as LucideMagnifyingGlass,
  NotebookPen as LucideNotePencil,
  Palette as LucidePalette,
  Plus as LucidePlus,
  ShieldCheck as LucideShieldCheck,
  TrendingDown as LucideTrendDown,
  TrendingUp as LucideTrendUp,
  TriangleAlert as LucideTriangleAlert,
  UserCircle as LucideUserCircle,
  UsersRound as LucideUsersThree,
  Wallet as LucideWallet,
  X as LucideX,
  type LucideProps,
} from 'lucide-react-native';

type FinappIconProps = LucideProps & { weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' };

type IconComponent = React.ComponentType<LucideProps>;
function withWeight(Icon: IconComponent) {
  return function FinappIcon({ weight = 'regular', strokeWidth, ...props }: FinappIconProps) {
    const resolvedStrokeWidth =
      strokeWidth ?? (weight === 'bold' ? 2.4 : weight === 'light' ? 1.5 : 2);
    return <Icon {...props} strokeWidth={resolvedStrokeWidth} />;
  };
}

export const ArrowDownRight = withWeight(LucideArrowDownRight);
export const ArrowLeft = withWeight(LucideArrowLeft);
export const ArrowLeftRight = withWeight(LucideArrowLeftRight);
export const ArrowsLeftRight = ArrowLeftRight;
export const ArrowRight = withWeight(LucideArrowRight);
export const ArrowUpRight = withWeight(LucideArrowUpRight);
export const Bell = withWeight(LucideBell);
export const Check = withWeight(LucideCheck);
export const ChartLineUp = withWeight(LucideChartLineUp);
export const CaretRight = withWeight(LucideCaretRight);
export const CurrencyDollar = withWeight(LucideCurrencyDollar);
export const Coins = withWeight(LucideCoins);
export const Gear = withWeight(LucideGear);
export const ClockCounterClockwise = withWeight(LucideClockCounterClockwise);
export const House = withWeight(LucideHouse);
export const Info = withWeight(LucideInfo);
export const LockKey = withWeight(LucideLockKey);
export const LoaderCircle = withWeight(LucideLoaderCircle);
export const MagnifyingGlass = withWeight(LucideMagnifyingGlass);
export const NotePencil = withWeight(LucideNotePencil);
export const Palette = withWeight(LucidePalette);
export const Plus = withWeight(LucidePlus);
export const ShieldCheck = withWeight(LucideShieldCheck);
export const TrendDown = withWeight(LucideTrendDown);
export const TrendUp = withWeight(LucideTrendUp);
export const TriangleAlert = withWeight(LucideTriangleAlert);
export const UserCircle = withWeight(LucideUserCircle);
export const UsersThree = withWeight(LucideUsersThree);
export const Wallet = withWeight(LucideWallet);
export const X = withWeight(LucideX);
