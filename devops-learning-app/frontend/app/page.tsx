import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-bold">DevOps Academy</h1>
      <p className="mt-4 text-lg text-slate-500 dark:text-slate-400">
        Master Linux, Git, Docker, Kubernetes, Terraform, Ansible, Helm, AWS, CI/CD and
        Monitoring — with hands-on labs and quizzes that explain every answer.
      </p>
      <div className="mt-8 flex gap-4">
        <Link href="/register" className="btn-primary">
          Start learning free
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
