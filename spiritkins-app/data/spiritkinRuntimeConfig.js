export const SPIRITKIN_MEDIA_SLOTS = {
  Lyra: {
    introTrailer: {
      status: "ready",
      label: "Founding intro trailer",
      path: "/videos/lyra_intro.mp4",
      fileName: "lyra_intro.mp4",
    },
  },
  Raien: {
    introTrailer: {
      status: "ready",
      label: "Founding intro trailer",
      path: "/videos/raien_intro.mp4",
      fileName: "raien_intro.mp4",
    },
  },
  Kairo: {
    introTrailer: {
      status: "ready",
      label: "Founding intro trailer",
      path: "/videos/kairo_intro.mp4",
      fileName: "kairo_intro.mp4",
    },
  },
  Elaria: {
    introTrailer: {
      status: "awaiting_media",
      label: "Intro trailer slot ready",
      path: null,
      fileName: null,
    },
  },
  Thalassar: {
    introTrailer: {
      status: "awaiting_media",
      label: "Intro trailer slot ready",
      path: null,
      fileName: null,
    },
  },
};

export const SPIRITGATE_RUNTIME_MEDIA = {
  gate: {
    status: "ready",
    path: "/videos/gate_entrance_final.mp4",
    fileName: "gate_entrance_final.mp4",
  },
  arrival: {
    status: "ready",
    path: "/videos/welcome_intro.mp4",
    fileName: "welcome_intro.mp4",
  },
};

export const SPIRITKIN_CREATOR_FOUNDATION = {
  version: "v1",
  runtimeAssetRoot: "/generated-spiritkins",
  workspaceAssetRoot: "Spiritverse_MASTER_ASSETS/INCOMING/user_created_spiritkins",
  storage: {
    draftKey: "sv.creator.draft.v1",
    libraryKey: "sv.creator.library.v1",
  },
  mediaSlotOrder: ["portrait", "introTrailer", "bondTrailer", "ambientStill"],
};

export function getSpiritkinMediaConfig(name) {
  return SPIRITKIN_MEDIA_SLOTS[String(name || "").trim()] || {
    introTrailer: {
      status: "unconfigured",
      label: "No trailer configured",
      path: null,
      fileName: null,
    },
  };
}

export function listRuntimeVideoFiles() {
  const files = new Set();
  for (const media of Object.values(SPIRITGATE_RUNTIME_MEDIA)) {
    if (media?.fileName) files.add(media.fileName);
  }
  for (const config of Object.values(SPIRITKIN_MEDIA_SLOTS)) {
    if (config?.introTrailer?.fileName) files.add(config.introTrailer.fileName);
  }
  return [...files];
}

export function createPendingCreatorMediaSlots(basePath = null) {
  const normalizedBase = typeof basePath === "string" && basePath.trim() ? basePath.replace(/\/+$/, "") : null;
  const pathFor = (slug, extension) => (normalizedBase ? `${normalizedBase}/${slug}.${extension}` : null);
  return {
    portrait: { kind: "image", status: "pending", path: pathFor("portrait", "png") },
    introTrailer: { kind: "video", status: "pending", path: pathFor("intro", "mp4") },
    bondTrailer: { kind: "video", status: "pending", path: pathFor("bond", "mp4") },
    ambientStill: { kind: "image", status: "pending", path: pathFor("ambient", "png") },
  };
}
