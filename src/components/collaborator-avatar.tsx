import { collaboratorInitials, type CollaboratorLike } from "@/lib/collaborators";

export function CollaboratorAvatar({
  person,
  name,
  className = "h-8 w-8",
}: {
  person?: CollaboratorLike;
  name?: string;
  className?: string;
}) {
  const displayName = person?.name ?? name ?? "VA";

  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary/15 font-semibold text-primary ${className}`}
    >
      {person?.photoUrl ? (
        <img src={person.photoUrl} alt={displayName} className="h-full w-full object-cover" />
      ) : (
        <span>{person?.avatar || collaboratorInitials(displayName)}</span>
      )}
    </div>
  );
}
