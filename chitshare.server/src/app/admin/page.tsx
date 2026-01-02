import { prisma } from "@/lib/db";

export default async function AdminDashboard() {
  // Fetch stats
  const [userCount, groupCount, messageCount, onlineCount] = await Promise.all([
    prisma.user.count(),
    prisma.group.count(),
    prisma.message.count(),
    prisma.user.count({ where: { isOnline: true } }),
  ]);

  const recentUsers = await prisma.user.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      email: true,
      createdAt: true,
      isOnline: true,
    },
  });

  const stats = [
    { label: "Total Users", value: userCount, icon: "👥" },
    { label: "Online Now", value: onlineCount, icon: "🟢" },
    { label: "Groups", value: groupCount, icon: "💬" },
    { label: "Messages", value: messageCount, icon: "📨" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Overview of your ChitShare server</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-gray-900 rounded-xl p-6 border border-gray-800"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">{stat.label}</p>
                <p className="text-3xl font-bold text-white mt-2">
                  {stat.value}
                </p>
              </div>
              <span className="text-4xl">{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Users */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white">Recent Users</h2>
        </div>
        <div className="divide-y divide-gray-800">
          {recentUsers.map(
            (user: {
              id: string;
              username: string;
              email: string;
              createdAt: Date;
              isOnline: boolean;
            }) => (
              <div
                key={user.id}
                className="p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium">
                      {user.username[0].toUpperCase()}
                    </div>
                    {user.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900" />
                    )}
                  </div>
                  <div>
                    <p className="text-white font-medium">{user.username}</p>
                    <p className="text-gray-400 text-sm">{user.email}</p>
                  </div>
                </div>
                <p className="text-gray-500 text-sm">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
