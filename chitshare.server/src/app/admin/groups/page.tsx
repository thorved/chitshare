import { prisma } from "@/lib/db";
import GroupManagement from "./group-management";

export default async function GroupsPage() {
  const groups = await prisma.group.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { members: true, messages: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Groups</h1>
        <p className="text-gray-400 mt-1">View and manage all groups</p>
      </div>

      <GroupManagement initialGroups={groups} />
    </div>
  );
}
