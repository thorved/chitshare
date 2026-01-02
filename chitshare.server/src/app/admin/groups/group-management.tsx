"use client";

import { useState } from "react";

interface Group {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  _count: {
    members: number;
    messages: number;
  };
}

export default function GroupManagement({
  initialGroups,
}: {
  initialGroups: Group[];
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [search, setSearch] = useState("");

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()),
  );

  async function deleteGroup(id: string) {
    if (
      !confirm(
        "Are you sure you want to delete this group? All messages will be lost.",
      )
    )
      return;

    const token = document.cookie
      .split("; ")
      .find((row) => row.startsWith("auth_token="))
      ?.split("=")[1];

    const res = await fetch(`/api/groups/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      setGroups(groups.filter((g) => g.id !== id));
    } else {
      const data = await res.json();
      alert(data.error || "Failed to delete group");
    }
  }

  return (
    <>
      {/* Search */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search groups..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-sm px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGroups.map((group) => (
          <div
            key={group.id}
            className="bg-gray-900 rounded-xl border border-gray-800 p-6 hover:border-gray-700 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xl font-bold">
                {group.name[0].toUpperCase()}
              </div>
              <button
                onClick={() => deleteGroup(group.id)}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>

            <h3 className="text-lg font-semibold text-white mb-1">
              {group.name}
            </h3>
            <p className="text-gray-400 text-sm mb-4 line-clamp-2">
              {group.description || "No description"}
            </p>

            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-gray-400">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                {group._count.members} members
              </span>
              <span className="flex items-center gap-1.5 text-gray-400">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                {group._count.messages} messages
              </span>
            </div>

            <p className="text-gray-500 text-xs mt-4">
              Created {new Date(group.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}

        {filteredGroups.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            No groups found
          </div>
        )}
      </div>
    </>
  );
}
