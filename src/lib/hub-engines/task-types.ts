// Canonical task-type vocabulary the HN Service Hub understands.
// Sites declare which of these they implement via their manifest; the
// Task Planner plans only against these.

export const TASK_TYPES = [
  "text_generation",
  "image_generation",
  "audio_generation",
  "video_generation",
  "translation",
  "logo_design",
  "database_creation",
  "website_building",
  "deployment",
  "chat",
  "generic",
] as const;

export type TaskType = typeof TASK_TYPES[number];

// Loose intent → task_type hints used only by the rule-based planner
// fallback. The AI planner is guided by the live registry instead.
export const INTENT_TO_TASKS: Record<string, TaskType[]> = {
  build_website: [
    "logo_design",
    "image_generation",
    "text_generation",
    "database_creation",
    "website_building",
    "deployment",
  ],
  generate_logo: ["logo_design"],
  generate_images: ["image_generation"],
  generate_texts: ["text_generation"],
  setup_database: ["database_creation"],
  deploy_site: ["deployment"],
  video: ["video_generation"],
  chat: ["chat"],
};
