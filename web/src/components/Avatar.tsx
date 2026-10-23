interface AvatarProps {
  image?: string | null;
  username: string;
  className?: string;
}

export function Avatar({ image, username, className }: AvatarProps) {
  return (
    <img
      className={className}
      src={image || "/default-avatar.svg"}
      alt={`${username}'s avatar`}
      loading="lazy"
    />
  );
}
