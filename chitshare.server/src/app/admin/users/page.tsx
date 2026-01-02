import { prisma } from "@/lib/db";
import UserManagement from "./user-management";

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
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Users</h1>
          <p className="text-gray-400 mt-1">Manage all registered users</p>
        </div>
      </div>

      <UserManagement initialUsers={users} />
    </div>
  );
}
