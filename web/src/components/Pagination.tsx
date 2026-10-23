import { Link } from "react-router-dom";

export function Pagination({ total, limit, page, href }: {
  total: number;
  limit: number;
  page: number;
  href: (page: number) => string;
}) {
  const pages = Math.ceil(total / limit);
  if (pages < 2) return null;
  return (
    <nav className="pagination" aria-label="Article pages">
      {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
        <div className={`page-item ${page === number ? "active" : ""}`} key={number}>
          <Link
            className="page-link"
            to={href(number)}
            aria-current={page === number ? "page" : undefined}
            aria-label={`Page ${number}`}
          >
            {number}
          </Link>
        </div>
      ))}
    </nav>
  );
}
