import { Link } from "react-router-dom";
import { Compass, Home } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Compass size={30} />
      </div>
      <p className="text-4xl font-bold text-ink-950">404</p>
      <h2 className="mt-2 text-lg font-semibold text-ink-900">រកមិនឃើញទំព័រដែលអ្នកស្វែងរក</h2>
      <p className="mt-1 max-w-sm text-sm text-ink-500">
        ទំព័រនេះអាចត្រូវបានលុប ឬផ្លាស់ប្ដូរអាសយដ្ឋាន។ សូមត្រឡប់ទៅផ្ទាំងគ្រប់គ្រងវិញ។
      </p>
      <Link to="/dashboard" className="btn-primary mt-5">
        <Home size={15} /> ត្រឡប់ទៅផ្ទាំងគ្រប់គ្រង
      </Link>
    </div>
  );
}
