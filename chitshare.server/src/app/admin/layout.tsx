import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminSidebar } from "./components/admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    redirect("/admin-login");
  }

  const payload = verifyToken(token);
  if (!payload) {
    redirect("/admin-login");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { isAdmin: true, username: true, email: true },
  });

  if (!user?.isAdmin) {
    redirect("/admin-login");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminSidebar user={user} />
      <main className="md:ml-64 min-h-screen bg-background/50 transition-all duration-300 ease-in-out">
        <div className="container mx-auto p-4 md:p-8 pt-6">
           {children}
        </div>
      </main>
    </div>
  );
}
