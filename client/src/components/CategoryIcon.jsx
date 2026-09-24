import { Flag, Brain, Disc, Car, Calendar, Timer, Users, Trophy, Map, CloudRain, BookOpen } from "lucide-react";

const ICONS = {
  Flag,
  Brain,
  Disc,
  Car,
  Calendar,
  Timer,
  Users,
  Trophy,
  Map,
  CloudRain,
  BookOpen,
};

function CategoryIcon({ name, size = 22, className = "" }) {
  const Icon = ICONS[name] || Flag;
  return <Icon size={size} className={className} />;
}

export default CategoryIcon;
