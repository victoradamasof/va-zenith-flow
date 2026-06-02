export type CollaboratorLike = {
  name?: string;
  avatar?: string;
  photoUrl?: string;
};

export function collaboratorInitials(name = "VA") {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "VA"
  );
}

export function normalizeCollaboratorName(name = "") {
  return name.trim().toLowerCase();
}

export function buildCollaboratorMap<T extends CollaboratorLike>(collaborators: T[]) {
  return new Map(
    collaborators
      .filter((collaborator) => collaborator.name?.trim())
      .map((collaborator) => [normalizeCollaboratorName(collaborator.name), collaborator]),
  );
}
