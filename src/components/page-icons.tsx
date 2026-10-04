"use client";
import { useState } from "react";
import {
  FileTextIcon,
  DatabaseIcon,
  HandWavingIcon,
  NotePencilIcon,
  BookOpenIcon,
  FolderIcon,
  ToteIcon,
  HouseIcon,
  PlantIcon,
  PaletteIcon,
  CoffeeIcon,
  PenNibIcon,
  LightbulbIcon,
  CalendarBlankIcon,
  TargetIcon,
  RocketIcon,
  BrainIcon,
  SunIcon,
  SparkleIcon,
  BookmarkSimpleIcon,
  LaptopIcon,
  WrenchIcon,
  MusicNoteIcon,
  PushPinIcon,
  WavesIcon,
  LeafIcon,
  BooksIcon,
  CheckCircleIcon,
  ChatCircleIcon,
  FlaskIcon,
  CompassIcon,
  OrangeIcon,
  BirdIcon,
  StarIcon,
  HeartIcon,
  FlagIcon,
  ClockIcon,
  CheckSquareIcon,
  BriefcaseIcon,
  CodeIcon,
  ListChecksIcon,
  MapPinIcon,
  GlobeIcon,
  CameraIcon,
  ImageIcon,
  FilmStripIcon,
  HeadphonesIcon,
  LightningIcon,
  GearSixIcon,
  LockSimpleIcon,
  MagnifyingGlassIcon,
  PaperclipIcon,
  LinkIcon,
  EnvelopeIcon,
  ChartBarIcon,
  CircleIcon,
  CaretCircleDownIcon,
} from "@phosphor-icons/react";
const catalog = [
  ["file", "Document", FileTextIcon],
  ["database", "Database", DatabaseIcon],
  ["folder", "Folder", FolderIcon],
  ["notes", "Notes", NotePencilIcon],
  ["book", "Book", BookOpenIcon],
  ["house", "Home", HouseIcon],
  ["tasks", "Tasks", ListChecksIcon],
  ["calendar", "Calendar", CalendarBlankIcon],
  ["clock", "Clock", ClockIcon],
  ["check", "Check circle", CheckCircleIcon],
  ["checkbox", "Checkbox", CheckSquareIcon],
  ["star", "Star", StarIcon],
  ["bookmark", "Bookmark", BookmarkSimpleIcon],
  ["briefcase", "Briefcase", BriefcaseIcon],
  ["bag", "Bag", ToteIcon],
  ["code", "Code", CodeIcon],
  ["laptop", "Laptop", LaptopIcon],
  ["chart", "Chart", ChartBarIcon],
  ["target", "Target", TargetIcon],
  ["flag", "Flag", FlagIcon],
  ["compass", "Compass", CompassIcon],
  ["pin", "Pin", PushPinIcon],
  ["location", "Location", MapPinIcon],
  ["globe", "Globe", GlobeIcon],
  ["lightbulb", "Idea", LightbulbIcon],
  ["brain", "Brain", BrainIcon],
  ["rocket", "Rocket", RocketIcon],
  ["lightning", "Lightning", LightningIcon],
  ["sun", "Sun", SunIcon],
  ["sparkle", "Sparkle", SparkleIcon],
  ["heart", "Heart", HeartIcon],
  ["hand", "Welcome", HandWavingIcon],
  ["plant", "Plant", PlantIcon],
  ["leaf", "Leaf", LeafIcon],
  ["waves", "Waves", WavesIcon],
  ["bird", "Bird", BirdIcon],
  ["orange", "Fruit", OrangeIcon],
  ["coffee", "Coffee", CoffeeIcon],
  ["palette", "Palette", PaletteIcon],
  ["pen", "Writing", PenNibIcon],
  ["books", "Library", BooksIcon],
  ["chat", "Comment", ChatCircleIcon],
  ["mail", "Mail", EnvelopeIcon],
  ["camera", "Camera", CameraIcon],
  ["image", "Image", ImageIcon],
  ["film", "Film", FilmStripIcon],
  ["music", "Music", MusicNoteIcon],
  ["headphones", "Headphones", HeadphonesIcon],
  ["flask", "Research", FlaskIcon],
  ["tools", "Tools", WrenchIcon],
  ["settings", "Settings", GearSixIcon],
  ["lock", "Lock", LockSimpleIcon],
  ["search", "Search", MagnifyingGlassIcon],
  ["attachment", "Attachment", PaperclipIcon],
  ["link", "Link", LinkIcon],
  ["circle", "Circle", CircleIcon],
  ["circle-down", "Circle arrow", CaretCircleDownIcon],
] as const;
const legacy: Record<string, string> = {
  "👋": "hand",
  "📝": "notes",
  "📖": "book",
  "🗂️": "folder",
  "🗂": "folder",
  "👜": "bag",
  "🏡": "house",
  "🌱": "plant",
  "🎨": "palette",
  "☕": "coffee",
  "✍️": "pen",
  "✍": "pen",
  "💡": "lightbulb",
  "📅": "calendar",
  "🎯": "target",
  "🚀": "rocket",
  "🧠": "brain",
  "🌤️": "sun",
  "🌤": "sun",
  "✨": "sparkle",
  "🔖": "bookmark",
  "💻": "laptop",
  "🛠️": "tools",
  "🎵": "music",
  "📌": "pin",
  "🌊": "waves",
  "🍃": "leaf",
  "📚": "books",
  "✅": "check",
  "💬": "chat",
  "🔬": "flask",
  "🧭": "compass",
  "🍋": "orange",
  "🦉": "bird",
  "🪴": "plant",
};
export function PageIcon({
  icon,
  kind = "page",
  size = 18,
}: {
  icon: string;
  kind?: "page" | "database";
  size?: number;
}) {
  const name = icon.startsWith("icon:") ? icon.slice(5) : legacy[icon];
  const Symbol =
    catalog.find(([id]) => id === name)?.[2] ||
    (kind === "database" ? DatabaseIcon : FileTextIcon);
  return (
    <Symbol
      className="page-symbol"
      size={size}
      weight="regular"
      aria-hidden="true"
    />
  );
}
export function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [search, setSearch] = useState("");
  const matches = catalog.filter(([id, label]) =>
    (id + " " + label).toLowerCase().includes(search.toLowerCase().trim()),
  );
  return (
    <div className="icon-picker">
      <label className="icon-search">
        <MagnifyingGlassIcon size={18} />
        <input
          aria-label="Find an icon"
          placeholder="Find an icon…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="symbol-grid">
        {matches.map(([id, label, Symbol]) => (
          <button
            key={id}
            title={label}
            aria-label={`Use ${label} icon`}
            aria-pressed={value === `icon:${id}` || legacy[value] === id}
            onClick={() => onChange(`icon:${id}`)}
          >
            <Symbol size={23} weight="regular" />
          </button>
        ))}
      </div>
      {!matches.length && (
        <p className="muted">No matching icons. Try another name.</p>
      )}
      <button className="subtle" onClick={() => onChange("")}>
        Remove icon
      </button>
    </div>
  );
}
