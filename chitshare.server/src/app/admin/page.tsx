import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessagesSquare, Activity, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default async function AdminDashboard() {
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
      avatarUrl: true,
      isOnline: true,
    },
  });

  const stats = [
    {
      title: "Total Users",
      value: userCount,
      icon: Users,
      description: "Registered users",
    },
    {
      title: "Active Now",
      value: onlineCount,
      icon: Activity,
      description: "Online users",
    },
    {
      title: "Files Shared",
      value: 0, // Placeholder if file count query is expensive or table not ready
      icon: UserPlus,
      description: "Total uploads",
    },
    {
      title: "Messages",
      value: messageCount,
      icon: MessagesSquare,
      description: "Total messages sent",
    },
  ];

  // Adjust "Files Shared" or replace with Groups
  stats[2] = {
      title: "Groups",
      value: groupCount,
      icon: UserPlus, // Maybe change icon
      description: "Active channels"
  }


  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of your ChitShare server activity.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {recentUsers.map((user) => (
                <div key={user.id} className="flex items-center">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.avatarUrl || ""} alt={user.username} />
                    <AvatarFallback>
                      {user.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.username}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <div className="ml-auto font-medium text-xs text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        {/* Placeholder for optional chart or other stats */}
      </div>
    </div>
  );
}
