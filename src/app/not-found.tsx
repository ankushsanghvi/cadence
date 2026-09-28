import { Link } from "@/lib/routerCompat";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-8 text-center">
      <div>
        <p className="eyebrow mb-3">Page not found</p>
        <p className="font-display text-2xl text-ink">The page you were looking for doesn't exist.</p>
        <Link to="/" className="btn-terra mt-6 inline-flex">
          Return home
        </Link>
      </div>
    </div>
  );
}
