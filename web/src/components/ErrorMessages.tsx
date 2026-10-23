import type { ApiErrors } from "../types";

export function ErrorMessages({ errors, title = "Please correct the following errors:" }: {
  errors: ApiErrors | null;
  title?: string;
}) {
  if (!errors || Object.keys(errors).length === 0) return null;
  return (
    <ul className="error-messages" role="alert" aria-live="polite">
      {title && <li>{title}</li>}
      {Object.entries(errors).flatMap(([field, messages]) =>
        messages.map((message, index) => (
          <li key={`${field}-${index}`}>{field === "request" || field === "network" ? message : `${field} ${message}`}</li>
        ))
      )}
    </ul>
  );
}
