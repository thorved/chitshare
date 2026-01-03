import { prisma } from "@/lib/db";
import { UsersTable } from "./users-table";
import { CreateUserDialog } from "./create-user-dialog";

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      username: true,
      isAdmin: true,
      isOnline: true,
      createdAt: true,
      lastSeen: true,
      avatarUrl: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage all registered users
          </p>
        </div>
        <CreateUserDialog />
      </div>

      <UsersTable users={users} />
    </div>
  );
}
