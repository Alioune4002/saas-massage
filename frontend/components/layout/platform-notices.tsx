"use client";

import { useEffect, useState } from "react";

import { Notice } from "@/components/ui/notice";
import { getMyPlatformMessages, markPlatformMessageRead, type AdminAnnouncementRecord } from "@/lib/api";

type NoticeItem = {
  id: string;
  title: string;
  body: string;
  source: "message" | "announcement";
};

export function PlatformNotices() {
  const [items, setItems] = useState<NoticeItem[]>([]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await getMyPlatformMessages();
        if (!active) {
          return;
        }

        const nextItems: NoticeItem[] = [];
        const firstUnreadMessage = data.messages.find(
          (message) =>
            !message.is_read &&
            message.is_active &&
            (message.display_mode === "notice" || message.display_mode === "popup")
        );
        if (firstUnreadMessage) {
          nextItems.push({
            id: firstUnreadMessage.id,
            title: firstUnreadMessage.title,
            body: firstUnreadMessage.body,
            source: "message",
          });
          void markPlatformMessageRead(firstUnreadMessage.id).catch(() => undefined);
        }

        const activeAnnouncement = data.announcements.find(
          (announcement: AdminAnnouncementRecord) => announcement.is_active
        );
        if (activeAnnouncement) {
          nextItems.push({
            id: activeAnnouncement.id,
            title: activeAnnouncement.title,
            body: activeAnnouncement.body,
            source: "announcement",
          });
        }

        setItems(nextItems);
      } catch {
        if (active) {
          setItems([]);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  if (!items.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Notice key={`${item.source}-${item.id}`} tone={item.source === "message" ? "info" : "success"}>
          <span className="font-medium">{item.title}</span>
          {" · "}
          {item.body}
        </Notice>
      ))}
    </div>
  );
}
